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
