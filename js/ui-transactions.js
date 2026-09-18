/**
 * SỔ THU CHI - UI TRANSACTIONS MODULE
 * Quản lý giao dịch, danh mục nhanh 4 hàng, bàn phím số popup, chi tiết nâng cao & liên kết vay nợ
 */

const UITransactions = {
  currentFilterType: 'all',
  searchKeyword: '',
  selectedCategory: null,
  activeKeypadInput: null,
  currentCatTab: 'expense',
  editingCatId: null,

  async init() {
    this.bindEvents();
    await this.renderQuickCategories();
    await this.render();
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

    // Fee input dot formatting
    const feeInput = document.getElementById('tx-fee-input');
    if (feeInput) {
      feeInput.addEventListener('input', (e) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        e.target.value = raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '';
      });
    }

    // Popup Keypad Button Handlers
    document.querySelectorAll('#modal-keypad .keypad-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.dataset.key;
        this.handleKeypadKey(key);
      });
    });

    // Popup Keypad Quick Chips (+10k, +50k, ...)
    document.querySelectorAll('#modal-keypad .keypad-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const val = Number(chip.dataset.val);
        this.handleKeypadQuickAdd(val);
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
  },

  /* ==================== POPUP NUMERIC KEYPAD ==================== */
  openKeypad() {
    const modal = document.getElementById('modal-keypad');
    const input = document.getElementById('tx-amount-input');
    const display = document.getElementById('keypad-live-val');
    if (!modal || !input) return;

    let cur = input.value.trim();
    if (display) {
      display.textContent = cur || '0';
    }

    modal.classList.add('open');
  },

  closeKeypad() {
    const modal = document.getElementById('modal-keypad');
    const input = document.getElementById('tx-amount-input');
    const display = document.getElementById('keypad-live-val');
    if (!modal || !input) return;

    let valStr = display ? display.textContent.trim() : '0';
    const evaluated = this.evaluateAmountExpression(valStr);
    if (evaluated !== null && evaluated > 0) {
      input.value = new Intl.NumberFormat('vi-VN').format(evaluated);
    } else {
      const raw = valStr.replace(/[^0-9]/g, '');
      input.value = raw && Number(raw) > 0 ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '';
    }

    modal.classList.remove('open');
  },

  handleKeypadKey(key) {
    const display = document.getElementById('keypad-live-val');
    if (!display) return;

    let cur = display.textContent.trim();
    if (cur === '0' && key !== '+' && key !== 'backspace' && key !== 'clear' && key !== 'done') {
      cur = '';
    }

    if (key === 'clear') {
      display.textContent = '0';
    } else if (key === 'backspace') {
      if (cur.length > 0 && cur !== '0') {
        let next = cur.slice(0, -1).trim();
        if (!next) {
          display.textContent = '0';
        } else if (/^[0-9.]*$/.test(next)) {
          const raw = next.replace(/\./g, '');
          display.textContent = raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '0';
        } else {
          display.textContent = next;
        }
      }
    } else if (key === '+') {
      if (cur && cur !== '0' && !/[+\-*/]\s*$/.test(cur)) {
        display.textContent = cur + ' + ';
      }
    } else if (key === 'done') {
      this.closeKeypad();
    } else {
      // Numbers: 1-9, 0, 00, 000
      if (cur.includes('+')) {
        display.textContent = cur + key;
      } else {
        const raw = (cur.replace(/\./g, '') + key).replace(/^0+/, '');
        display.textContent = raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '0';
      }
    }
  },

  handleKeypadQuickAdd(val) {
    const display = document.getElementById('keypad-live-val');
    if (!display) return;

    const cur = display.textContent.trim();
    const evaluated = this.evaluateAmountExpression(cur) || 0;
    const next = evaluated + val;
    display.textContent = new Intl.NumberFormat('vi-VN').format(next);
  },

  evaluateAmountExpression(expr) {
    if (!expr) return null;
    let clean = String(expr).toLowerCase().trim();
    clean = clean.replace(/(\d+(\.\d+)?)k/g, '($1 * 1000)');
    clean = clean.replace(/(\d+(\.\d+)?)tr/g, '($1 * 1000000)');
    clean = clean.replace(/(\d+(\.\d+)?)m/g, '($1 * 1000000)');
    clean = clean.replace(/\./g, '').replace(/,/g, '');

    if (/^[0-9+\-*/ ()]+$/.test(clean)) {
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

  /* ==================== QUICK CATEGORY GRID (2x4 FIXED) ==================== */
  async renderQuickCategories() {
    const container = document.getElementById('tx-quick-category-grid');
    if (!container) return;

    const allCats = await db.categories.where('isDeleted').equals(0).toArray();
    let quickCats = allCats.filter(c => c.isQuick === 1);
    if (quickCats.length === 0) {
      quickCats = allCats.slice(0, 6);
    } else {
      quickCats = quickCats.slice(0, 6);
    }

    let html = '';
    for (const cat of quickCats) {
      const isSelected = this.selectedCategory && this.selectedCategory.id === cat.id;
      html += `
        <div class="quick-cat-chip ${isSelected ? 'active' : ''}" onclick="UITransactions.selectCategoryById(${cat.id})" title="${escapeHTML(cat.name)}">
          <div class="quick-cat-icon" style="background: ${cat.color}22; color: ${cat.color};">
            <i data-lucide="${cat.icon || 'tag'}" style="width: 16px; height: 16px;"></i>
          </div>
          <span class="quick-cat-name">${escapeHTML(cat.name)}</span>
        </div>
      `;
    }

    // Fixed Cho Vay & Đi Vay chips to complete exactly 2x4 (8 slots total)
    html += `
      <div class="quick-cat-chip" onclick="UITransactions.selectDebtAction('lend')" title="Cho Vay">
        <div class="quick-cat-icon" style="background: rgba(16, 185, 129, 0.15); color: var(--income);">
          <i data-lucide="arrow-up-right" style="width: 16px; height: 16px;"></i>
        </div>
        <span class="quick-cat-name">Cho Vay</span>
      </div>
      <div class="quick-cat-chip" onclick="UITransactions.selectDebtAction('borrow')" title="Đi Vay">
        <div class="quick-cat-icon" style="background: rgba(245, 158, 11, 0.15); color: var(--warning);">
          <i data-lucide="arrow-down-left" style="width: 16px; height: 16px;"></i>
        </div>
        <span class="quick-cat-name">Đi Vay</span>
      </div>
    `;

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  },

  async selectCategoryById(catId) {
    const cat = await db.categories.get(Number(catId));
    if (cat) {
      this.selectCategory(cat);
    }
  },

  selectCategory(cat) {
    this.selectedCategory = cat;
    document.getElementById('tx-type-input').value = cat.type;
    document.getElementById('tx-category-id-input').value = cat.id;
    document.getElementById('tx-debt-subaction-input').value = '';
    document.getElementById('tx-linked-debt-id-input').value = '';

    // Update UI badge
    const badge = document.getElementById('tx-type-badge');
    if (badge) {
      badge.className = `badge-type ${cat.type}`;
      badge.textContent = cat.type === 'expense' ? 'Chi Tiêu' : 'Thu Nhập';
    }

    // Update selected category card
    const iconBox = document.getElementById('tx-selected-cat-icon');
    const nameBox = document.getElementById('tx-selected-cat-name');
    const subBox = document.getElementById('tx-selected-cat-subtext');
    if (iconBox) {
      iconBox.style.background = `${cat.color}22`;
      iconBox.style.color = cat.color;
      iconBox.innerHTML = `<i data-lucide="${cat.icon || 'tag'}"></i>`;
    }
    if (nameBox) nameBox.textContent = cat.name;
    if (subBox) subBox.textContent = cat.type === 'expense' ? 'Khoản chi tiêu từ ví' : 'Khoản thu nhập vào ví';

    // Form field adaptations
    document.getElementById('tx-debt-person-group').style.display = 'none';
    document.getElementById('tx-debt-due-group').style.display = 'none';
    document.getElementById('tx-transfer-target-group').style.display = 'none';
    const accLabel = document.getElementById('tx-account-label');
    if (accLabel) {
      accLabel.textContent = cat.type === 'expense' ? 'Trích Tiền Từ Ví' : 'Cộng Tiền Vào Ví';
    }

    this.renderQuickCategories();
    this.closeCategoryPicker();
    if (window.lucide) lucide.createIcons();
  },

  /* ==================== DEBT & TRANSFER SUB-ACTIONS ==================== */
  selectDebtAction(subaction, debtItem = null) {
    document.getElementById('tx-debt-subaction-input').value = subaction;
    document.getElementById('tx-category-id-input').value = '';
    const badge = document.getElementById('tx-type-badge');
    const iconBox = document.getElementById('tx-selected-cat-icon');
    const nameBox = document.getElementById('tx-selected-cat-name');
    const subBox = document.getElementById('tx-selected-cat-subtext');
    const personGroup = document.getElementById('tx-debt-person-group');
    const dueGroup = document.getElementById('tx-debt-due-group');
    const transferGroup = document.getElementById('tx-transfer-target-group');
    const accLabel = document.getElementById('tx-account-label');

    transferGroup.style.display = 'none';

    if (subaction === 'lend') {
      document.getElementById('tx-type-input').value = 'lend';
      document.getElementById('tx-linked-debt-id-input').value = '';
      if (badge) { badge.className = 'badge-type lend'; badge.textContent = 'Cho Vay / Chi Hộ'; }
      if (iconBox) {
        iconBox.style.background = 'rgba(16, 185, 129, 0.15)';
        iconBox.style.color = 'var(--income)';
        iconBox.innerHTML = '<i data-lucide="arrow-up-right"></i>';
      }
      if (nameBox) nameBox.textContent = 'Cho Vay / Chi Hộ';
      if (subBox) subBox.textContent = 'Cho người khác mượn tiền từ ví';
      personGroup.style.display = 'flex';
      dueGroup.style.display = 'flex';
      document.getElementById('tx-debt-person-label').textContent = 'Người Vay / Chi Cho Ai';
      if (accLabel) accLabel.textContent = 'Trích Tiền Từ Ví';

    } else if (subaction === 'borrow') {
      document.getElementById('tx-type-input').value = 'borrow';
      document.getElementById('tx-linked-debt-id-input').value = '';
      if (badge) { badge.className = 'badge-type borrow'; badge.textContent = 'Đi Vay / Mượn Tiền'; }
      if (iconBox) {
        iconBox.style.background = 'rgba(245, 158, 11, 0.15)';
        iconBox.style.color = 'var(--warning)';
        iconBox.innerHTML = '<i data-lucide="arrow-down-left"></i>';
      }
      if (nameBox) nameBox.textContent = 'Đi Vay / Mượn Tiền';
      if (subBox) subBox.textContent = 'Mượn tiền người khác nhập vào ví';
      personGroup.style.display = 'flex';
      dueGroup.style.display = 'flex';
      document.getElementById('tx-debt-person-label').textContent = 'Chủ Nợ / Mượn Từ Ai';
      if (accLabel) accLabel.textContent = 'Cộng Tiền Vào Ví';

    } else if (subaction === 'debt-collect' && debtItem) {
      document.getElementById('tx-type-input').value = 'debt-collect';
      document.getElementById('tx-linked-debt-id-input').value = debtItem.id;
      if (badge) { badge.className = 'badge-type income'; badge.textContent = 'Thu Nợ'; }
      if (iconBox) {
        iconBox.style.background = 'rgba(16, 185, 129, 0.15)';
        iconBox.style.color = 'var(--income)';
        iconBox.innerHTML = '<i data-lucide="check-circle-2"></i>';
      }
      if (nameBox) nameBox.textContent = `Thu Nợ: ${debtItem.personName}`;
      if (subBox) subBox.textContent = `Số dư còn nợ: ${new Intl.NumberFormat('vi-VN').format(debtItem.remainingAmount)}đ`;
      personGroup.style.display = 'none';
      dueGroup.style.display = 'none';
      if (accLabel) accLabel.textContent = 'Nhận Tiền Vào Ví';
      document.getElementById('tx-amount-input').value = new Intl.NumberFormat('vi-VN').format(debtItem.remainingAmount);
      document.getElementById('tx-note-input').value = `Thu nợ từ ${debtItem.personName}`;
      showToast(`Đã chọn thu nợ từ: ${debtItem.personName}`, 'info');

    } else if (subaction === 'debt-pay' && debtItem) {
      document.getElementById('tx-type-input').value = 'debt-pay';
      document.getElementById('tx-linked-debt-id-input').value = debtItem.id;
      if (badge) { badge.className = 'badge-type warning'; badge.textContent = 'Trả Nợ'; }
      if (iconBox) {
        iconBox.style.background = 'rgba(245, 158, 11, 0.15)';
        iconBox.style.color = 'var(--warning)';
        iconBox.innerHTML = '<i data-lucide="clock"></i>';
      }
      if (nameBox) nameBox.textContent = `Trả Nợ: ${debtItem.personName}`;
      if (subBox) subBox.textContent = `Số tiền cần trả: ${new Intl.NumberFormat('vi-VN').format(debtItem.remainingAmount)}đ`;
      personGroup.style.display = 'none';
      dueGroup.style.display = 'none';
      if (accLabel) accLabel.textContent = 'Trích Tiền Trả Nợ Từ Ví';
      document.getElementById('tx-amount-input').value = new Intl.NumberFormat('vi-VN').format(debtItem.remainingAmount);
      document.getElementById('tx-note-input').value = `Trả nợ cho ${debtItem.personName}`;
      showToast(`Đã chọn trả nợ cho: ${debtItem.personName}`, 'info');
    }

    this.closeCategoryPicker();
    if (window.lucide) lucide.createIcons();
  },

  selectTransferAction() {
    document.getElementById('tx-type-input').value = 'transfer';
    document.getElementById('tx-category-id-input').value = '';
    document.getElementById('tx-debt-subaction-input').value = '';
    document.getElementById('tx-linked-debt-id-input').value = '';

    const badge = document.getElementById('tx-type-badge');
    if (badge) { badge.className = 'badge-type transfer'; badge.textContent = 'Chuyển Tiền'; }

    const iconBox = document.getElementById('tx-selected-cat-icon');
    const nameBox = document.getElementById('tx-selected-cat-name');
    const subBox = document.getElementById('tx-selected-cat-subtext');
    if (iconBox) {
      iconBox.style.background = 'rgba(14, 165, 233, 0.15)';
      iconBox.style.color = '#0ea5e9';
      iconBox.innerHTML = '<i data-lucide="arrow-right-left"></i>';
    }
    if (nameBox) nameBox.textContent = 'Chuyển Tiền Giữa Các Ví';
    if (subBox) subBox.textContent = 'Chuyển khoản nội bộ giữa 2 tài khoản';

    document.getElementById('tx-debt-person-group').style.display = 'none';
    document.getElementById('tx-debt-due-group').style.display = 'none';
    document.getElementById('tx-transfer-target-group').style.display = 'flex';
    const accLabel = document.getElementById('tx-account-label');
    if (accLabel) accLabel.textContent = 'Trích Từ Ví';

    this.closeCategoryPicker();
    if (window.lucide) lucide.createIcons();
  },

  /* ==================== FULL CATEGORY PICKER (4 TABS) ==================== */
  async openCategoryPicker() {
    const modal = document.getElementById('modal-category-picker');
    if (!modal) return;

    await this.renderCategoryPickerTabs();
    modal.classList.add('open');
  },

  closeCategoryPicker() {
    const modal = document.getElementById('modal-category-picker');
    if (modal) modal.classList.remove('open');
  },

  switchCategoryTab(tab) {
    this.currentCatTab = tab;
    document.querySelectorAll('.cat-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.cat-tab-pane').forEach(pane => {
      pane.style.display = pane.id === `cat-tab-${tab}` ? 'block' : 'none';
    });
  },

  async renderCategoryPickerTabs() {
    // 1. Expense Tab
    const expenseList = document.getElementById('cat-list-expense');
    if (expenseList) {
      const expenses = await db.categories.where('type').equals('expense').and(c => c.isDeleted === 0).toArray();
      expenseList.innerHTML = expenses.map(c => `
        <div class="cat-picker-item" onclick="UITransactions.selectCategoryById(${c.id})">
          <div class="category-icon-bubble" style="background: ${c.color}22; color: ${c.color};">
            <i data-lucide="${c.icon || 'tag'}"></i>
          </div>
          <span style="font-weight: 600; font-size: 0.88rem;">${escapeHTML(c.name)}</span>
        </div>
      `).join('');
    }

    // 2. Income Tab
    const incomeList = document.getElementById('cat-list-income');
    if (incomeList) {
      const incomes = await db.categories.where('type').equals('income').and(c => c.isDeleted === 0).toArray();
      incomeList.innerHTML = incomes.map(c => `
        <div class="cat-picker-item" onclick="UITransactions.selectCategoryById(${c.id})">
          <div class="category-icon-bubble" style="background: ${c.color}22; color: ${c.color};">
            <i data-lucide="${c.icon || 'tag'}"></i>
          </div>
          <span style="font-weight: 600; font-size: 0.88rem;">${escapeHTML(c.name)}</span>
        </div>
      `).join('');
    }

    // 3. Debt Tab (Active Debts)
    const activeDebts = await db.debts.where('isDeleted').equals(0).and(d => d.status !== 'settled').toArray();
    const collectDebts = activeDebts.filter(d => d.type === 'lend');
    const payDebts = activeDebts.filter(d => d.type === 'borrow');

    const collectList = document.getElementById('cat-debt-collect-list');
    if (collectList) {
      if (collectDebts.length === 0) {
        collectList.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 6px 0;">Không có khoản nợ nào cần thu</div>';
      } else {
        collectList.innerHTML = collectDebts.map(d => `
          <div class="debt-quick-item" onclick='UITransactions.selectDebtAction("debt-collect", ${JSON.stringify(d)})'>
            <div>
              <div style="font-weight: 600; font-size: 0.88rem;">${escapeHTML(d.personName)}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${d.dueDate ? 'Hạn: ' + d.dueDate : 'Không có hạn'}</div>
            </div>
            <div style="font-weight: 700; color: var(--income); font-size: 0.95rem;">
              +${new Intl.NumberFormat('vi-VN').format(d.remainingAmount)}đ
            </div>
          </div>
        `).join('');
      }
    }

    const payList = document.getElementById('cat-debt-pay-list');
    if (payList) {
      if (payDebts.length === 0) {
        payList.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted); padding: 6px 0;">Không có khoản nợ nào cần trả</div>';
      } else {
        payList.innerHTML = payDebts.map(d => `
          <div class="debt-quick-item" onclick='UITransactions.selectDebtAction("debt-pay", ${JSON.stringify(d)})'>
            <div>
              <div style="font-weight: 600; font-size: 0.88rem;">${escapeHTML(d.personName)}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${d.dueDate ? 'Hạn: ' + d.dueDate : 'Không có hạn'}</div>
            </div>
            <div style="font-weight: 700; color: var(--warning); font-size: 0.95rem;">
              -${new Intl.NumberFormat('vi-VN').format(d.remainingAmount)}đ
            </div>
          </div>
        `).join('');
      }
    }

    if (window.lucide) lucide.createIcons();
  },

  /* ==================== CATEGORY MANAGER CRUD ==================== */
  async openCategoryManager() {
    const modal = document.getElementById('modal-category-manager');
    if (!modal) return;
    this.resetCategoryForm();
    await this.renderCategoryManagerList();
    modal.classList.add('open');
  },

  closeCategoryManager() {
    const modal = document.getElementById('modal-category-manager');
    if (modal) modal.classList.remove('open');
    this.renderQuickCategories();
  },

  openAddCategoryModal(type = 'expense') {
    this.closeCategoryPicker();
    this.openCategoryManager();
    const typeSelect = document.getElementById('cat-crud-type');
    if (typeSelect) typeSelect.value = type;
  },

  resetCategoryForm() {
    this.editingCatId = null;
    const form = document.getElementById('category-crud-form');
    if (form) form.reset();
    document.getElementById('cat-crud-id').value = '';
    document.getElementById('cat-crud-form-title').textContent = 'Thêm Danh Mục Mới';
    document.getElementById('btn-cancel-cat-crud').style.display = 'none';
  },

  async handleCategoryFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('cat-crud-id').value;
    const name = document.getElementById('cat-crud-name').value.trim();
    const type = document.getElementById('cat-crud-type').value;
    const color = document.getElementById('cat-crud-color').value;
    const icon = document.getElementById('cat-crud-icon').value;
    const isQuick = document.getElementById('cat-crud-is-quick').checked ? 1 : 0;

    if (!name) {
      showToast('Vui lòng nhập tên danh mục', 'error');
      return;
    }

    if (id) {
      await updateCategory(id, { name, type, color, icon, isQuick });
      showToast('Đã cập nhật danh mục', 'success');
    } else {
      await addCategory({ name, type, color, icon, isQuick });
      showToast('Đã tạo danh mục mới', 'success');
    }

    this.resetCategoryForm();
    await this.renderCategoryManagerList();
    await this.renderQuickCategories();
  },

  async editCategory(id) {
    const cat = await db.categories.get(Number(id));
    if (!cat) return;
    this.editingCatId = cat.id;
    document.getElementById('cat-crud-id').value = cat.id;
    document.getElementById('cat-crud-name').value = cat.name;
    document.getElementById('cat-crud-type').value = cat.type;
    document.getElementById('cat-crud-color').value = cat.color || '#6366f1';
    document.getElementById('cat-crud-icon').value = cat.icon || 'tag';
    document.getElementById('cat-crud-is-quick').checked = cat.isQuick === 1;

    document.getElementById('cat-crud-form-title').textContent = `Sửa: ${cat.name}`;
    document.getElementById('btn-cancel-cat-crud').style.display = 'inline-block';
    document.getElementById('cat-crud-name').focus();
  },

  async deleteCategory(id) {
    if (confirm('Bạn có chắc muốn xóa danh mục này? Các giao dịch cũ vẫn được giữ nguyên.')) {
      await deleteCategory(id);
      showToast('Đã xóa danh mục', 'info');
      await this.renderCategoryManagerList();
      await this.renderQuickCategories();
    }
  },

  async toggleQuickCategory(id, isQuick) {
    await updateCategory(id, { isQuick: isQuick ? 1 : 0 });
    await this.renderCategoryManagerList();
    await this.renderQuickCategories();
  },

  async renderCategoryManagerList() {
    const container = document.getElementById('cat-manager-list');
    if (!container) return;

    const cats = await db.categories.where('isDeleted').equals(0).toArray();
    container.innerHTML = cats.map(c => `
      <div class="cat-manager-row">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="quick-cat-icon" style="background: ${c.color}22; color: ${c.color}; width: 32px; height: 32px;">
            <i data-lucide="${c.icon || 'tag'}" style="width: 16px; height: 16px;"></i>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.88rem;">${escapeHTML(c.name)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${c.type === 'expense' ? 'Chi Tiêu' : 'Thu Nhập'}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button type="button" class="btn-icon" title="${c.isQuick ? 'Bỏ ghim chọn nhanh' : 'Ghim vào chọn nhanh'}" onclick="UITransactions.toggleQuickCategory(${c.id}, ${!c.isQuick})">
            <i data-lucide="${c.isQuick ? 'pin-off' : 'pin'}" style="width: 16px; height: 16px; color: ${c.isQuick ? 'var(--primary)' : 'var(--text-muted)'};"></i>
          </button>
          <button type="button" class="btn-icon" onclick="UITransactions.editCategory(${c.id})"><i data-lucide="edit-2" style="width: 16px; height: 16px;"></i></button>
          <button type="button" class="btn-icon" onclick="UITransactions.deleteCategory(${c.id})"><i data-lucide="trash-2" style="width: 16px; height: 16px; color: var(--expense);"></i></button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  /* ==================== COLLAPSIBLE DETAILS (PHÍ & ĐI VAY) ==================== */
  toggleExtraDetails() {
    const body = document.getElementById('extra-details-body');
    const chevron = document.getElementById('extra-details-chevron');
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
  },

  toggleBorrowFields() {
    const cb = document.getElementById('tx-is-borrowed-checkbox');
    const fields = document.getElementById('borrow-fields-expand');
    if (!cb || !fields) return;
    fields.style.display = cb.checked ? 'flex' : 'none';
  },

  /* ==================== ACCOUNTS ==================== */
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

  /* ==================== OPEN ADD / EDIT MODAL ==================== */
  async openAddModal(defaultType = 'expense') {
    const modal = document.getElementById('modal-transaction');
    const title = document.getElementById('modal-tx-title');
    const form = document.getElementById('transaction-form');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('tx-id-input').value = '';
    document.getElementById('tx-amount-input').value = '';
    document.getElementById('tx-date-input').value = new Date().toISOString().split('T')[0];
    const now = new Date();
    document.getElementById('tx-time-input').value = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (title) title.textContent = 'Ghi Chép Mới';

    // Reset extra details
    document.getElementById('extra-details-body').style.display = 'none';
    document.getElementById('borrow-fields-expand').style.display = 'none';
    document.getElementById('tx-is-borrowed-checkbox').checked = false;
    document.getElementById('tx-fee-input').value = '';

    await this.populateAccounts();

    // Default to top expense category
    const defaultCat = await db.categories.where('type').equals(defaultType).first();
    if (defaultCat) {
      this.selectCategory(defaultCat);
    }

    modal.classList.add('open');
  },

  closeModal() {
    const modal = document.getElementById('modal-transaction');
    if (modal) modal.classList.remove('open');
    this.closeKeypad();
    this.closeCategoryPicker();
  },

  /* ==================== FORM SUBMIT ==================== */
  async handleFormSubmit() {
    const id = document.getElementById('tx-id-input').value;
    const type = document.getElementById('tx-type-input').value;
    const subaction = document.getElementById('tx-debt-subaction-input').value;
    const linkedDebtId = document.getElementById('tx-linked-debt-id-input').value;

    const amountInput = document.getElementById('tx-amount-input').value;
    const evaluatedAmount = this.evaluateAmountExpression(amountInput) || Number(amountInput.replace(/\./g, ''));

    if (!evaluatedAmount || evaluatedAmount <= 0) {
      showToast('Vui lòng nhập số tiền hợp lệ', 'error');
      this.openKeypad();
      return;
    }

    const accountId = document.getElementById('tx-account-select').value;
    const toAccountId = document.getElementById('tx-to-account-select')?.value;
    const categoryId = document.getElementById('tx-category-id-input')?.value;
    const date = document.getElementById('tx-date-input').value;
    const time = document.getElementById('tx-time-input').value || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const note = document.getElementById('tx-note-input').value.trim();

    // Fee (Phí)
    const feeStr = document.getElementById('tx-fee-input')?.value || '0';
    const fee = Number(feeStr.replace(/\./g, '')) || 0;

    // Borrow details (Đi vay để trả)
    const isBorrowed = document.getElementById('tx-is-borrowed-checkbox')?.checked || false;
    const borrowPerson = document.getElementById('tx-borrow-person-input')?.value.trim();
    const borrowDueDate = document.getElementById('tx-borrow-due-date-input')?.value;

    if (isBorrowed && !borrowPerson) {
      showToast('Vui lòng nhập tên người cho mượn tiền', 'error');
      return;
    }

    // 1. Transfer validation
    if (type === 'transfer') {
      if (accountId === toAccountId) {
        showToast('Ví chuyển và ví nhận không thể trùng nhau', 'error');
        return;
      }
      await addTransaction({
        type: 'transfer',
        amount: evaluatedAmount,
        fee,
        accountId,
        toAccountId,
        date,
        time,
        note
      });
      this.closeModal();
      showToast('Đã ghi nhận chuyển tiền', 'success');
      window.app.refreshAll();
      return;
    }

    // 2. Cho Vay / Đi Vay (Standalone new debt)
    if (type === 'lend' || type === 'borrow') {
      const personName = document.getElementById('tx-person-input').value.trim();
      const dueDate = document.getElementById('tx-due-date-input').value;
      if (!personName) {
        showToast(type === 'lend' ? 'Vui lòng nhập người vay hoặc chi cho ai' : 'Vui lòng nhập chủ nợ hoặc mượn từ ai', 'error');
        return;
      }

      await addDebt({
        type,
        personName,
        originalAmount: evaluatedAmount,
        dueDate,
        accountId,
        note: (note ? note + ' ' : '') + `[Lúc ${time}]`
      });

      await db.transactions.add({
        type: type === 'lend' ? 'expense' : 'income',
        amount: evaluatedAmount,
        accountId: Number(accountId),
        categoryId: null,
        date,
        time,
        note: `${type === 'lend' ? 'Cho vay / Chi hộ' : 'Mượn / Đi vay'}: ${personName}${note ? ' - ' + note : ''}`,
        isDeleted: 0,
        updatedAt: Date.now()
      });

      this.closeModal();
      showToast(type === 'lend' ? 'Đã ghi nhận khoản cho vay / chi hộ' : 'Đã ghi nhận khoản mượn / đi vay', 'success');
      window.app.refreshAll();
      return;
    }

    // 3. Thu Nợ (Debt Collection)
    if (type === 'debt-collect' && linkedDebtId) {
      await recordDebtPayment(linkedDebtId, evaluatedAmount, accountId, (note ? note + ' ' : '') + `[Thu nợ lúc ${time}]`);
      await db.transactions.add({
        type: 'income',
        amount: evaluatedAmount,
        accountId: Number(accountId),
        categoryId: null,
        date,
        time,
        note: note || 'Thu tiền nợ',
        isDeleted: 0,
        updatedAt: Date.now()
      });
      this.closeModal();
      showToast('Đã ghi nhận thu nợ thành công', 'success');
      window.app.refreshAll();
      return;
    }

    // 4. Trả Nợ (Debt Payback)
    if (type === 'debt-pay' && linkedDebtId) {
      await recordDebtPayment(linkedDebtId, evaluatedAmount, accountId, (note ? note + ' ' : '') + `[Trả nợ lúc ${time}]`);
      await db.transactions.add({
        type: 'expense',
        amount: evaluatedAmount,
        accountId: Number(accountId),
        categoryId: null,
        date,
        time,
        note: note || 'Trả tiền nợ',
        isDeleted: 0,
        updatedAt: Date.now()
      });
      this.closeModal();
      showToast('Đã ghi nhận trả nợ thành công', 'success');
      window.app.refreshAll();
      return;
    }

    // 5. Normal Expense / Income
    if (id) {
      await deleteTransaction(id);
    }

    await addTransaction({
      type,
      amount: evaluatedAmount,
      fee,
      accountId,
      categoryId: categoryId || null,
      date,
      time,
      note,
      isBorrowed,
      borrowPerson,
      borrowDueDate
    });

    this.closeModal();
    showToast(id ? 'Đã cập nhật ghi chép' : 'Đã thêm ghi chép mới', 'success');
    window.app.refreshAll();
  },

  /* ==================== LIST RENDERING ==================== */
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
      const emptyHtml = `
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <i data-lucide="receipt" style="width: 48px; height: 48px; stroke-width: 1.5; margin-bottom: 12px; opacity: 0.5;"></i>
          <p style="font-size: 1rem; font-weight: 500;">Chưa có giao dịch nào</p>
          <p style="font-size: 0.85rem; margin-top: 4px;">Bấm nút "+ Thêm Mới" để bắt đầu ghi chép</p>
        </div>
      `;
      containers.forEach(c => c.innerHTML = emptyHtml);
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

        const timeDisplay = t.time ? `<span style="color: var(--primary); font-weight: 600;">${t.time}</span> • ` : '';
        const feeDisplay = t.fee ? ` • <span style="color: var(--text-muted);">Phí: ${new Intl.NumberFormat('vi-VN').format(t.fee)}đ</span>` : '';
        const accountDisplay = t.type === 'transfer' 
          ? `${timeDisplay}${fromAcc ? fromAcc.name : 'Ví'} ➔ ${toAcc ? toAcc.name : 'Ví'}${feeDisplay}`
          : `${timeDisplay}${fromAcc ? fromAcc.name : 'Ví'}${cat ? ` • ${cat.name}` : ''}${feeDisplay}`;

        html += `
          <div class="tx-card" onclick="UITransactions.openEditModal(${t.id})">
            <div class="tx-left">
              <div class="tx-icon-box" style="background: ${iconBg}; color: ${iconColor};">
                <i data-lucide="${iconName}" style="width: 20px; height: 20px;"></i>
              </div>
              <div class="tx-info">
                <span class="tx-title">${escapeHTML(title)}</span>
                <span class="tx-meta">${accountDisplay}</span>
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

  /* ==================== EDIT MODAL ==================== */
  async openEditModal(txId) {
    const tx = await db.transactions.get(Number(txId));
    if (!tx || tx.isDeleted) return;

    const modal = document.getElementById('modal-transaction');
    const title = document.getElementById('modal-tx-title');
    if (!modal) return;

    if (title) title.textContent = 'Chi Tiết Ghi Chép';
    document.getElementById('tx-id-input').value = tx.id;
    document.getElementById('tx-amount-input').value = new Intl.NumberFormat('vi-VN').format(tx.amount);
    document.getElementById('tx-date-input').value = tx.date;
    document.getElementById('tx-time-input').value = tx.time || '';
    document.getElementById('tx-note-input').value = tx.note || '';

    // Fee
    const feeInput = document.getElementById('tx-fee-input');
    if (feeInput) feeInput.value = tx.fee ? new Intl.NumberFormat('vi-VN').format(tx.fee) : '';

    await this.populateAccounts(tx.accountId, tx.toAccountId);

    if (tx.type === 'transfer') {
      this.selectTransferAction();
    } else if (tx.categoryId) {
      const cat = await db.categories.get(tx.categoryId);
      if (cat) this.selectCategory(cat);
    }

    modal.classList.add('open');
  }
};

window.UITransactions = UITransactions;
