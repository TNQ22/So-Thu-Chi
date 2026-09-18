/**
 * SỔ THU CHI - MAIN APPLICATION CONTROLLER
 * Routing, View Management, Event Handling, PWA ServiceWorker
 */

// Global Utilities
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'error') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
    <span>${escapeHTML(message)}</span>
  `;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.isPrivacyMode = false;
  }

  async init() {
    // 1. Initialize IndexedDB
    // 0. Render icons immediately
    if (window.lucide) lucide.createIcons();

    // 1. Initialize IndexedDB
    await initDatabase();

    // 2. Initialize Google Drive Sync engine
    if (window.googleDriveService) {
      await window.googleDriveService.init();
    }

    // 3. Setup UI Modules
    window.UITransactions.init();
    window.UIDebts.init();
    window.UIAccounts.init();
    window.UIBudgets.init();
    window.UIAnalytics.init();
    window.UISettings.init();

    // 4. Setup Routing & Navigation
    this.setupNavigation();

    // 5. Setup Global Shortcuts & Listeners
    this.setupGlobalShortcuts();

    // 6. Apply Saved Theme & Privacy Mode
    await this.loadInitialPreferences();

    // 7. Render initial data
    await this.refreshAll();

    // Render icons again after dynamic DOM render
    if (window.lucide) lucide.createIcons();

    // 8. Register Service Worker for PWA
    this.registerServiceWorker();

    // 9. Sync indicator listener
    this.setupSyncListeners();

    // 10. Check URL query action (e.g. ?action=new-tx or ?tab=debts)
    this.handleUrlActions();

    console.log('Sổ Thu Chi PWA đã khởi động sẵn sàng!');
  }

  async loadInitialPreferences() {
    const theme = await db.settings.get('theme');
    if (theme && theme.value) {
      this.applyTheme(theme.value);
      const themeSelect = document.getElementById('settings-theme-select');
      if (themeSelect) themeSelect.value = theme.value;
    }

    const privacy = await db.settings.get('privacyMode');
    if (privacy && privacy.value) {
      this.applyPrivacyMode(true);
    }
  }

  applyTheme(theme) {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  applyPrivacyMode(enabled) {
    this.isPrivacyMode = enabled;
    const privacyBtnIcon = document.getElementById('btn-privacy-toggle');
    if (privacyBtnIcon) {
      privacyBtnIcon.innerHTML = enabled 
        ? '<i data-lucide="eye-off" style="width: 20px; height: 20px; color: var(--warning);"></i>'
        : '<i data-lucide="eye" style="width: 20px; height: 20px;"></i>';
      if (window.lucide) lucide.createIcons();
    }

    // Mask numbers with ****** instead of eye-straining blur
    document.querySelectorAll('.stat-amount, .tx-amount, .debt-amounts div div:nth-child(2)').forEach(el => {
      if (enabled) {
        if (!el.dataset.rawAmount && el.textContent.trim() !== '******') {
          el.dataset.rawAmount = el.textContent.trim();
        }
        el.textContent = '******';
        el.classList.add('privacy-masked');
      } else {
        if (el.dataset.rawAmount) {
          el.textContent = el.dataset.rawAmount;
          delete el.dataset.rawAmount;
        }
        el.classList.remove('privacy-masked');
      }
    });
  }

  togglePrivacyMode() {
    this.applyPrivacyMode(!this.isPrivacyMode);
    db.settings.put({ key: 'privacyMode', value: this.isPrivacyMode });
    showToast(this.isPrivacyMode ? 'Đã ẩn số tiền' : 'Đã hiện số tiền', 'info');
  }

  setupNavigation() {
    // Desktop Nav Items
    document.querySelectorAll('.nav-item a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        this.switchView(view);
      });
    });

    // Mobile Bottom Nav Items
    document.querySelectorAll('.mobile-nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) this.switchView(view);
      });
    });

    // Global Action Buttons
    const fabBtn = document.getElementById('fab-add-tx');
    if (fabBtn) {
      fabBtn.addEventListener('click', () => window.UITransactions.openAddModal());
    }

    const headerAddBtn = document.getElementById('header-add-btn');
    if (headerAddBtn) {
      headerAddBtn.addEventListener('click', () => window.UITransactions.openAddModal());
    }

    const privacyBtn = document.getElementById('btn-privacy-toggle');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => this.togglePrivacyMode());
    }
  }

  switchView(viewId) {
    if (!viewId) return;
    this.currentView = viewId;

    // Update active nav links
    document.querySelectorAll('.nav-item').forEach(item => {
      const link = item.querySelector('a');
      item.classList.toggle('active', link && link.dataset.view === viewId);
    });

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Show/hide view pages
    document.querySelectorAll('.page-view').forEach(page => {
      page.classList.toggle('active', page.id === `view-${viewId}`);
    });

    // Update Header title
    const titles = {
      dashboard: 'Tổng Quan Tài Chính',
      transactions: 'Sổ Giao Dịch',
      debts: 'Sổ Vay Nợ (Cho Vay & Đi Vay)',
      accounts: 'Tài Khoản & Ví Tiền',
      budgets: 'Hạn Mức Ngân Sách',
      analytics: 'Báo Cáo & Phân Tích',
      settings: 'Cài Đặt & Đồng Bộ'
    };
    const titleEl = document.getElementById('header-page-title');
    if (titleEl) titleEl.textContent = titles[viewId] || 'Sổ Thu Chi';

    // Refresh specific view data
    if (viewId === 'dashboard') {
      this.refreshNetWorth();
      window.UITransactions.render();
      window.UIAnalytics.render();
    } else if (viewId === 'transactions') {
      window.UITransactions.render();
    } else if (viewId === 'debts') {
      window.UIDebts.render();
    } else if (viewId === 'accounts') {
      window.UIAccounts.render();
    } else if (viewId === 'budgets') {
      window.UIBudgets.render();
    } else if (viewId === 'analytics') {
      window.UIAnalytics.render();
    } else if (viewId === 'settings') {
      window.UISettings.loadSettings();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setupGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger when user is typing in input or modal is open
      const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      const isModalOpen = document.querySelector('.modal-overlay.open');

      if (!isInputActive && !isModalOpen) {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          window.UITransactions.openAddModal();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          this.togglePrivacyMode();
        }
      }

      if (e.key === 'Escape') {
        // Close any open modals
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
  }

  setupSyncListeners() {
    const dot = document.querySelector('.status-dot');
    const text = document.getElementById('sync-status-text');

    window.addEventListener('sync-start', () => {
      if (dot) dot.className = 'status-dot syncing';
      if (text) text.textContent = 'Đang đồng bộ...';
    });

    window.addEventListener('sync-success', (e) => {
      if (dot) dot.className = 'status-dot';
      if (text) text.textContent = 'Đã đồng bộ Drive';
    });

    window.addEventListener('sync-error', (e) => {
      if (dot) dot.className = 'status-dot error';
      if (text) text.textContent = 'Lỗi đồng bộ';
    });
  }

  async refreshNetWorth() {
    const nw = await getNetWorth();

    const netWorthEl = document.getElementById('stat-net-worth');
    const totalLendEl = document.getElementById('stat-total-lend');
    const totalBorrowEl = document.getElementById('stat-total-borrow');
    const totalBalanceEl = document.getElementById('stat-total-balance');

    if (netWorthEl) netWorthEl.textContent = `${new Intl.NumberFormat('vi-VN').format(nw.netWorth)}đ`;
    if (totalLendEl) totalLendEl.textContent = `${new Intl.NumberFormat('vi-VN').format(nw.totalLend)}đ`;
    if (totalBorrowEl) totalBorrowEl.textContent = `${new Intl.NumberFormat('vi-VN').format(nw.totalBorrow)}đ`;
    if (totalBalanceEl) totalBalanceEl.textContent = `${new Intl.NumberFormat('vi-VN').format(nw.totalAccountBalance)}đ`;

    // Reapply privacy mask if enabled
    if (this.isPrivacyMode) {
      this.applyPrivacyMode(true);
    }
  }

  async refreshAll() {
    await this.refreshNetWorth();
    await window.UITransactions.render();
    await window.UIDebts.render();
    await window.UIAccounts.render();
    await window.UIBudgets.render();
    await window.UIAnalytics.render();
    if (window.lucide) lucide.createIcons();
  }

  handleUrlActions() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const tab = params.get('tab');

    if (tab) {
      this.switchView(tab);
    }
    if (action === 'new-tx') {
      setTimeout(() => window.UITransactions.openAddModal(), 300);
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('PWA ServiceWorker registered with scope:', reg.scope);
          })
          .catch(err => {
            console.warn('PWA ServiceWorker registration failed:', err);
          });
      });
    }
  }
}

// Instantiate and launch App on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});

// iOS Safari / Mobile PWA Viewport and Touch Misalignment Fixes
document.addEventListener('touchstart', () => {}, { passive: true });

window.addEventListener('focusout', (e) => {
  if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    if (document.documentElement) document.documentElement.scrollTop = 0;
  }
});

if (window.visualViewport) {
  const resetViewportOffset = () => {
    if (window.visualViewport.offsetTop > 0 || window.scrollY > 0) {
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      if (document.documentElement) document.documentElement.scrollTop = 0;
    }
  };
  window.visualViewport.addEventListener('resize', resetViewportOffset);
  window.visualViewport.addEventListener('scroll', resetViewportOffset);
}
