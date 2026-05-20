/**
 * Camera stream management
 */
let stream = null;
let videoEl = null;

export async function initCamera(videoElement) {
  videoEl = videoElement;

  const constraints = {
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoEl.srcObject = stream;
    await videoEl.play();
    return true;
  } catch (err) {
    console.error('[Camera]', err);
    throw new Error('Camera access denied or unavailable');
  }
}

export function getVideoElement() {
  return videoEl;
}

export function captureSnapshot(maxWidth = 640, quality = 0.82) {
  if (!videoEl?.videoWidth) return null;

  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const scale = Math.min(1, maxWidth / vw);
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

export async function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (videoEl) {
    videoEl.srcObject = null;
  }
}

export async function reopenCamera() {
  await stopCamera();
  if (videoEl) {
    return initCamera(videoEl);
  }
  return false;
}
