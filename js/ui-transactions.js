/**
 * SỔ THU CHI - UI TRANSACTIONS MODULE
 * Quản lý danh sách giao dịch, bộ lọc, form nhập liệu & bàn phím tính nhanh
 */

const UITransactions = {
  currentFilterType: 'all',
  searchKeyword: '',

  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    // Filter pills
    document.querySelectorAll('.tx-filter-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tx-filter-pill').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentFilterType = e.target.dataset.type;
        this.render();
      });
    });

    // Search input
    const searchInput = document.getElementById('tx-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchKeyword = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // Amount input expression evaluator (Quick Calculator e.g. 50k, 25000+15000)
    const amountInput = document.getElementById('tx-amount-input');
    if (amountInput) {
      amountInput.addEventListener('blur', (e) => {
        const evaluated = this.evaluateAmountExpression(e.target.value);
        if (evaluated !== null) {
          e.target.value = evaluated;
        }
      });
    }

    // Quick chips (10k, 50k, 100k, 500k)
    document.querySelectorAll('.quick-amount-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = Number(e.target.dataset.value);
        const input = document.getElementById('tx-amount-input');
        if (input) {
          const current = Number(input.value) || 0;
          input.value = current + val;
        }
      });
    });

    // Transaction form submit
    const txForm = document.getElementById('transaction-form');
    if (txForm) {
      txForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      });
    }

    // Type toggle buttons (Expense, Income, Transfer)
    document.querySelectorAll('.modal-type-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.modal-type-btn').forEach(b => b.classList.remove('active'));
        const target = e.currentTarget;
        target.classList.add('active');
        this.handleTypeChange(target.dataset.type);
      });
    });
  },

  evaluateAmountExpression(expr) {
    if (!expr) return null;
    let clean = expr.toLowerCase().replace(/,/g, '').trim();
    // Support shorthand 'k' (nghìn) and 'tr' / 'm' (triệu)
    clean = clean.replace(/(\d+(\.\d+)?)k/g, '($1 * 1000)');
    clean = clean.replace(/(\d+(\.\d+)?)tr/g, '($1 * 1000000)');
    clean = clean.replace(/(\d+(\.\d+)?)m/g, '($1 * 1000000)');

    // Only allow safe math characters: digits, ., +, -, *, /, (, )
    if (/^[0-9+\-*/. ()]+$/.test(clean)) {
      try {
        const result = Function(`'use strict'; return (${clean})`)();
        if (typeof result === 'number' && !isNaN(result) && result >= 0) {
          return Math.round(result);
        }
      } catch (err) {
        console.warn('Invalid math expression:', err);
      }
    }
    return null;
  },

  handleTypeChange(type) {
    const categoryGroup = document.getElementById('tx-category-group');
    const transferTargetGroup = document.getElementById('tx-transfer-target-group');
    const categorySelect = document.getElementById('tx-category-select');

    if (type === 'transfer') {
      if (categoryGroup) categoryGroup.style.display = 'none';
      if (transferTargetGroup) transferTargetGroup.style.display = 'flex';
    } else {
      if (categoryGroup) categoryGroup.style.display = 'flex';
      if (transferTargetGroup) transferTargetGroup.style.display = 'none';
      // Filter categories matching type
      this.populateCategories(type);
    }
  },

  async populateCategories(type = 'expense', selectedId = null) {
    const select = document.getElementById('tx-category-select');
    if (!select) return;
    const categories = await db.categories.where('type').equals(type).and(c => c.isDeleted === 0).toArray();

    select.innerHTML = categories.map(c => `
      <option value="${c.id}" ${selectedId && Number(selectedId) === c.id ? 'selected' : ''}>${c.name}</option>
    `).join('');
  },

  async populateAccounts(selectedFromId = null, selectedToId = null) {
    const fromSelect = document.getElementById('tx-account-select');
    const toSelect = document.getElementById('tx-to-account-select');
    if (!fromSelect) return;

    const accounts = await db.accounts.where('isDeleted').equals(0).toArray();
    const options = accounts.map(a => `
      <option value="${a.id}">
        ${a.name} (${new Intl.NumberFormat('vi-VN').format(a.balance)}đ)
      </option>
    `).join('');

    fromSelect.innerHTML = options;
    if (toSelect) toSelect.innerHTML = options;

    if (selectedFromId) fromSelect.value = selectedFromId;
    if (selectedToId && toSelect) toSelect.value = selectedToId;
  },

  async openAddModal(defaultType = 'expense') {
    const modal = document.getElementById('modal-transaction');
    const title = document.getElementById('modal-tx-title');
    const form = document.getElementById('transaction-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('tx-id-input').value = '';
    document.getElementById('tx-date-input').value = new Date().toISOString().split('T')[0];
    if (title) title.textContent = 'Ghi Chép Mới';

    // Set active type button
    document.querySelectorAll('.modal-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === defaultType);
    });

    await this.populateAccounts();
    await this.populateCategories(defaultType);
    this.handleTypeChange(defaultType);

    modal.classList.add('open');
    setTimeout(() => document.getElementById('tx-amount-input')?.focus(), 150);
  },

  closeModal() {
    const modal = document.getElementById('modal-transaction');
    if (modal) modal.classList.remove('open');
  },

  async handleFormSubmit() {
    const id = document.getElementById('tx-id-input').value;
    const activeTypeBtn = document.querySelector('.modal-type-btn.active');
    const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'expense';

    const amountInput = document.getElementById('tx-amount-input').value;
    const evaluatedAmount = this.evaluateAmountExpression(amountInput) || Number(amountInput);

    if (!evaluatedAmount || evaluatedAmount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ', 'error');
      return;
    }

    const accountId = document.getElementById('tx-account-select').value;
    const toAccountId = document.getElementById('tx-to-account-select')?.value;
    const categoryId = document.getElementById('tx-category-select')?.value;
    const date = document.getElementById('tx-date-input').value;
    const note = document.getElementById('tx-note-input').value.trim();

    if (type === 'transfer' && accountId === toAccountId) {
      showToast('Ví chuyển và ví nhận không thể trùng nhau', 'error');
      return;
    }

    if (id) {
      // Edit existing: delete then re-add for clean balance calculation
      await deleteTransaction(id);
    }

    await addTransaction({
      type,
      amount: evaluatedAmount,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type !== 'transfer' ? categoryId : null,
      date,
      note
    });

    this.closeModal();
    showToast(id ? 'Đã cập nhật giao dịch' : 'Đã thêm giao dịch mới', 'success');
    window.app.refreshAll();
  },

  async render() {
    const containers = [
      document.getElementById('transactions-list-container'),
      document.getElementById('transactions-list-container-full')
    ].filter(Boolean);

    if (containers.length === 0) return;

    let txs = await db.transactions.where('isDeleted').equals(0).toArray();

    // Type filter
    if (this.currentFilterType !== 'all') {
      txs = txs.filter(t => t.type === this.currentFilterType);
    }

    // Keyword filter
    if (this.searchKeyword) {
      txs = txs.filter(t => (t.note || '').toLowerCase().includes(this.searchKeyword));
    }

    // Sort descending by date
    txs.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

    if (txs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <i data-lucide="receipt" style="width: 48px; height: 48px; stroke-width: 1.5; margin-bottom: 12px; opacity: 0.5;"></i>
          <p style="font-size: 1rem; font-weight: 500;">Chưa có giao dịch nào</p>
          <p style="font-size: 0.85rem; margin-top: 4px;">Bấm nút "+ Thêm Mới" để bắt đầu ghi chép</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    const categories = await db.categories.toArray();
    const accounts = await db.accounts.toArray();
    const catMap = new Map(categories.map(c => [c.id, c]));
    const accMap = new Map(accounts.map(a => [a.id, a]));

    // Group by Date
    const grouped = {};
    for (const t of txs) {
      if (!grouped[t.date]) grouped[t.date] = [];
      grouped[t.date].push(t);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let html = '';
    for (const [dateStr, items] of Object.entries(grouped)) {
      let dateLabel = dateStr;
      if (dateStr === todayStr) dateLabel = 'Hôm nay - ' + dateStr;
      else if (dateStr === yesterdayStr) dateLabel = 'Hôm qua - ' + dateStr;

      // Calculate date subtotal
      const dayExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
      const dayIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);

      html += `
        <div class="transaction-group">
          <div class="transaction-date-header">
            <span>${dateLabel}</span>
            <span>
              ${dayIncome > 0 ? `<span style="color: var(--income); margin-right: 8px;">+${new Intl.NumberFormat('vi-VN').format(dayIncome)}đ</span>` : ''}
              ${dayExpense > 0 ? `<span style="color: var(--expense);">${new Intl.NumberFormat('vi-VN').format(dayExpense)}đ</span>` : ''}
            </span>
          </div>
          <div class="tx-items-wrapper">
      `;

      for (const t of items) {
        const cat = catMap.get(t.categoryId);
        const fromAcc = accMap.get(t.accountId);
        const toAcc = accMap.get(t.toAccountId);

        let title = t.note || (cat ? cat.name : 'Giao dịch');
        let iconName = 'arrow-right-left';
        let iconBg = 'var(--transfer-bg)';
        let iconColor = 'var(--transfer)';
        let amountPrefix = '';
        let amountClass = 'transfer';

        if (t.type === 'expense') {
          iconName = cat ? cat.icon : 'shopping-bag';
          iconBg = 'var(--expense-bg)';
          iconColor = 'var(--expense)';
          amountPrefix = '-';
          amountClass = 'expense';
        } else if (t.type === 'income') {
          iconName = cat ? cat.icon : 'banknote';
          iconBg = 'var(--income-bg)';
          iconColor = 'var(--income)';
          amountPrefix = '+';
          amountClass = 'income';
        }

        const accountDisplay = t.type === 'transfer' 
          ? `${fromAcc ? fromAcc.name : 'Ví'} ➔ ${toAcc ? toAcc.name : 'Ví'}`
          : `${fromAcc ? fromAcc.name : 'Ví'}${cat ? ` • ${cat.name}` : ''}`;

        html += `
          <div class="tx-card" onclick="UITransactions.openEditModal(${t.id})">
            <div class="tx-left">
              <div class="tx-icon-box" style="background: ${iconBg}; color: ${iconColor};">
                <i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>
              </div>
              <div class="tx-info">
                <span class="tx-title">${escapeHTML(title)}</span>
                <span class="tx-meta">${escapeHTML(accountDisplay)}</span>
              </div>
            </div>
            <div class="tx-right">
              <span class="tx-amount ${amountClass}">
                ${amountPrefix}${new Intl.NumberFormat('vi-VN').format(t.amount)}đ
              </span>
            </div>
          </div>
        `;
      }

      html += `</div></div>`;
    }

    for (const c of containers) {
      c.innerHTML = html;
    }
    if (window.lucide) lucide.createIcons();
  },

  async openEditModal(txId) {
    const tx = await db.transactions.get(Number(txId));
    if (!tx || tx.isDeleted) return;

    const modal = document.getElementById('modal-transaction');
    const title = document.getElementById('modal-tx-title');
    if (!modal) return;

    if (title) title.textContent = 'Chi Tiết Giao Dịch';
    document.getElementById('tx-id-input').value = tx.id;
    document.getElementById('tx-amount-input').value = tx.amount;
    document.getElementById('tx-date-input').value = tx.date;
    document.getElementById('tx-note-input').value = tx.note || '';

    // Active button
    document.querySelectorAll('.modal-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === tx.type);
    });

    await this.populateAccounts(tx.accountId, tx.toAccountId);
    await this.populateCategories(tx.type, tx.categoryId);
    this.handleTypeChange(tx.type);

    modal.classList.add('open');
  }
};

window.UITransactions = UITransactions;
