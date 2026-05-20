/**
 * Attendance history UI, CSV export, snapshot preview
 */
import { fetchAttendanceLogs, isFirebaseReady } from './firebase-service.js';
import { todayDateString, formatTime } from './config.js';

export class AttendanceManager {
  constructor(ui) {
    this.ui = ui;
    this.logs = [];
    this.listEl = document.getElementById('historyList');
    this.dateFilter = document.getElementById('historyDateFilter');
    this.searchInput = document.getElementById('historySearch');
    this.snapshotModal = document.getElementById('snapshotModal');
    this.snapshotImg = document.getElementById('snapshotPreviewImg');
    this.snapshotMeta = document.getElementById('snapshotMeta');

    if (this.dateFilter) {
      this.dateFilter.value = todayDateString();
    }

    this.dateFilter?.addEventListener('change', () => this.refresh());
    this.searchInput?.addEventListener('input', debounce(() => this.refresh(), 300));
    document.getElementById('btnExportCsv')?.addEventListener('click', () => this.exportCsv());

    document.querySelectorAll('[data-close-snapshot]').forEach((btn) => {
      btn.addEventListener('click', () => this.snapshotModal?.close());
    });
  }

  async refresh() {
    if (!isFirebaseReady()) {
      this._renderEmpty('Connect Firebase to load attendance history');
      return;
    }

    const dateString = this.dateFilter?.value || todayDateString();
    const search = this.searchInput?.value || '';

    try {
      this.logs = await fetchAttendanceLogs({ dateString, search });
      this._render();
    } catch (err) {
      console.error(err);
      this._renderEmpty(err.message);
    }

    return this.logs;
  }

  exportCsv() {
    if (!this.logs.length) {
      this.ui.toast('No data to export', 'error');
      return;
    }

    const headers = [
      'ID',
      'Employee Name',
      'Employee Code',
      'Confidence',
      'Check-in Time',
      'Date',
      'Status',
      'Device ID',
      'Snapshot URL',
    ];

    const rows = this.logs.map((l) => [
      l.id,
      l.employeeName,
      l.employeeCode,
      l.confidence,
      l.checkinTime,
      l.dateString,
      l.status,
      l.deviceId,
      l.snapshotUrl,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${this.dateFilter?.value || todayDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.ui.toast('CSV exported', 'success');
  }

  _showSnapshot(log) {
    if (!log.snapshotUrl) {
      this.ui.toast('No snapshot for this record', 'info');
      return;
    }
    this.snapshotImg.src = log.snapshotUrl;
    this.snapshotMeta.textContent = `${log.employeeName} · ${formatTime(new Date(log.checkinTime))} · ${log.confidence?.toFixed?.(1) || log.confidence}%`;
    this.snapshotModal.showModal();
  }

  _renderEmpty(msg) {
    if (this.listEl) {
      this.listEl.innerHTML = `<div class="empty-state glass"><p>${msg}</p></div>`;
    }
  }

  _render() {
    if (!this.listEl) return;

    if (!this.logs.length) {
      this._renderEmpty('No attendance records for this date');
      return;
    }

    this.listEl.innerHTML = this.logs
      .map((l) => {
        const time = l.checkinTime ? formatTime(new Date(l.checkinTime)) : '—';
        const thumb = l.snapshotUrl
          ? l.snapshotUrl
          : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 72 72%22%3E%3Crect fill=%22%231a2540%22 width=%2272%22 height=%2272%22/%3E%3C/svg%3E';
        const statusClass = l.status === 'success' ? 'success' : 'unknown';

        return `
        <article class="history-item glass" data-id="${l.id}">
          <img src="${thumb}" alt="Snapshot" loading="lazy" />
          <div>
            <div class="hi-name">${esc(l.employeeName)}</div>
            <div class="hi-meta">${esc(l.employeeCode || '—')} · ${esc(l.department || '')} · ${time}</div>
            <span class="badge ${statusClass}">${l.status}</span>
          </div>
          <div class="hi-confidence">${Number(l.confidence || 0).toFixed(1)}%</div>
        </article>`;
      })
      .join('');

    this.listEl.querySelectorAll('.history-item').forEach((item, i) => {
      item.addEventListener('click', () => this._showSnapshot(this.logs[i]));
    });
  }
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
