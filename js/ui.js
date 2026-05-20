/**
 * UI helpers — status, toasts, tabs, clock
 */
export class UIController {
  constructor() {
    this.els = {
      aiStatus: document.getElementById('aiStatus'),
      confidenceFill: document.getElementById('confidenceFill'),
      confidenceValue: document.getElementById('confidenceValue'),
      resultCard: document.getElementById('resultCard'),
      resultIcon: document.getElementById('resultIcon'),
      resultTitle: document.getElementById('resultTitle'),
      resultSubtitle: document.getElementById('resultSubtitle'),
      resultCode: document.getElementById('resultCode'),
      resultDept: document.getElementById('resultDept'),
      resultTime: document.getElementById('resultTime'),
      toastContainer: document.getElementById('toastContainer'),
      firebaseStatus: document.getElementById('firebaseStatus'),
      clockDisplay: document.getElementById('clockDisplay'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      loadingStatus: document.getElementById('loadingStatus'),
      loaderBar: document.getElementById('loaderBar'),
      cameraPlaceholder: document.getElementById('cameraPlaceholder'),
    };
    this._resultHideTimer = null;
    this._startClock();
  }

  _startClock() {
    const tick = () => {
      const now = new Date();
      if (this.els.clockDisplay) {
        this.els.clockDisplay.textContent = now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  setLoading(progress, message) {
    if (this.els.loaderBar) this.els.loaderBar.style.width = `${progress}%`;
    if (this.els.loadingStatus) this.els.loadingStatus.textContent = message;
  }

  hideLoading() {
    this.els.loadingOverlay?.classList.add('hidden');
  }

  setFirebaseStatus(online) {
    const el = this.els.firebaseStatus;
    if (!el) return;
    el.classList.toggle('online', online);
    el.classList.toggle('offline', !online);
    el.querySelector('.label').textContent = online ? 'ONLINE' : 'OFFLINE';
  }

  setCameraReady(ready) {
    this.els.cameraPlaceholder?.classList.toggle('hidden', ready);
  }

  setAiStatus(state, text) {
    const el = this.els.aiStatus;
    if (!el) return;
    el.className = `ai-status ${state}`;
    el.textContent = text;
  }

  setConfidence(value) {
    const pct = Math.min(100, Math.max(0, value));
    if (this.els.confidenceFill) this.els.confidenceFill.style.width = `${pct}%`;
    if (this.els.confidenceValue) this.els.confidenceValue.textContent = `${pct.toFixed(1)}%`;
  }

  showSuccess(employee, confidence, timeStr) {
    this.setAiStatus('success', 'IDENTITY VERIFIED');
    this._showResult({
      iconClass: 'success',
      icon: '✓',
      title: employee.name,
      subtitle: `${employee.role || 'Employee'} · ${confidence.toFixed(1)}% match`,
      code: employee.employeeCode,
      dept: employee.department || '—',
      time: timeStr,
    });
  }

  showUnknown(confidence) {
    this.setAiStatus('unknown', 'UNKNOWN FACE');
    this._showResult({
      iconClass: 'error',
      icon: '✕',
      title: 'Not Recognized',
      subtitle: `Best match ${confidence.toFixed(1)}% — below threshold`,
      code: '—',
      dept: '—',
      time: new Date().toLocaleTimeString('vi-VN'),
    });
    this.toast('Unknown face detected', 'error');
  }

  _showResult({ iconClass, icon, title, subtitle, code, dept, time }) {
    clearTimeout(this._resultHideTimer);

    const card = this.els.resultCard;
    if (!card) return;

    card.classList.remove('hidden');
    this.els.resultIcon.className = `result-icon ${iconClass}`;
    this.els.resultIcon.textContent = icon;
    this.els.resultTitle.textContent = title;
    this.els.resultSubtitle.textContent = subtitle;
    this.els.resultCode.textContent = code;
    this.els.resultDept.textContent = dept;
    this.els.resultTime.textContent = time;

    this._resultHideTimer = setTimeout(() => {
      card.classList.add('hidden');
      this.setAiStatus('scanning', 'SCANNING — Stand in frame');
    }, 6000);
  }

  toast(message, type = 'info') {
    const container = this.els.toastContainer;
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }
}

export function initTabs() {
  const tabs = document.querySelectorAll('.nav-tab[data-tab]');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((p) => p.classList.toggle('active', p.id === `tab-${id}`));
      window.dispatchEvent(new CustomEvent('tab:change', { detail: { tab: id } }));
    });
  });
}

export function initKioskMode() {
  const btn = document.getElementById('btnKiosk');
  let wakeLock = null;

  btn?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        document.body.classList.add('kiosk-mode');
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
        btn.title = 'Exit kiosk';
      } else {
        await document.exitFullscreen();
        document.body.classList.remove('kiosk-mode');
        wakeLock?.release();
        wakeLock = null;
        btn.title = 'Kiosk fullscreen';
      }
    } catch (err) {
      console.warn('[Kiosk]', err);
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      document.body.classList.remove('kiosk-mode');
      wakeLock?.release();
    }
  });
}
