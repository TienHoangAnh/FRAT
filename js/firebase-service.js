/**
 * Firebase Firestore service layer
 */
import { CONFIG, todayDateString } from './config.js';
import { FIREBASE_CONFIG } from './firebase-config.js';

let db = null;
let connected = false;
/** @type {string | null} */
let lastInitFailure = null;

export function getFirebaseInitFailureReason() {
  return lastInitFailure;
}

export function initFirebase() {
  lastInitFailure = null;

  if (typeof firebase === 'undefined') {
    lastInitFailure =
      'Firebase SDK chưa tải (mạng, AdBlock, hoặc script gstatic.com bị chặn). Tải lại trang.';
    console.warn('[Firebase] SDK not loaded');
    return false;
  }

  if (typeof firebase.firestore !== 'function') {
    lastInitFailure =
      'Firestore compat chưa load — kiểm tra index.html có firebase-firestore-compat.js.';
    console.warn('[Firebase] firestore() not available');
    return false;
  }

  if (!FIREBASE_CONFIG?.projectId || FIREBASE_CONFIG.projectId === 'YOUR_PROJECT_ID') {
    lastInitFailure =
      'Chưa cấu hình Firebase: sửa js/firebase-config.js hoặc chạy npm run env:build từ .env';
    console.warn('[Firebase] Configure js/firebase-config.js');
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    connected = true;
    return true;
  } catch (err) {
    lastInitFailure = err?.message || String(err);
    console.error('[Firebase] Init failed:', err);
    connected = false;
    db = null;
    return false;
  }
}

export function isFirebaseReady() {
  return connected && db !== null;
}

export function watchConnection(onChange) {
  if (!db) {
    onChange(false);
    return () => {};
  }

  const update = () => onChange(navigator.onLine && connected);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();

  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}

/* ─── Employees ─── */

export async function fetchEmployees() {
  if (!db) return [];
  const snap = await db.collection(CONFIG.COLLECTIONS.EMPLOYEES).orderBy('createdAt', 'desc').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function saveEmployee(data, employeeId = null) {
  if (!db) throw new Error('Firebase not configured');

  const payload = {
    name: data.name,
    employeeCode: data.employeeCode,
    role: data.role || '',
    department: data.department || '',
    dob: data.dob || '',
  };

  if (data.descriptor?.length) payload.descriptor = data.descriptor;

  if (employeeId) {
    await db.collection(CONFIG.COLLECTIONS.EMPLOYEES).doc(employeeId).update(payload);
    return employeeId;
  }

  payload.descriptor = data.descriptor || [];
  payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();

  const ref = await db.collection(CONFIG.COLLECTIONS.EMPLOYEES).add(payload);
  return ref.id;
}

export async function deleteEmployee(employeeId) {
  if (!db) throw new Error('Firebase not configured');
  await db.collection(CONFIG.COLLECTIONS.EMPLOYEES).doc(employeeId).delete();
}

/* ─── Attendance ─── */

export async function saveAttendanceLog(log) {
  if (!db) throw new Error('Firebase not configured');

  const payload = {
    employeeId: log.employeeId || '',
    employeeName: log.employeeName || 'Unknown',
    employeeCode: log.employeeCode || '',
    confidence: log.confidence,
    checkinTime: log.checkinTime,
    dateString: log.dateString || todayDateString(),
    deviceId: log.deviceId,
    cameraId: log.cameraId || 'default',
    status: log.status || 'success',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  const ref = await db.collection(CONFIG.COLLECTIONS.ATTENDANCE).add(payload);
  return ref.id;
}

export async function fetchAttendanceLogs({ dateString, search = '' } = {}) {
  if (!db) return [];

  const date = dateString || todayDateString();
  const query = db
    .collection(CONFIG.COLLECTIONS.ATTENDANCE)
    .where('dateString', '==', date)
    .orderBy('checkinTime', 'desc');

  const snap = await query.get();
  let logs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    logs = logs.filter(
      (l) =>
        (l.employeeName || '').toLowerCase().includes(q) ||
        (l.employeeCode || '').toLowerCase().includes(q)
    );
  }

  return logs;
}

export async function fetchTodayCheckinEmployeeIds() {
  if (!db) return new Set();

  const snap = await db
    .collection(CONFIG.COLLECTIONS.ATTENDANCE)
    .where('dateString', '==', todayDateString())
    .where('status', '==', 'success')
    .get();

  return new Set(snap.docs.map((d) => d.data().employeeId).filter(Boolean));
}

export async function countTodayScans() {
  if (!db) return 0;
  const snap = await db
    .collection(CONFIG.COLLECTIONS.ATTENDANCE)
    .where('dateString', '==', todayDateString())
    .get();
  return snap.size;
}
