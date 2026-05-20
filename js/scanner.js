/**
 * Auto face scan loop — detection, recognition, attendance
 */
import { CONFIG, getDeviceId, formatTime, todayDateString } from './config.js';
import { detectFaceFromVideo, matchDescriptor, drawDetection, setEmployeeCache } from './face-ai.js';
import { saveAttendanceLog, isFirebaseReady } from './firebase-service.js';

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
    this.threshold = 70;
    this.cooldownMs = 30_000;
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

        await this._handleMatch(result.match, result.confidence);
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

  async _handleMatch(employee, confidence) {
    this.ui.setAiStatus('matching', 'SAVING CHECK-IN...');

    const checkinTime = new Date().toISOString();
    const deviceId = getDeviceId();

    if (isFirebaseReady()) {
      await saveAttendanceLog({
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        confidence,
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
      await saveAttendanceLog({
        employeeId: '',
        employeeName: 'Unknown',
        employeeCode: '',
        confidence,
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
