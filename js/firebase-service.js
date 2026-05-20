/**
 * Firebase Firestore & Storage service layer
 */
import { CONFIG, todayDateString } from './config.js';

let db = null;
let storage = null;
let connected = false;

export function initFirebase() {
  if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') {
    console.warn('[Firebase] SDK or config missing');
    return false;
  }

  if (!FIREBASE_CONFIG.projectId || FIREBASE_CONFIG.projectId === 'YOUR_PROJECT_ID') {
    console.warn('[Firebase] Configure js/firebase-config.js');
    return false;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    storage = firebase.storage();
    connected = true;
    return true;
  } catch (err) {
    console.error('[Firebase] Init failed:', err);
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

  if (data.avatarUrl) payload.avatarUrl = data.avatarUrl;
  if (data.descriptor?.length) payload.descriptor = data.descriptor;

  if (employeeId) {
    await db.collection(CONFIG.COLLECTIONS.EMPLOYEES).doc(employeeId).update(payload);
    return employeeId;
  }

  payload.avatarUrl = data.avatarUrl || '';
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
    snapshotUrl: log.snapshotUrl || '',
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
  let query = db
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

/* ─── Storage ─── */

export async function uploadFile(path, blob) {
  if (!storage) throw new Error('Firebase Storage not configured');
  const ref = storage.ref().child(path);
  const snap = await ref.put(blob, { contentType: blob.type || 'image/jpeg' });
  return snap.ref.getDownloadURL();
}

export function buildSnapshotPath() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const ts = now.getTime();
  return `${CONFIG.STORAGE_PATHS.SNAPSHOTS}/${y}/${m}/${d}/scan_${ts}.jpg`;
}

export function buildAvatarPath(employeeCode) {
  const safe = (employeeCode || 'emp').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${CONFIG.STORAGE_PATHS.AVATARS}/${safe}_${Date.now()}.jpg`;
}
