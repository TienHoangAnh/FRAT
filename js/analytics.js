/**
 * Dashboard analytics
 */
import {
  fetchEmployees,
  fetchTodayCheckinEmployeeIds,
  countTodayScans,
  fetchAttendanceLogs,
  isFirebaseReady,
} from './firebase-service.js';
import { todayDateString, formatTime } from './config.js';

export class AnalyticsManager {
  constructor() {
    this.els = {
      totalEmployees: document.getElementById('statTotalEmployees'),
      checkedIn: document.getElementById('statCheckedIn'),
      absent: document.getElementById('statAbsent'),
      totalScans: document.getElementById('statTotalScans'),
      recentList: document.getElementById('recentCheckins'),
    };
  }

  async refresh() {
    if (!isFirebaseReady()) {
      this._setStats(0, 0, 0, 0);
      return;
    }

    try {
      const [employees, checkedIds, scanCount, logs] = await Promise.all([
        fetchEmployees(),
        fetchTodayCheckinEmployeeIds(),
        countTodayScans(),
        fetchAttendanceLogs({ dateString: todayDateString() }),
      ]);

      const total = employees.length;
      const checkedIn = checkedIds.size;
      const absent = Math.max(0, total - checkedIn);

      this._setStats(total, checkedIn, absent, scanCount);
      this._renderRecent(logs.filter((l) => l.status === 'success').slice(0, 10));
    } catch (err) {
      console.error('[Analytics]', err);
    }
  }

  _setStats(total, checkedIn, absent, scans) {
    if (this.els.totalEmployees) this.els.totalEmployees.textContent = total;
    if (this.els.checkedIn) this.els.checkedIn.textContent = checkedIn;
    if (this.els.absent) this.els.absent.textContent = absent;
    if (this.els.totalScans) this.els.totalScans.textContent = scans;
  }

  _renderRecent(logs) {
    if (!this.els.recentList) return;

    if (!logs.length) {
      this.els.recentList.innerHTML = '<p style="color:var(--text-muted)">No check-ins today</p>';
      return;
    }

    this.els.recentList.innerHTML = logs
      .map(
        (l) => `
      <div class="recent-item">
        <span>${l.employeeName} <small style="color:var(--text-muted)">(${l.employeeCode})</small></span>
        <span>${formatTime(new Date(l.checkinTime))} · ${Number(l.confidence).toFixed(0)}%</span>
      </div>`
      )
      .join('');
  }
}
