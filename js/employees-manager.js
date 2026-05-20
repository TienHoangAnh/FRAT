/**
 * Employee CRUD UI & face enrollment
 */
import { extractDescriptorFromImage } from './face-ai.js';
import {
  fetchEmployees,
  saveEmployee,
  deleteEmployee,
  uploadFile,
  buildAvatarPath,
  isFirebaseReady,
} from './firebase-service.js';

export class EmployeesManager {
  constructor(ui) {
    this.ui = ui;
    this.employees = [];
    this.pendingDescriptor = null;
    this.pendingAvatarBlob = null;
    this.editingId = null;

    this.modal = document.getElementById('employeeModal');
    this.form = document.getElementById('employeeForm');
    this.grid = document.getElementById('employeesGrid');
    this.facePreview = document.getElementById('facePreview');
    this.faceInput = document.getElementById('faceFileInput');
    this.faceStatus = document.getElementById('faceUploadStatus');

    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('btnAddEmployee')?.addEventListener('click', () => this.openModal());
    document.getElementById('btnPickFace')?.addEventListener('click', () => this.faceInput?.click());

    this.faceInput?.addEventListener('change', (e) => this._onFaceSelected(e.target.files[0]));

    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this._save();
    });

    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => this.modal?.close());
    });
  }

  async refresh() {
    if (isFirebaseReady()) {
      this.employees = await fetchEmployees();
    }
    this._render();
    return this.employees;
  }

  getEmployees() {
    return this.employees;
  }

  openModal(employee = null) {
    this.editingId = employee?.id || null;
    this.pendingDescriptor = employee?.descriptor || null;
    this.pendingAvatarBlob = null;

    document.getElementById('modalTitle').textContent = employee ? 'Edit Employee' : 'Add Employee';
    this.form.name.value = employee?.name || '';
    this.form.employeeCode.value = employee?.employeeCode || '';
    this.form.role.value = employee?.role || '';
    this.form.department.value = employee?.department || '';
    this.form.dob.value = employee?.dob || '';

    if (employee?.avatarUrl) {
      this.facePreview.innerHTML = `<img src="${employee.avatarUrl}" alt="Face" />`;
    } else {
      this.facePreview.innerHTML = '<span>Upload face photo</span>';
    }

    this.faceStatus.textContent = employee?.descriptor?.length
      ? 'Descriptor loaded — upload new photo to replace'
      : 'AI will generate face descriptor';

    this.modal.showModal();
  }

  async _onFaceSelected(file) {
    if (!file) return;

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    await img.decode();

    this.facePreview.innerHTML = '';
    this.facePreview.appendChild(img);
    this.faceStatus.textContent = 'Generating AI descriptor...';

    try {
      this.pendingDescriptor = await extractDescriptorFromImage(img);
      this.pendingAvatarBlob = file;
      this.faceStatus.textContent = `Descriptor ready (${this.pendingDescriptor.length} dims)`;
      this.ui.toast('Face descriptor generated', 'success');
    } catch (err) {
      this.faceStatus.textContent = err.message;
      this.pendingDescriptor = null;
      this.ui.toast(err.message, 'error');
    } finally {
      URL.revokeObjectURL(img.src);
    }
  }

  async _save() {
    const data = {
      name: this.form.name.value.trim(),
      employeeCode: this.form.employeeCode.value.trim(),
      role: this.form.role.value.trim(),
      department: this.form.department.value.trim(),
      dob: this.form.dob.value,
    };

    if (!data.name || !data.employeeCode) {
      this.ui.toast('Name and employee code required', 'error');
      return;
    }

    if (!this.pendingDescriptor && !this.editingId) {
      this.ui.toast('Upload a face photo for enrollment', 'error');
      return;
    }

    if (!isFirebaseReady()) {
      this.ui.toast('Configure Firebase first (js/firebase-config.js)', 'error');
      return;
    }

    try {
      let avatarUrl;
      if (this.pendingAvatarBlob) {
        const path = buildAvatarPath(data.employeeCode);
        avatarUrl = await uploadFile(path, this.pendingAvatarBlob);
      } else if (this.editingId) {
        const existing = this.employees.find((e) => e.id === this.editingId);
        avatarUrl = existing?.avatarUrl;
      }

      const payload = {
        ...data,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(this.pendingDescriptor?.length ? { descriptor: this.pendingDescriptor } : {}),
      };

      const id = await saveEmployee(payload, this.editingId);
      this.ui.toast(this.editingId ? 'Employee updated' : 'Employee added', 'success');
      this.modal.close();
      await this.refresh();
      window.dispatchEvent(new CustomEvent('employees:updated'));
    } catch (err) {
      console.error(err);
      this.ui.toast(err.message || 'Save failed', 'error');
    }
  }

  async _delete(id, name) {
    if (!confirm(`Delete employee "${name}"?`)) return;

    try {
      await deleteEmployee(id);
      this.ui.toast('Employee deleted', 'info');
      await this.refresh();
      window.dispatchEvent(new CustomEvent('employees:updated'));
    } catch (err) {
      this.ui.toast(err.message, 'error');
    }
  }

  _render() {
    if (!this.grid) return;

    if (!this.employees.length) {
      this.grid.innerHTML = `
        <div class="empty-state glass">
          <p>No employees registered</p>
          <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-muted)">
            Add employees with a clear face photo to enable recognition
          </p>
        </div>`;
      return;
    }

    this.grid.innerHTML = this.employees
      .map(
        (e) => `
      <article class="employee-card glass" data-id="${e.id}">
        <img src="${e.avatarUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect fill=%22%231a2540%22 width=%2280%22 height=%2280%22/%3E%3Ctext x=%2240%22 y=%2245%22 text-anchor=%22middle%22 fill=%22%237a9bb8%22 font-size=%2224%22%3E?%3C/text%3E%3C/svg%3E'}" alt="${e.name}" />
        <div class="emp-name">${escapeHtml(e.name)}</div>
        <div class="emp-code">${escapeHtml(e.employeeCode)}</div>
        <div class="emp-meta">${escapeHtml(e.role || '')} · ${escapeHtml(e.department || '')}</div>
        <div class="card-actions">
          <button class="btn secondary btn-edit" data-id="${e.id}">Edit</button>
          <button class="btn danger btn-delete" data-id="${e.id}">Delete</button>
        </div>
      </article>`
      )
      .join('');

    this.grid.querySelectorAll('.btn-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const emp = this.employees.find((x) => x.id === btn.dataset.id);
        if (emp) this.openModal(emp);
      });
    });

    this.grid.querySelectorAll('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const emp = this.employees.find((x) => x.id === btn.dataset.id);
        if (emp) this._delete(emp.id, emp.name);
      });
    });
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
