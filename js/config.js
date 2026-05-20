/**
 * Application configuration & constants
 */
export const CONFIG = {
  MODEL_BASE_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/',
  FACE_MATCH_DISTANCE: 0.55,
  DEFAULT_CONFIDENCE_THRESHOLD: 70,
  DEFAULT_COOLDOWN_MS: 30_000,
  SCAN_INTERVAL_MS: 150,
  SNAPSHOT_MAX_WIDTH: 640,
  SNAPSHOT_QUALITY: 0.82,
  COLLECTIONS: {
    EMPLOYEES: 'employees',
    ATTENDANCE: 'attendance_logs',
  },
  STORAGE_PATHS: {
    AVATARS: 'employees/avatar',
    SNAPSHOTS: 'attendance/snapshots',
  },
};

export function getDeviceId() {
  const KEY = 'frat_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `device_${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function todayDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function distanceToConfidence(distance) {
  const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));
  return Math.round(confidence * 10) / 10;
}
