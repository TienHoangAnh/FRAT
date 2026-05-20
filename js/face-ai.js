/**
 * face-api.js model loading & face recognition
 */
import { CONFIG, distanceToConfidence } from './config.js';

let modelsLoaded = false;
let employeeCache = [];

export function areModelsLoaded() {
  return modelsLoaded;
}

function getModelBases() {
  const urls = CONFIG.MODEL_BASE_URLS;
  if (Array.isArray(urls) && urls.length) return urls;
  return CONFIG.MODEL_BASE_URL ? [CONFIG.MODEL_BASE_URL] : [];
}

export async function loadModels(onProgress) {
  if (modelsLoaded) return;

  if (typeof tf !== 'undefined' && typeof tf.ready === 'function') {
    await tf.ready();
  }

  if (typeof faceapi === 'undefined' || !faceapi?.nets?.tinyFaceDetector) {
    throw new Error(
      'face-api không có trên window — kiểm tra index.html đã tải face-api.min.js (jsdelivr) chưa.'
    );
  }

  const bases = getModelBases();
  if (!bases.length) {
    throw new Error('Chưa cấu hình MODEL_BASE_URLS trong config.js');
  }

  const steps = [
    { name: 'TinyFaceDetector', fn: (base) => faceapi.nets.tinyFaceDetector.loadFromUri(base) },
    { name: 'FaceLandmark68Net', fn: (base) => faceapi.nets.faceLandmark68Net.loadFromUri(base) },
    { name: 'FaceRecognitionNet', fn: (base) => faceapi.nets.faceRecognitionNet.loadFromUri(base) },
  ];

  let lastErr = null;

  for (let b = 0; b < bases.length; b++) {
    const base = bases[b];
    try {
      for (let i = 0; i < steps.length; i++) {
        const pct = ((b * steps.length + i) / (bases.length * steps.length)) * 95;
        onProgress?.(pct, `Loading ${steps[i].name}… (${base.includes('unpkg') ? 'unpkg' : 'jsdelivr'})`);
        await steps[i].fn(base);
      }
      onProgress?.(100, 'AI models ready');
      modelsLoaded = true;
      return;
    } catch (e) {
      lastErr = e;
      console.warn('[face-ai] Model load failed from', base, e);
    }
  }

  const msg = lastErr?.message || String(lastErr);
  throw new Error(
    `Không tải được model AI (${msg}). Thử: VPN/mạng khác, tắt adblock, mở bằng http://localhost — không dùng file:// .`
  );
}

export function setEmployeeCache(employees) {
  employeeCache = employees.filter((e) => e.descriptor && e.descriptor.length > 0);
}

export async function detectFaceFromVideo(video) {
  if (!modelsLoaded || !video?.videoWidth) return null;

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.5,
  });

  const result = await faceapi
    .detectSingleFace(video, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  return result;
}

export async function extractDescriptorFromImage(imageElement) {
  if (!modelsLoaded) throw new Error('Models not loaded');

  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  const detection = await faceapi
    .detectSingleFace(imageElement, options)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new Error('No face detected in image. Use a clear front-facing photo.');
  }

  return Array.from(detection.descriptor);
}

export function matchDescriptor(queryDescriptor, thresholdPercent = CONFIG.DEFAULT_CONFIDENCE_THRESHOLD) {
  if (!queryDescriptor || employeeCache.length === 0) {
    return { match: null, confidence: 0, distance: 1 };
  }

  const labeled = employeeCache.map((emp) => {
    const ref = new Float32Array(emp.descriptor);
    const distance = faceapi.euclideanDistance(queryDescriptor, ref);
    return { employee: emp, distance, confidence: distanceToConfidence(distance) };
  });

  labeled.sort((a, b) => a.distance - b.distance);
  const best = labeled[0];

  const thresholdDistance = 1 - thresholdPercent / 100;
  const isMatch = best.distance < Math.min(CONFIG.FACE_MATCH_DISTANCE, thresholdDistance);

  return {
    match: isMatch ? best.employee : null,
    confidence: best.confidence,
    distance: best.distance,
    runnerUp: labeled[1] || null,
  };
}

export function drawDetection(canvas, video, detection) {
  if (!canvas || !video) return;

  const ctx = canvas.getContext('2d');
  const displaySize = { width: video.videoWidth, height: video.videoHeight };

  if (canvas.width !== displaySize.width) {
    faceapi.matchDimensions(canvas, displaySize);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!detection) return;

  const resized = faceapi.resizeResults(detection, displaySize);
  const box = resized.detection.box;

  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 12;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  if (resized.landmarks) {
    ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
    const points = resized.landmarks.positions;
    for (const pt of points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
