/**
 * Auto face scan loop — detection, recognition, attendance
 */
import { CONFIG, getDeviceId, formatTime, todayDateString } from './config.js';
import { detectFaceFromVideo, matchDescriptor, drawDetection, setEmployeeCache } from './face-ai.js';
import { captureSnapshot } from './camera.js';
import {
  saveAttendanceLog,
  uploadFile,
  buildSnapshotPath,
  isFirebaseReady,
} from './firebase-service.js';

export class FaceScanner {
  constructor({ video, canvas, ui }) {
    this.video = video;
    this.canvas = canvas;
    this.ui = ui;
    this.running = false;
    this.processing = false;
    this.cooldownMap = new Map();
    this.rafId = null;
    this.lastDetection = null;
    this.threshold = CONFIG.DEFAULT_CONFIDENCE_THRESHOLD;
    this.cooldownMs = CONFIG.DEFAULT_COOLDOWN_MS;
    this.employees = [];
  }

  setEmployees(employees) {
    this.employees = employees;
    setEmployeeCache(employees);
  }

  setThreshold(percent) {
    this.threshold = percent;
  }

  setCooldown(seconds) {
    this.cooldownMs = seconds * 1000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  _loop() {
    if (!this.running) return;

    this.rafId = requestAnimationFrame(() => {
      this._tick().finally(() => this._loop());
    });
  }

  async _tick() {
    if (this.processing || !this.video?.videoWidth) return;

    const now = Date.now();
    if (this._lastScanAt && now - this._lastScanAt < CONFIG.SCAN_INTERVAL_MS) {
      if (this.lastDetection) drawDetection(this.canvas, this.video, this.lastDetection);
      return;
    }

    this._lastScanAt = now;

    try {
      const detection = await detectFaceFromVideo(this.video);
      this.lastDetection = detection;
      drawDetection(this.canvas, this.video, detection);

      if (!detection) {
        this.ui.setAiStatus('scanning', 'SCANNING — Stand in frame');
        this.ui.setConfidence(0);
        return;
      }

      if (this.processing) return;
      this.processing = true;

      this.ui.setAiStatus('matching', 'MATCHING FACE...');

      const result = matchDescriptor(detection.descriptor, this.threshold);
      this.ui.setConfidence(result.confidence);

      if (result.match) {
        const empId = result.match.id;
        if (this._isOnCooldown(empId)) {
          this.ui.setAiStatus('cooldown', `COOLDOWN — ${result.match.name}`);
          this.processing = false;
          return;
        }

        await this._handleMatch(result.match, result.confidence, detection);
      } else {
        this.ui.showUnknown(result.confidence);
        if (isFirebaseReady()) {
          await this._logUnknown(result.confidence);
        }
      }
    } catch (err) {
      console.error('[Scanner]', err);
    } finally {
      this.processing = false;
    }
  }

  _isOnCooldown(employeeId) {
    const until = this.cooldownMap.get(employeeId);
    return until && Date.now() < until;
  }

  _setCooldown(employeeId) {
    this.cooldownMap.set(employeeId, Date.now() + this.cooldownMs);
  }

  async _handleMatch(employee, confidence, detection) {
    this.ui.setAiStatus('matching', 'CAPTURING EVIDENCE...');

    let snapshotUrl = '';

    try {
      const blob = await captureSnapshot(CONFIG.SNAPSHOT_MAX_WIDTH, CONFIG.SNAPSHOT_QUALITY);
      if (blob && isFirebaseReady()) {
        const path = buildSnapshotPath();
        snapshotUrl = await uploadFile(path, blob);
      }
    } catch (err) {
      console.warn('[Scanner] Snapshot upload failed:', err);
    }

    const checkinTime = new Date().toISOString();
    const deviceId = getDeviceId();

    if (isFirebaseReady()) {
      await saveAttendanceLog({
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        confidence,
        snapshotUrl,
        checkinTime,
        dateString: todayDateString(),
        deviceId,
        cameraId: 'default',
        status: 'success',
      });
    }

    this._setCooldown(employee.id);
    this.ui.showSuccess(employee, confidence, formatTime(new Date(checkinTime)));
    this.ui.toast(`Check-in: ${employee.name}`, 'success');

    window.dispatchEvent(new CustomEvent('attendance:checkin', { detail: { employee, confidence } }));
  }

  async _logUnknown(confidence) {
    const key = 'unknown';
    if (this._isOnCooldown(key)) return;
    this._setCooldown(key);

    try {
      const blob = await captureSnapshot(CONFIG.SNAPSHOT_MAX_WIDTH, CONFIG.SNAPSHOT_QUALITY);
      let snapshotUrl = '';
      if (blob) {
        snapshotUrl = await uploadFile(buildSnapshotPath(), blob);
      }

      await saveAttendanceLog({
        employeeId: '',
        employeeName: 'Unknown',
        employeeCode: '',
        confidence,
        snapshotUrl,
        checkinTime: new Date().toISOString(),
        dateString: todayDateString(),
        deviceId: getDeviceId(),
        status: 'unknown',
      });
    } catch (err) {
      console.warn('[Scanner] Unknown log failed:', err);
    }
  }
}
