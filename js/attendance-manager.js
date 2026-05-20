/**
 * Attendance history UI & CSV export (Firestore only)
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

    if (this.dateFilter) {
      this.dateFilter.value = todayDateString();
    }

    this.dateFilter?.addEventListener('change', () => this.refresh());
    this.searchInput?.addEventListener('input', debounce(() => this.refresh(), 300));
    document.getElementById('btnExportCsv')?.addEventListener('click', () => this.exportCsv());
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

  _renderEmpty(msg) {
    if (this.listEl) {
      this.listEl.innerHTML = `<div class="empty-state glass"><p>${esc(msg)}</p></div>`;
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
        const statusClass = l.status === 'success' ? 'success' : 'unknown';

        return `
        <article class="history-item glass">
          <div class="hi-avatar">${esc(initial(l.employeeName))}</div>
          <div>
            <div class="hi-name">${esc(l.employeeName)}</div>
            <div class="hi-meta">${esc(l.employeeCode || '—')} · ${time}</div>
            <span class="badge ${statusClass}">${l.status}</span>
          </div>
          <div class="hi-confidence">${Number(l.confidence || 0).toFixed(1)}%</div>
        </article>`;
      })
      .join('');
  }
}

function initial(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
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
