/**
 * FRAT — AI Face Recognition Attendance
 * Main application bootstrap
 */
import { CONFIG } from './config.js';
import { initFirebase, isFirebaseReady, watchConnection } from './firebase-service.js';
import { loadModels } from './face-ai.js';
import { initCamera, reopenCamera } from './camera.js';
import { FaceScanner } from './scanner.js';
import { UIController, initTabs, initKioskMode } from './ui.js';
import { EmployeesManager } from './employees-manager.js';
import { AttendanceManager } from './attendance-manager.js';
import { AnalyticsManager } from './analytics.js';

/** ES module có thể chạy trước khi script compat trên gstatic gắn window.firebase — chờ tối đa vài giây */
function waitForFirebaseGlobal(maxMs = 8000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function tick() {
      if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
        resolve(true);
        return;
      }
      if (Date.now() - start >= maxMs) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    }
    tick();
  });
}

async function bootstrap() {
  const ui = new UIController();
  initTabs();
  initKioskMode();

  const video = document.getElementById('videoEl');
  const canvas = document.getElementById('overlayCanvas');

  // Firebase — đợi SDK global (tránh race với type="module")
  await waitForFirebaseGlobal();
  const firebaseOk = initFirebase();
  ui.setFirebaseStatus(firebaseOk && navigator.onLine);

  watchConnection((online) => {
    ui.setFirebaseStatus(online && isFirebaseReady());
  });

  if (!firebaseOk) {
    ui.toast('Demo mode: configure js/firebase-config.js for Firestore', 'info');
  }

  // Load AI models
  try {
    await loadModels((pct, msg) => ui.setLoading(pct, msg));
  } catch (err) {
    ui.setLoading(0, 'Failed to load AI models');
    ui.toast('AI model load failed. Check network.', 'error');
    console.error(err);
    return;
  }

  // Camera
  try {
    await initCamera(video);
    ui.setCameraReady(true);
  } catch (err) {
    ui.toast(err.message, 'error');
    ui.setLoading(100, err.message);
    return;
  }

  // Managers
  const employeesMgr = new EmployeesManager(ui);
  const attendanceMgr = new AttendanceManager(ui);
  const analyticsMgr = new AnalyticsManager();

  const scanner = new FaceScanner({ video, canvas, ui });

  // Settings
  const thresholdSlider = document.getElementById('thresholdSlider');
  const thresholdLabel = document.getElementById('thresholdLabel');
  const cooldownInput = document.getElementById('cooldownInput');

  thresholdSlider?.addEventListener('input', () => {
    const v = Number(thresholdSlider.value);
    thresholdLabel.textContent = `${v}%`;
    scanner.setThreshold(v);
  });

  cooldownInput?.addEventListener('change', () => {
    scanner.setCooldown(Number(cooldownInput.value) || 30);
  });

  scanner.setThreshold(Number(thresholdSlider?.value) || CONFIG.DEFAULT_CONFIDENCE_THRESHOLD);
  scanner.setCooldown(Number(cooldownInput?.value) || 30);

  // Load employees & start scanner
  const employees = await employeesMgr.refresh();
  scanner.setEmployees(employees);
  scanner.start();

  ui.hideLoading();
  ui.toast('System ready — stand in front of camera', 'success');

  // Tab refresh
  window.addEventListener('tab:change', async (e) => {
    const { tab } = e.detail;
    if (tab === 'employees') await employeesMgr.refresh();
    if (tab === 'history') await attendanceMgr.refresh();
    if (tab === 'analytics') await analyticsMgr.refresh();
    if (tab === 'camera') scanner.start();
    else scanner.stop();
  });

  // Data sync events
  window.addEventListener('employees:updated', async () => {
    const emps = await employeesMgr.refresh();
    scanner.setEmployees(emps);
    analyticsMgr.refresh();
  });

  window.addEventListener('attendance:checkin', async () => {
    analyticsMgr.refresh();
    if (document.getElementById('tab-history')?.classList.contains('active')) {
      attendanceMgr.refresh();
    }
  });

  // Visibility — pause/resume scanner
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      scanner.stop();
    } else {
      try {
        await reopenCamera();
        ui.setCameraReady(true);
        if (document.getElementById('tab-camera')?.classList.contains('active')) {
          scanner.start();
        }
      } catch {
        ui.toast('Camera reconnect failed', 'error');
      }
    }
  });

  // Initial analytics if needed
  analyticsMgr.refresh();
}

bootstrap().catch((err) => {
  console.error('[App] Fatal:', err);
  document.getElementById('loadingStatus').textContent = 'Startup failed: ' + err.message;
});
