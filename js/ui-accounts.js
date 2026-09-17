/**
 * SỔ THU CHI - UI ACCOUNTS & WALLETS MODULE
 * Quản lý các ví tiền, ngân hàng, số dư thực tế và tài sản ròng
 */

const UIAccounts = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    const accForm = document.getElementById('account-form');
    if (accForm) {
      accForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      });
    }
  },

  async openAddModal() {
    const modal = document.getElementById('modal-account');
    const form = document.getElementById('account-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('acc-id-input').value = '';
    modal.classList.add('open');
    setTimeout(() => document.getElementById('acc-name-input')?.focus(), 150);
  },

  closeModal() {
    const modal = document.getElementById('modal-account');
    if (modal) modal.classList.remove('open');
  },

  async handleFormSubmit() {
    const id = document.getElementById('acc-id-input').value;
    const name = document.getElementById('acc-name-input').value.trim();
    const type = document.getElementById('acc-type-select').value;
    const balance = Number(document.getElementById('acc-balance-input').value) || 0;

    if (!name) {
      showToast('Vui lòng nhập tên ví / tài khoản', 'error');
      return;
    }

    const now = Date.now();
    if (id) {
      await db.accounts.update(Number(id), { name, type, balance, updatedAt: now });
      showToast('Đã cập nhật thông tin ví', 'success');
    } else {
      let icon = 'wallet';
      if (type === 'bank') icon = 'landmark';
      if (type === 'ewallet') icon = 'smartphone';
      if (type === 'credit') icon = 'credit-card';
      if (type === 'saving') icon = 'piggy-bank';

      await db.accounts.add({
        name,
        type,
        balance,
        initialBalance: balance,
        icon,
        color: '#4f46e5',
        isDeleted: 0,
        updatedAt: now
      });
      showToast('Đã tạo ví mới', 'success');
    }

    this.closeModal();
    window.app.refreshAll();
  },

  async openEditModal(accId) {
    const acc = await db.accounts.get(Number(accId));
    if (!acc) return;

    const modal = document.getElementById('modal-account');
    if (!modal) return;

    document.getElementById('acc-id-input').value = acc.id;
    document.getElementById('acc-name-input').value = acc.name;
    document.getElementById('acc-type-select').value = acc.type;
    document.getElementById('acc-balance-input').value = acc.balance;

    modal.classList.add('open');
  },

  async render() {
    const container = document.getElementById('accounts-list-container');
    if (!container) return;

    const accounts = await db.accounts.where('isDeleted').equals(0).toArray();

    if (accounts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px; color: var(--text-muted);">
          <p>Chưa có ví nào. Hãy thêm ví đầu tiên!</p>
        </div>
      `;
      return;
    }

    let html = '';
    for (const a of accounts) {
      let iconName = a.icon || 'wallet';
      let typeLabel = 'Tiền mặt';
      if (a.type === 'bank') typeLabel = 'Tài khoản Ngân hàng';
      if (a.type === 'ewallet') typeLabel = 'Ví điện tử';
      if (a.type === 'credit') typeLabel = 'Thẻ tín dụng';
      if (a.type === 'saving') typeLabel = 'Sổ tiết kiệm';

      html += `
        <div class="stat-card" style="cursor: pointer;" onclick="UIAccounts.openEditModal(${a.id})">
          <div class="stat-header">
            <span class="stat-title">${typeLabel}</span>
            <div class="stat-icon" style="background: rgba(79, 70, 229, 0.15); color: #818cf8;">
              <i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>
            </div>
          </div>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary);">
            ${escapeHTML(a.name)}
          </div>
          <div class="stat-amount">
            ${new Intl.NumberFormat('vi-VN').format(a.balance)}đ
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }
};

window.UIAccounts = UIAccounts;
