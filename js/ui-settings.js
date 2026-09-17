/**
 * SỔ THU CHI - UI SETTINGS MODULE
 * Thiết lập Google Drive Sync, Xuất CSV, Sao lưu JSON, Chế độ riêng tư, Giao diện
 */

const UISettings = {
  init() {
    this.bindEvents();
    this.loadSettings();
  },

  async loadSettings() {
    // Load Client ID
    const clientIdSetting = await db.settings.get('googleClientId');
    const clientIdInput = document.getElementById('settings-client-id');
    if (clientIdSetting && clientIdInput) {
      clientIdInput.value = clientIdSetting.value;
    }

    // Auto Sync
    const autoSyncSetting = await db.settings.get('autoSyncEnabled');
    const autoSyncToggle = document.getElementById('settings-auto-sync');
    if (autoSyncSetting && autoSyncToggle) {
      autoSyncToggle.checked = !!autoSyncSetting.value;
    }

    // Privacy Mode
    const privacySetting = await db.settings.get('privacyMode');
    const privacyToggle = document.getElementById('settings-privacy-mode');
    if (privacySetting && privacyToggle) {
      privacyToggle.checked = !!privacySetting.value;
    }

    // Last Sync Text
    const lastSyncSetting = await db.settings.get('lastSyncTime');
    const lastSyncDisplay = document.getElementById('settings-last-sync-time');
    if (lastSyncSetting && lastSyncDisplay) {
      lastSyncDisplay.textContent = new Date(lastSyncSetting.value).toLocaleString('vi-VN');
    }
  },

  bindEvents() {
    // Google Client ID Save
    const saveClientIdBtn = document.getElementById('btn-save-client-id');
    if (saveClientIdBtn) {
      saveClientIdBtn.addEventListener('click', async () => {
        const input = document.getElementById('settings-client-id');
        const val = input.value.trim();
        await db.settings.put({ key: 'googleClientId', value: val });
        if (window.googleDriveService) window.googleDriveService.setClientId(val);
        showToast('Đã lưu Google Client ID', 'success');
      });
    }

    // Sync Now Button
    const syncNowBtn = document.getElementById('btn-sync-now');
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', async () => {
        try {
          syncNowBtn.disabled = true;
          syncNowBtn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Đang đồng bộ...';
          if (window.lucide) lucide.createIcons();

          const result = await window.googleDriveService.sync();
          showToast('Đồng bộ Google Drive thành công!', 'success');
          this.loadSettings();
          window.app.refreshAll();
        } catch (err) {
          showToast('Lỗi đồng bộ: ' + err.message, 'error');
        } finally {
          syncNowBtn.disabled = false;
          syncNowBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Đồng Bộ Ngay';
          if (window.lucide) lucide.createIcons();
        }
      });
    }

    // Auto Sync Toggle
    const autoSyncToggle = document.getElementById('settings-auto-sync');
    if (autoSyncToggle) {
      autoSyncToggle.addEventListener('change', async (e) => {
        await db.settings.put({ key: 'autoSyncEnabled', value: e.target.checked });
        if (window.googleDriveService) window.googleDriveService.autoSync = e.target.checked;
        showToast(e.target.checked ? 'Đã bật tự động đồng bộ' : 'Đã tắt tự động đồng bộ', 'info');
      });
    }

    // CSV Export Transactions
    const exportCsvTxBtn = document.getElementById('btn-export-tx-csv');
    if (exportCsvTxBtn) {
      exportCsvTxBtn.addEventListener('click', async () => {
        await window.CSVExportService.exportTransactions();
        showToast('Đã xuất file CSV Giao Dịch thành công', 'success');
      });
    }

    // CSV Export Debts
    const exportCsvDebtBtn = document.getElementById('btn-export-debt-csv');
    if (exportCsvDebtBtn) {
      exportCsvDebtBtn.addEventListener('click', async () => {
        await window.CSVExportService.exportDebts();
        showToast('Đã xuất file CSV Sổ Nợ thành công', 'success');
      });
    }

    // Full JSON Backup Export
    const exportJsonBtn = document.getElementById('btn-export-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', async () => {
        const pass = prompt('Nhập mật khẩu để mã hóa sao lưu (hoặc bấm OK để xuất bình thường):');
        await window.BackupService.exportFullBackup(pass || null);
        showToast('Đã xuất file sao lưu JSON', 'success');
      });
    }

    // JSON Restore Input
    const restoreFileInput = document.getElementById('input-restore-file');
    if (restoreFileInput) {
      restoreFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        let password = null;
        if (file.name.endsWith('.stc') || file.name.includes('Encrypted')) {
          password = prompt('Tệp này yêu cầu mật khẩu giải mã:');
        }

        try {
          const res = await window.BackupService.importBackup(file, password);
          showToast(`Khôi phục dữ liệu thành công (${res.count} giao dịch)!`, 'success');
          window.app.refreshAll();
        } catch (err) {
          showToast('Khôi phục thất bại: ' + err.message, 'error');
        }
        e.target.value = '';
      });
    }

    // Privacy Mode Toggle
    const privacyToggle = document.getElementById('settings-privacy-mode');
    if (privacyToggle) {
      privacyToggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        await db.settings.put({ key: 'privacyMode', value: enabled });
        window.app.applyPrivacyMode(enabled);
        showToast(enabled ? 'Đã bật chế độ riêng tư (Ẩn số tiền)' : 'Đã tắt chế độ riêng tư', 'info');
      });
    }

    // Theme Selector
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', async (e) => {
        const theme = e.target.value;
        await db.settings.put({ key: 'theme', value: theme });
        window.app.applyTheme(theme);
      });
    }
  }
};

window.UISettings = UISettings;
