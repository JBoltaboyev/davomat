/**
 * UrDPI Davomat va Monitoring Tizimi - Frontend Logic
 */

// Application State
const state = {
  currentUser: null,
  faculties: [],
  teachers: [],
  rooms: [],
  selectedFaculty: null,
  selectedDirection: null,
  selectedGroup: null,
  selectedRoom: '101-auditoriya',
  selectedShift: 'kunduzgi-1',
  shiftName: 'Kunduzgi (1-smena)',
  selectedPair: 1,
  pairTime: '08:30 - 09:50',
  userManuallySelectedPair: false,
  presentCount: 25,
  hemisTotal: 25,
  studentRoster: [],
  mode: 'quick', // 'quick' or 'roster'
  activeExcelFaculty: 'aniq-fanlar',
  currentPhotoBase64: null
};

// 3 ta O'qish Vaqti (Smena va Paralar jadvali)
const SHIFTS_CONFIG = {
  'kunduzgi-1': {
    id: 'kunduzgi-1',
    name: 'Kunduzgi (1-smena)',
    shortName: '1-smena',
    icon: '☀️',
    totalHours: '08:30 - 12:50',
    pairs: [
      { pair: 1, name: '1-para', time: '08:30 - 09:50', startMin: 8 * 60 + 30, endMin: 9 * 60 + 50 },
      { pair: 2, name: '2-para', time: '10:00 - 11:20', startMin: 10 * 60, endMin: 11 * 60 + 20 },
      { pair: 3, name: '3-para', time: '11:30 - 12:50', startMin: 11 * 60 + 30, endMin: 12 * 60 + 50 }
    ]
  },
  'kunduzgi-2': {
    id: 'kunduzgi-2',
    name: 'Kunduzgi (2-smena)',
    shortName: '2-smena',
    icon: '🌤',
    totalHours: '13:00 - 17:20',
    pairs: [
      { pair: 1, name: '1-para', time: '13:00 - 14:20', startMin: 13 * 60, endMin: 14 * 60 + 20 },
      { pair: 2, name: '2-para', time: '14:30 - 15:50', startMin: 14 * 60 + 30, endMin: 15 * 60 + 50 },
      { pair: 3, name: '3-para', time: '16:00 - 17:20', startMin: 16 * 60, endMin: 17 * 60 + 20 }
    ]
  },
  'kechki': {
    id: 'kechki',
    name: 'Kechki ta\'lim',
    shortName: 'Kechki',
    icon: '🌙',
    totalHours: '17:30 - 20:20',
    pairs: [
      { pair: 1, name: '1-para', time: '17:30 - 18:50', startMin: 17 * 60 + 30, endMin: 18 * 60 + 50 },
      { pair: 2, name: '2-para', time: '19:00 - 20:20', startMin: 19 * 60, endMin: 20 * 60 + 20 }
    ]
  }
};

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  initClockAndPair();
  initFormInteractions();
  initPhotoAudit();
  initDashboardEvents();
  initExcelViewer();
  initSettingsForms();
});

// ================= 0. AUTHENTICATION & MULTI-ROLE =================
function initAuth() {
  const loginModal = document.getElementById('loginModalOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginErrorBanner');
  const btnLogout = document.getElementById('btnLogout');
  const changePasswordForm = document.getElementById('changePasswordForm');
  const topbarProfile = document.getElementById('topbarUserProfile');


  // Login form submit
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = (document.getElementById('loginUsername')?.value || '').trim();
      const password = (document.getElementById('loginPassword')?.value || '').trim();
      const btnSubmit = document.getElementById('btnLoginSubmit');

      if (loginError) loginError.style.display = 'none';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>⏳ Tekshirilmoqda...</span>`;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Login yoki parol noto\'g\'ri');
        }

        // Save session
        state.currentUser = data.user;
        localStorage.setItem('urdpi_user', JSON.stringify(data.user));

        // Unlock application
        document.body.classList.remove('not-authenticated');
        document.body.classList.add('authenticated');
        if (loginModal) loginModal.classList.add('hidden');

        showToast(`Xush kelibsiz, ${data.user.name}!`, 'success');

        applyUserRolePermissions();
        loadSeedData();

      } catch (err) {
        if (loginError) {
          loginError.textContent = err.message;
          loginError.style.display = 'block';
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<span>Tizimga Kirish</span> <span>→</span>`;
        }
      }
    });
  }

  // Logout button
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      state.currentUser = null;
      localStorage.removeItem('urdpi_user');

      // Lock down application
      document.body.classList.add('not-authenticated');
      document.body.classList.remove('authenticated');

      if (topbarProfile) topbarProfile.style.display = 'none';
      if (loginModal) {
        loginModal.classList.remove('hidden');
        const userInput = document.getElementById('loginUsername');
        const passInput = document.getElementById('loginPassword');
        if (userInput) { userInput.value = ''; userInput.focus(); }
        if (passInput) passInput.value = '';
      }
      showToast('Tizimdan muvaffaqiyatli chiqildi', 'info');
    });
  }

  // Password change form
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentUser) return;

      const oldPassword = document.getElementById('oldPasswordInput').value;
      const newPassword = document.getElementById('newPasswordInput').value;

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: state.currentUser.id,
            oldPassword,
            newPassword
          })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Parolni yangilashda xatolik');
        }
        showToast('Parolingiz muvaffaqiyatli yangilandi!', 'success');
        changePasswordForm.reset();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // Check existing session on startup
  const savedUser = localStorage.getItem('urdpi_user');
  if (savedUser) {
    try {
      state.currentUser = JSON.parse(savedUser);
      // Valid session found -> unlock app
      document.body.classList.remove('not-authenticated');
      document.body.classList.add('authenticated');
      if (loginModal) loginModal.classList.add('hidden');
      applyUserRolePermissions();
      loadSeedData();
    } catch (e) {
      state.currentUser = null;
      localStorage.removeItem('urdpi_user');
      document.body.classList.add('not-authenticated');
      document.body.classList.remove('authenticated');
      if (topbarProfile) topbarProfile.style.display = 'none';
      if (loginModal) loginModal.classList.remove('hidden');
    }
  } else {
    // No session -> strictly lock down and display login screen
    state.currentUser = null;
    document.body.classList.add('not-authenticated');
    document.body.classList.remove('authenticated');
    if (topbarProfile) topbarProfile.style.display = 'none';
    if (loginModal) loginModal.classList.remove('hidden');
  }
}

function applyUserRolePermissions() {
  const user = state.currentUser;
  if (!user) return;

  const topbarProfile = document.getElementById('topbarUserProfile');
  if (topbarProfile) topbarProfile.style.display = 'flex';

  const topbarRoleBadge = document.getElementById('topbarRoleBadge');
  const topbarUserName = document.getElementById('topbarUserName');
  const topbarFacultyTag = document.getElementById('topbarFacultyTag');
  const facultyLockIndicator = document.getElementById('facultyLockIndicator');
  const auditorInput = document.getElementById('auditorInput');
  const adminSection = document.getElementById('adminUserManagementSection');
  const headerExcelBtn = document.getElementById('headerExcelDownloadBtn');

  // Update topbar identity
  if (user.role === 'admin') {
    if (topbarRoleBadge) {
      topbarRoleBadge.textContent = 'Admin';
      topbarRoleBadge.className = 'user-role-badge';
    }
    if (topbarUserName) topbarUserName.textContent = user.name || 'Jamshid Boltaboyev';
    if (topbarFacultyTag) topbarFacultyTag.textContent = user.facultyName || 'Barcha fakultetlar';
    if (facultyLockIndicator) facultyLockIndicator.innerHTML = '';
    if (adminSection) adminSection.style.display = 'block';

    const facSelect = document.getElementById('facultySelect');
    if (facSelect) facSelect.disabled = false;

    if (headerExcelBtn) {
      headerExcelBtn.href = '/api/excel/download';
      headerExcelBtn.title = 'Barcha fakultetlar umumiy Excel faylini yuklash';
    }

    loadAdminUsersList();
  } else {
    // Uslubchi
    if (topbarRoleBadge) {
      topbarRoleBadge.textContent = '🎓 Uslubchi';
      topbarRoleBadge.className = 'user-role-badge uslubchi';
    }
    if (topbarUserName) topbarUserName.textContent = user.name;
    if (topbarFacultyTag) topbarFacultyTag.textContent = user.facultyName;
    if (facultyLockIndicator) {
      facultyLockIndicator.innerHTML = `<span class="faculty-locked-badge">🔒 ${user.facultyName}</span>`;
    }
    if (auditorInput) {
      auditorInput.value = user.name;
    }
    if (adminSection) {
      adminSection.style.display = 'none';
    }

    const facSelect = document.getElementById('facultySelect');
    if (facSelect) facSelect.disabled = true;

    if (headerExcelBtn) {
      headerExcelBtn.href = `/api/excel/download?faculty=${encodeURIComponent(user.facultyId)}`;
      headerExcelBtn.title = `${user.facultyName} Excel faylini yuklab olish`;
    }
  }

  // Update Excel tab selection for uslubchi
  if (user.role === 'uslubchi' && user.facultyId) {
    state.activeExcelFaculty = user.facultyId;
    document.querySelectorAll('#excelFacultyTabs .excel-tab-btn').forEach(btn => {
      const match = btn.getAttribute('data-faculty') === user.facultyId;
      btn.style.display = match ? 'inline-flex' : 'none';
      btn.classList.toggle('active', match);
    });
    loadExcelGrid(user.facultyId);
  } else {
    // Admin: show all tabs
    document.querySelectorAll('#excelFacultyTabs .excel-tab-btn').forEach(btn => {
      btn.style.display = 'inline-flex';
    });
  }
}

async function loadAdminUsersList() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/auth/users');
    const users = await res.json();
    tbody.innerHTML = '';

    users.forEach(u => {
      const tr = document.createElement('tr');
      const isAdm = u.role === 'admin';
      tr.innerHTML = `
        <td style="font-weight:700;">${u.name}</td>
        <td><code>${u.username}</code></td>
        <td><span class="user-role-badge ${isAdm ? '' : 'uslubchi'}">${isAdm ? 'Admin' : 'Uslubchi'}</span></td>
        <td>${u.facultyName || '-'}</td>
        <td style="color:var(--text-dim);">${u.phone || '-'}</td>
        <td>
          <button type="button" class="chip-btn" data-reset-id="${u.id}" data-reset-name="${u.name}" style="font-size:0.75rem; padding:0.25rem 0.5rem;">
            🔑 Parol berish
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Bind password reset click
    tbody.querySelectorAll('button[data-reset-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uId = btn.getAttribute('data-reset-id');
        const uName = btn.getAttribute('data-reset-name');
        const newPass = prompt(`${uName} uchun yangi parolni kiriting:`, '123');
        if (!newPass || !newPass.trim()) return;

        try {
          const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uId, newPassword: newPass.trim(), isAdminReset: true })
          });
          const d = await res.json();
          if (d.success) {
            showToast(`${uName} paroli yangilandi!`, 'success');
          } else {
            showToast(d.error || 'Xatolik', 'error');
          }
        } catch (e) {
          showToast('Xatolik yuz berdi', 'error');
        }
      });
    });

  } catch (err) {
    console.error('Failed to load admin users:', err);
  }
}

// ================= 1. NAVIGATION =================
function initNavigation() {
  const allNavButtons = document.querySelectorAll('.nav-tab-btn, .mobile-tab-btn');
  
  allNavButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      switchTab(targetTabId);
    });
  });

  // Sidebar Mobile/Tablet Toggle
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggleBtn = document.getElementById('sidebarToggleBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');

  function openSidebar() {
    sidebar?.classList.add('open');
    backdrop?.classList.add('active');
  }

  function closeSidebar() {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('active');
  }

  toggleBtn?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  backdrop?.addEventListener('click', closeSidebar);

  // Store closeSidebar globally for switchTab
  window.closeSidebarDrawer = closeSidebar;
}

function switchTab(tabId) {
  // Update button active states
  document.querySelectorAll('.nav-tab-btn, .mobile-tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });

  // Switch visible section
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === tabId);
  });

  // Update Topbar page title & icon
  const pageTitles = {
    'tab-attendance': { icon: '', title: 'Xonada Davomat' },
    'tab-dashboard': { icon: '', title: 'Institut Monitoringi' },
    'tab-excel': { icon: '', title: 'Excel Jadvali' },
    'tab-settings': { icon: '', title: 'Sozlamalar' }
  };
  const currentInfo = pageTitles[tabId] || { icon: '', title: 'UrDPI Davomat' };
  const topbarIcon = document.getElementById('topbarPageIcon');
  const topbarTitle = document.getElementById('topbarPageTitle');
  if (topbarIcon) {
    topbarIcon.textContent = currentInfo.icon;
    topbarIcon.style.display = currentInfo.icon ? 'inline-block' : 'none';
  }
  if (topbarTitle) topbarTitle.textContent = currentInfo.title;

  // Close mobile sidebar if open
  if (window.closeSidebarDrawer) {
    window.closeSidebarDrawer();
  }

  // Action on tab entry
  if (tabId === 'tab-dashboard') {
    loadDashboardStats();
  } else if (tabId === 'tab-excel') {
    loadExcelGrid(state.activeExcelFaculty);
  }
}

// Schedule Detection Algorithm across 3 shifts & all pairs
function detectCurrentSchedule(now = new Date()) {
  const hour = now.getHours();
  const min = now.getMinutes();
  const timeVal = hour * 60 + min;

  // 1. Before 08:30
  if (timeVal < 8 * 60 + 30) {
    return {
      shiftId: 'kunduzgi-1',
      pair: 1,
      pairTime: '08:30 - 09:50',
      badgeText: 'Darslar boshlanishiga oz qoldi (08:30 da 1-para)',
      titleText: 'Darslar boshlanmagan',
      timeRangeText: 'Keyingi: 08:30 - 09:50',
      status: 'upcoming'
    };
  }

  // 2. Kunduzgi 1-smena: 1-para (08:30 - 09:50)
  if (timeVal >= 8 * 60 + 30 && timeVal < 9 * 60 + 50) {
    return {
      shiftId: 'kunduzgi-1',
      pair: 1,
      pairTime: '08:30 - 09:50',
      badgeText: '☀️ Kunduzgi (1-smena): 1-para davom etmoqda (08:30 - 09:50)',
      titleText: '1-para davom etmoqda',
      timeRangeText: '08:30 - 09:50',
      status: 'active'
    };
  }

  // 3. Tanaffus (09:50 - 10:00)
  if (timeVal >= 9 * 60 + 50 && timeVal < 10 * 60) {
    return {
      shiftId: 'kunduzgi-1',
      pair: 2,
      pairTime: '10:00 - 11:20',
      badgeText: '☕ Tanaffus (10:00 da 2-para boshlanadi)',
      titleText: 'Tanaffus (10 daqiqa)',
      timeRangeText: 'Keyingi: 10:00 - 11:20',
      status: 'break'
    };
  }

  // 4. Kunduzgi 1-smena: 2-para (10:00 - 11:20)
  if (timeVal >= 10 * 60 && timeVal < 11 * 60 + 20) {
    return {
      shiftId: 'kunduzgi-1',
      pair: 2,
      pairTime: '10:00 - 11:20',
      badgeText: '☀️ Kunduzgi (1-smena): 2-para davom etmoqda (10:00 - 11:20)',
      titleText: '2-para davom etmoqda',
      timeRangeText: '10:00 - 11:20',
      status: 'active'
    };
  }

  // 5. Tanaffus (11:20 - 11:30)
  if (timeVal >= 11 * 60 + 20 && timeVal < 11 * 60 + 30) {
    return {
      shiftId: 'kunduzgi-1',
      pair: 3,
      pairTime: '11:30 - 12:50',
      badgeText: '☕ Tanaffus (11:30 da 3-para boshlanadi)',
      titleText: 'Tanaffus (10 daqiqa)',
      timeRangeText: 'Keyingi: 11:30 - 12:50',
      status: 'break'
    };
  }

  // 6. Kunduzgi 1-smena: 3-para (11:30 - 12:50)
  if (timeVal >= 11 * 60 + 30 && timeVal < 12 * 60 + 50) {
    return {
      shiftId: 'kunduzgi-1',
      pair: 3,
      pairTime: '11:30 - 12:50',
      badgeText: '☀️ Kunduzgi (1-smena): 3-para davom etmoqda (11:30 - 12:50)',
      titleText: '3-para davom etmoqda',
      timeRangeText: '11:30 - 12:50',
      status: 'active'
    };
  }

  // 7. Katta tanaffus / Smena almashinuvi (12:50 - 13:00)
  if (timeVal >= 12 * 60 + 50 && timeVal < 13 * 60) {
    return {
      shiftId: 'kunduzgi-2',
      pair: 1,
      pairTime: '13:00 - 14:20',
      badgeText: '🔄 Smena almashinuvi (13:00 da 2-smena boshlanadi)',
      titleText: 'Katta tanaffus (10 daqiqa)',
      timeRangeText: 'Keyingi: 13:00 - 14:20',
      status: 'break'
    };
  }

  // 8. Kunduzgi 2-smena: 1-para (13:00 - 14:20)
  if (timeVal >= 13 * 60 && timeVal < 14 * 60 + 20) {
    return {
      shiftId: 'kunduzgi-2',
      pair: 1,
      pairTime: '13:00 - 14:20',
      badgeText: '🌤 Kunduzgi (2-smena): 1-para davom etmoqda (13:00 - 14:20)',
      titleText: '1-para davom etmoqda (2-smena)',
      timeRangeText: '13:00 - 14:20',
      status: 'active'
    };
  }

  // 9. Tanaffus (14:20 - 14:30)
  if (timeVal >= 14 * 60 + 20 && timeVal < 14 * 60 + 30) {
    return {
      shiftId: 'kunduzgi-2',
      pair: 2,
      pairTime: '14:30 - 15:50',
      badgeText: '☕ Tanaffus (14:30 da 2-para boshlanadi)',
      titleText: 'Tanaffus (10 daqiqa)',
      timeRangeText: 'Keyingi: 14:30 - 15:50',
      status: 'break'
    };
  }

  // 10. Kunduzgi 2-smena: 2-para (14:30 - 15:50)
  if (timeVal >= 14 * 60 + 30 && timeVal < 15 * 60 + 50) {
    return {
      shiftId: 'kunduzgi-2',
      pair: 2,
      pairTime: '14:30 - 15:50',
      badgeText: '🌤 Kunduzgi (2-smena): 2-para davom etmoqda (14:30 - 15:50)',
      titleText: '2-para davom etmoqda (2-smena)',
      timeRangeText: '14:30 - 15:50',
      status: 'active'
    };
  }

  // 11. Tanaffus (15:50 - 16:00)
  if (timeVal >= 15 * 60 + 50 && timeVal < 16 * 60) {
    return {
      shiftId: 'kunduzgi-2',
      pair: 3,
      pairTime: '16:00 - 17:20',
      badgeText: '☕ Tanaffus (16:00 da 3-para boshlanadi)',
      titleText: 'Tanaffus (10 daqiqa)',
      timeRangeText: 'Keyingi: 16:00 - 17:20',
      status: 'break'
    };
  }

  // 12. Kunduzgi 2-smena: 3-para (16:00 - 17:20)
  if (timeVal >= 16 * 60 && timeVal < 17 * 60 + 20) {
    return {
      shiftId: 'kunduzgi-2',
      pair: 3,
      pairTime: '16:00 - 17:20',
      badgeText: '🌤 Kunduzgi (2-smena): 3-para davom etmoqda (16:00 - 17:20)',
      titleText: '3-para davom etmoqda (2-smena)',
      timeRangeText: '16:00 - 17:20',
      status: 'active'
    };
  }

  // 13. Tanaffus / Kechkiga o'tish (17:20 - 17:30)
  if (timeVal >= 17 * 60 + 20 && timeVal < 17 * 60 + 30) {
    return {
      shiftId: 'kechki',
      pair: 1,
      pairTime: '17:30 - 18:50',
      badgeText: '🌙 Kechki ta\'limga o\'tish (17:30 da 1-para)',
      titleText: 'Tanaffus (10 daqiqa)',
      timeRangeText: 'Keyingi: 17:30 - 18:50',
      status: 'break'
    };
  }

  // 14. Kechki ta'lim: 1-para (17:30 - 18:50)
  if (timeVal >= 17 * 60 + 30 && timeVal < 18 * 60 + 50) {
    return {
      shiftId: 'kechki',
      pair: 1,
      pairTime: '17:30 - 18:50',
      badgeText: '🌙 Kechki ta\'lim: 1-para davom etmoqda (17:30 - 18:50)',
      titleText: '1-para davom etmoqda (Kechki)',
      timeRangeText: '17:30 - 18:50',
      status: 'active'
    };
  }

  // 15. Tanaffus (18:50 - 19:00)
  if (timeVal >= 18 * 60 + 50 && timeVal < 19 * 60) {
    return {
      shiftId: 'kechki',
      pair: 2,
      pairTime: '19:00 - 20:20',
      badgeText: '☕ Tanaffus (19:00 da 2-para boshlanadi)',
      titleText: 'Tanaffus (10 daqiqa)',
      timeRangeText: 'Keyingi: 19:00 - 20:20',
      status: 'break'
    };
  }

  // 16. Kechki ta'lim: 2-para (19:00 - 20:20)
  if (timeVal >= 19 * 60 && timeVal < 20 * 60 + 20) {
    return {
      shiftId: 'kechki',
      pair: 2,
      pairTime: '19:00 - 20:20',
      badgeText: '🌙 Kechki ta\'lim: 2-para davom etmoqda (19:00 - 20:20)',
      titleText: '2-para davom etmoqda (Kechki)',
      timeRangeText: '19:00 - 20:20',
      status: 'active'
    };
  }

  // 17. 20:20 dan keyin
  return {
    shiftId: 'kunduzgi-1',
    pair: 1,
    pairTime: '08:30 - 09:50',
    badgeText: 'Bugungi darslar yakunlandi (Ertaga 08:30 da 1-para)',
    titleText: 'Darslar yakunlangan',
    timeRangeText: 'Ertaga 08:30 da',
    status: 'ended'
  };
}

// Render pair selector buttons for a given shift
function renderShiftParaButtons(shiftId, preselectedPair = 1) {
  const container = document.getElementById('paraSelector');
  const shiftNotice = document.getElementById('currentShiftNotice');
  if (!container) return;

  const shift = SHIFTS_CONFIG[shiftId] || SHIFTS_CONFIG['kunduzgi-1'];
  if (shiftNotice) {
    shiftNotice.textContent = `${shift.icon} ${shift.name} • ${shift.pairs.length} ta para`;
  }

  // Kechki ta'limda aynan 2 ta para: repeat(2, 1fr)
  // Kunduzgi smenalarda 3 ta para: repeat(3, 1fr)
  container.className = `para-grid ${shift.pairs.length === 2 ? 'cols-2' : 'cols-3'}`;
  container.style.gridTemplateColumns = shift.pairs.length === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';

  container.innerHTML = '';
  shift.pairs.forEach(p => {
    const btn = document.createElement('div');
    const isActive = p.pair === preselectedPair;
    btn.className = `para-btn ${isActive ? 'active' : ''}`;
    btn.setAttribute('data-para', p.pair);
    btn.setAttribute('data-time', p.time);
    btn.innerHTML = `
      <div class="para-number">${p.name}</div>
      <div class="para-time">${p.time}</div>
    `;

    btn.addEventListener('click', () => {
      container.querySelectorAll('.para-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedPair = p.pair;
      state.pairTime = p.time;
      state.userManuallySelectedPair = true;
      updateHeroCard(detectCurrentSchedule(new Date()));
    });

    container.appendChild(btn);
  });
}

function updateHeroCard(schedule) {
  const heroCard = document.getElementById('activeLessonHeroCard');
  const pulseDot = document.getElementById('heroPulseDot');
  const liveStatusText = document.getElementById('heroLiveStatusText');
  const heroPairTitle = document.getElementById('heroPairTitle');
  const heroShiftSubtitle = document.getElementById('heroShiftSubtitle');
  const btnResetLive = document.getElementById('btnResetLiveSchedule');

  if (!heroCard) return;

  if (state.userManuallySelectedPair) {
    // Manual override state
    heroCard.className = 'active-lesson-hero-card manual-override';
    if (pulseDot) pulseDot.className = 'pulse-dot-blue';
    if (liveStatusText) liveStatusText.textContent = "QO'LDA TANLANGAN DARS";
    if (heroPairTitle) {
      heroPairTitle.innerHTML = `<span>${state.selectedPair}-para</span> <span style="font-size: 1.05rem; opacity: 0.85; font-family: 'JetBrains Mono', monospace; font-weight: 600;">(${state.pairTime})</span>`;
    }
    const currentShift = SHIFTS_CONFIG[state.selectedShift] || SHIFTS_CONFIG['kunduzgi-1'];
    if (heroShiftSubtitle) {
      heroShiftSubtitle.textContent = `${currentShift.icon} ${state.shiftName} • Qo'lda belgilangan dars davomati`;
    }
    if (btnResetLive) btnResetLive.style.display = 'inline-flex';
  } else {
    // Live real-time sync state
    if (btnResetLive) btnResetLive.style.display = 'none';

    if (schedule.status === 'active') {
      heroCard.className = 'active-lesson-hero-card';
      if (pulseDot) pulseDot.className = 'pulse-dot-green';
      if (liveStatusText) liveStatusText.textContent = 'JONLI FAOL DARS';
      if (heroPairTitle) {
        heroPairTitle.innerHTML = `<span>${schedule.pair}-para</span> <span style="font-size: 1.05rem; opacity: 0.85; font-family: 'JetBrains Mono', monospace; font-weight: 600;">(${schedule.pairTime})</span>`;
      }
      const currentShift = SHIFTS_CONFIG[schedule.shiftId] || SHIFTS_CONFIG['kunduzgi-1'];
      if (heroShiftSubtitle) {
        heroShiftSubtitle.textContent = `${currentShift.icon} ${currentShift.name} • Hozir dars vaqti`;
      }
    } else if (schedule.status === 'break') {
      heroCard.className = 'active-lesson-hero-card break-mode';
      if (pulseDot) pulseDot.className = 'pulse-dot-amber';
      if (liveStatusText) liveStatusText.textContent = 'TANAFFUS VAQTI';
      if (heroPairTitle) {
        heroPairTitle.innerHTML = `<span>${schedule.pair}-para</span> <span style="font-size: 1.05rem; opacity: 0.85; font-family: 'JetBrains Mono', monospace; font-weight: 600;">(${schedule.pairTime})</span>`;
      }
      const currentShift = SHIFTS_CONFIG[schedule.shiftId] || SHIFTS_CONFIG['kunduzgi-1'];
      if (heroShiftSubtitle) {
        heroShiftSubtitle.textContent = `${currentShift.icon} ${schedule.titleText} • ${schedule.badgeText}`;
      }
    } else {
      // before or ended
      heroCard.className = 'active-lesson-hero-card break-mode';
      if (pulseDot) pulseDot.className = 'pulse-dot-amber';
      if (liveStatusText) liveStatusText.textContent = 'TIZIM TAYYOR';
      if (heroPairTitle) {
        heroPairTitle.innerHTML = `<span>${schedule.pair}-para</span> <span style="font-size: 1.05rem; opacity: 0.85; font-family: 'JetBrains Mono', monospace; font-weight: 600;">(${schedule.pairTime})</span>`;
      }
      if (heroShiftSubtitle) {
        heroShiftSubtitle.textContent = `${schedule.titleText} • ${schedule.badgeText}`;
      }
    }
  }
}

// ================= 2. CLOCK & AUTO PAIR DETECTION =================
function initClockAndPair() {
  const clockEl = document.getElementById('headerLiveClock');
  const dateInput = document.getElementById('attendanceDate');
  const lessonBadge = document.getElementById('currentLessonBadge');
  const sidebarLessonTitle = document.getElementById('sidebarLessonTitle');
  const sidebarLessonTime = document.getElementById('sidebarLessonTime');
  const btnToggleManual = document.getElementById('btnToggleManualSchedule');
  const manualDrawer = document.getElementById('manualScheduleDrawer');
  const manualToggleText = document.getElementById('manualToggleText');
  const btnResetLive = document.getElementById('btnResetLiveSchedule');

  // Set today's date in form
  const today = new Date().toISOString().split('T')[0];
  if (dateInput) dateInput.value = today;

  // Toggle manual drawer
  if (btnToggleManual && manualDrawer) {
    btnToggleManual.addEventListener('click', () => {
      const isOpen = manualDrawer.classList.toggle('open');
      if (manualToggleText) {
        manualToggleText.textContent = isOpen ? "Yopish ▴" : "Boshqa para / smena ▾";
      }
    });
  }

  // Reset to live real-time schedule
  if (btnResetLive) {
    btnResetLive.addEventListener('click', () => {
      state.userManuallySelectedPair = false;
      const liveSchedule = detectCurrentSchedule(new Date());
      state.selectedShift = liveSchedule.shiftId;
      state.shiftName = SHIFTS_CONFIG[liveSchedule.shiftId]?.name || 'Kunduzgi (1-smena)';
      state.selectedPair = liveSchedule.pair;
      state.pairTime = liveSchedule.pairTime;

      document.querySelectorAll('.shift-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-shift') === liveSchedule.shiftId);
      });
      renderShiftParaButtons(liveSchedule.shiftId, liveSchedule.pair);
      updateHeroCard(liveSchedule);
      showToast(`Jonli dars vaqtiga qaytildi (${liveSchedule.pair}-para)`, 'success');
    });
  }

  // Auto detect current schedule on start
  const initial = detectCurrentSchedule(new Date());
  state.selectedShift = initial.shiftId;
  state.shiftName = SHIFTS_CONFIG[initial.shiftId].name;
  state.selectedPair = initial.pair;
  state.pairTime = initial.pairTime;

  // Set active shift button
  document.querySelectorAll('.shift-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-shift') === initial.shiftId);
  });

  // Render initial buttons
  renderShiftParaButtons(initial.shiftId, initial.pair);

  // Shift tabs click listeners
  document.querySelectorAll('.shift-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.shift-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const shiftId = btn.getAttribute('data-shift');
      state.selectedShift = shiftId;
      state.shiftName = SHIFTS_CONFIG[shiftId].name;
      state.userManuallySelectedPair = true;

      // Keep pair if exists in that shift, otherwise reset to 1
      const available = SHIFTS_CONFIG[shiftId].pairs;
      const validPair = available.find(p => p.pair === state.selectedPair) ? state.selectedPair : 1;
      state.selectedPair = validPair;
      const matched = available.find(p => p.pair === validPair);
      state.pairTime = matched ? matched.time : available[0].time;

      renderShiftParaButtons(shiftId, state.selectedPair);
      updateHeroCard(detectCurrentSchedule(new Date()));
    });
  });

  function updateTime() {
    const now = new Date();
    if (clockEl) clockEl.textContent = now.toLocaleTimeString('uz-UZ');

    const schedule = detectCurrentSchedule(now);

    if (lessonBadge) lessonBadge.textContent = schedule.badgeText;
    if (sidebarLessonTitle) sidebarLessonTitle.textContent = schedule.titleText;
    if (sidebarLessonTime) sidebarLessonTime.textContent = schedule.timeRangeText;

    // Auto-update form if user hasn't manually clicked another shift/pair
    if (!state.userManuallySelectedPair) {
      if (state.selectedShift !== schedule.shiftId || state.selectedPair !== schedule.pair) {
        state.selectedShift = schedule.shiftId;
        state.shiftName = SHIFTS_CONFIG[schedule.shiftId]?.name || 'Kunduzgi (1-smena)';
        state.selectedPair = schedule.pair;
        state.pairTime = schedule.pairTime;

        document.querySelectorAll('.shift-tab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-shift') === schedule.shiftId);
        });
        renderShiftParaButtons(schedule.shiftId, schedule.pair);
      }
    }

    updateHeroCard(schedule);
  }

  updateTime();
  setInterval(updateTime, 1000);
}

// ================= 3. LOAD INITIAL DATA =================
async function loadSeedData() {
  try {
    const [facsRes, teachersRes, roomsRes] = await Promise.all([
      fetch('/api/faculties').then(r => r.json()),
      fetch('/api/teachers').then(r => r.json()),
      fetch('/api/rooms').then(r => r.json())
    ]);

    state.faculties = facsRes;
    state.teachers = teachersRes;
    state.rooms = roomsRes;

    populateFacultiesDropdown();
    populateRoomsDatalist();
    populateTeachersDatalist();

    // Default select faculty based on role
    const isUslubchi = state.currentUser && state.currentUser.role === 'uslubchi' && state.currentUser.facultyId;
    if (isUslubchi) {
      onFacultyChange(state.currentUser.facultyId);
    } else if (state.faculties.length > 0) {
      onFacultyChange(state.faculties[0].id);
    }

    // Load initial dashboard stats
    loadDashboardStats();
  } catch (err) {
    console.error('Failed to load initial data:', err);
    showToast('Baza bilan bog\'lanishda xatolik', 'error');
  }
}

function populateFacultiesDropdown() {
  const facSelect = document.getElementById('facultySelect');
  const settingsFacSelect = document.getElementById('settingsFacultySelect');
  if (!facSelect) return;

  facSelect.innerHTML = '';
  if (settingsFacSelect) settingsFacSelect.innerHTML = '';

  const isUslubchi = state.currentUser && state.currentUser.role === 'uslubchi' && state.currentUser.facultyId;
  const facultiesToRender = isUslubchi 
    ? state.faculties.filter(f => f.id === state.currentUser.facultyId)
    : state.faculties;

  facultiesToRender.forEach(fac => {
    const opt = document.createElement('option');
    opt.value = fac.id;
    opt.textContent = fac.name;
    facSelect.appendChild(opt);

    if (settingsFacSelect) {
      const opt2 = document.createElement('option');
      opt2.value = fac.id;
      opt2.textContent = fac.name;
      settingsFacSelect.appendChild(opt2);
    }
  });

  if (isUslubchi) {
    facSelect.value = state.currentUser.facultyId;
    facSelect.disabled = true;
    if (settingsFacSelect) {
      settingsFacSelect.value = state.currentUser.facultyId;
      settingsFacSelect.disabled = true;
    }
  } else {
    facSelect.disabled = false;
    if (settingsFacSelect) settingsFacSelect.disabled = false;
  }

  facSelect.addEventListener('change', (e) => onFacultyChange(e.target.value));
}

function onFacultyChange(facultyId) {
  state.selectedFaculty = state.faculties.find(f => f.id === facultyId) || state.faculties[0];
  const dirSelect = document.getElementById('directionSelect');
  if (!dirSelect || !state.selectedFaculty) return;

  dirSelect.innerHTML = '';
  state.selectedFaculty.directions.forEach(dir => {
    const opt = document.createElement('option');
    opt.value = dir.id;
    opt.textContent = dir.name;
    dirSelect.appendChild(opt);
  });

  if (state.selectedFaculty.directions.length > 0) {
    onDirectionChange(state.selectedFaculty.directions[0].id);
  }
}

function onDirectionChange(directionId) {
  state.selectedDirection = state.selectedFaculty?.directions.find(d => d.id === directionId);
  const grpSelect = document.getElementById('groupSelect');
  if (!grpSelect || !state.selectedDirection) return;

  grpSelect.innerHTML = '';
  state.selectedDirection.groups.forEach(grp => {
    const opt = document.createElement('option');
    opt.value = grp.id;
    opt.textContent = `${grp.name} (${grp.course}-kurs) - HEMIS: ${grp.hemis || 25}`;
    grpSelect.appendChild(opt);
  });

  if (state.selectedDirection.groups.length > 0) {
    onGroupChange(state.selectedDirection.groups[0].id);
  }
}

function onGroupChange(groupId) {
  state.selectedGroup = state.selectedDirection?.groups.find(g => g.id === groupId);
  if (!state.selectedGroup) return;

  state.hemisTotal = state.selectedGroup.hemis || 25;
  state.presentCount = state.hemisTotal; // default all present

  // Update UI indicators
  const badge = document.getElementById('groupHemisBadge');
  if (badge) badge.textContent = `HEMIS: ${state.hemisTotal} talaba`;

  const totalDisplay = document.getElementById('totalNumberDisplay');
  if (totalDisplay) totalDisplay.textContent = `/ HEMISda ${state.hemisTotal} ta`;

  const slider = document.getElementById('attendanceSlider');
  if (slider) {
    slider.max = state.hemisTotal;
    slider.value = state.presentCount;
  }

  updateCounterDisplay();

  // If in roster mode, fetch student list
  if (state.mode === 'roster') {
    fetchStudentRoster(state.selectedGroup.id);
  }
}

function populateRoomsDatalist() {
  const datalist = document.getElementById('roomsDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  state.rooms.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.name;
    datalist.appendChild(opt);
  });
}

function populateTeachersDatalist() {
  const datalist = document.getElementById('teachersDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';
  state.teachers.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name;
    datalist.appendChild(opt);
  });
}

// ================= 4. FORM INTERACTIONS & COUNTER =================
function initFormInteractions() {
  const dirSelect = document.getElementById('directionSelect');
  const grpSelect = document.getElementById('groupSelect');

  if (dirSelect) {
    dirSelect.addEventListener('change', (e) => onDirectionChange(e.target.value));
  }
  if (grpSelect) {
    grpSelect.addEventListener('change', (e) => onGroupChange(e.target.value));
  }

  // Room Chips click
  const roomInput = document.getElementById('roomInput');
  document.querySelectorAll('#roomChips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#roomChips .chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const r = btn.getAttribute('data-room');
      state.selectedRoom = r;
      if (roomInput) roomInput.value = r;
    });
  });

  if (roomInput) {
    roomInput.addEventListener('input', (e) => {
      state.selectedRoom = e.target.value;
    });
  }

  // Teacher present toggle
  const teacherCheck = document.getElementById('teacherPresentCheck');
  const teacherStatusLabel = document.getElementById('teacherStatusLabel');
  if (teacherCheck && teacherStatusLabel) {
    teacherCheck.addEventListener('change', () => {
      if (teacherCheck.checked) {
        teacherStatusLabel.textContent = '(Ha, darsda)';
        teacherStatusLabel.style.color = 'var(--status-good)';
      } else {
        teacherStatusLabel.textContent = '(Yo\'q, darsda emas)';
        teacherStatusLabel.style.color = 'var(--status-bad)';
      }
    });
  }

  // Mode Switcher: Quick vs Roster
  const btnQuick = document.getElementById('btnModeQuick');
  const btnRoster = document.getElementById('btnModeRoster');
  const quickPanel = document.getElementById('quickCounterPanel');
  const rosterPanel = document.getElementById('rosterCheckPanel');

  btnQuick.addEventListener('click', () => {
    state.mode = 'quick';
    btnQuick.classList.add('active');
    btnRoster.classList.remove('active');
    quickPanel.style.display = 'block';
    rosterPanel.classList.remove('active');
  });

  btnRoster.addEventListener('click', () => {
    state.mode = 'roster';
    btnRoster.classList.add('active');
    btnQuick.classList.remove('active');
    quickPanel.style.display = 'none';
    rosterPanel.classList.add('active');
    if (state.selectedGroup) {
      fetchStudentRoster(state.selectedGroup.id);
    }
  });

  // Quick Counter Buttons & Slider
  const btnMinus = document.getElementById('btnStepMinus');
  const btnPlus = document.getElementById('btnStepPlus');
  const slider = document.getElementById('attendanceSlider');

  btnMinus.addEventListener('click', () => {
    if (state.presentCount > 0) {
      state.presentCount--;
      if (slider) slider.value = state.presentCount;
      updateCounterDisplay();
    }
  });

  btnPlus.addEventListener('click', () => {
    if (state.presentCount < state.hemisTotal) {
      state.presentCount++;
      if (slider) slider.value = state.presentCount;
      updateCounterDisplay();
    }
  });

  if (slider) {
    slider.addEventListener('input', (e) => {
      state.presentCount = parseInt(e.target.value, 10);
      updateCounterDisplay();
    });
  }

  // Form Submission
  const form = document.getElementById('attendanceWalkForm');
  if (form) {
    form.addEventListener('submit', handleAttendanceSubmit);
  }
}

function updateCounterDisplay() {
  const numberDisplay = document.getElementById('presentNumberDisplay');
  const rateBadge = document.getElementById('attendanceRateBadge');
  const rateText = document.getElementById('ratePercentText');
  const missingText = document.getElementById('missingStudentsText');

  if (numberDisplay) numberDisplay.textContent = state.presentCount;

  const rate = state.hemisTotal > 0 ? (state.presentCount / state.hemisTotal) * 100 : 0;
  const rateFormatted = rate.toFixed(1) + '%';
  const missingCount = state.hemisTotal - state.presentCount;

  if (rateText) rateText.textContent = rateFormatted;

  if (rateBadge) {
    rateBadge.className = 'rate-badge ' + (rate >= 90 ? 'good' : (rate >= 80 ? 'warn' : 'bad'));
    rateBadge.firstElementChild.textContent = rate >= 90 ? '🟢' : (rate >= 80 ? '🟡' : '🔴');
  }

  if (missingText) {
    if (missingCount === 0) {
      missingText.textContent = 'Barcha talabalar to\'liq darsda';
      missingText.style.color = '#34d399';
    } else {
      missingText.textContent = `${missingCount} ta talaba darsda yo'q (${state.presentCount} ta qatnashmoqda)`;
      missingText.style.color = '#fb7185';
    }
  }
}

// Student Roster Fetch & Actions
async function fetchStudentRoster(groupId) {
  try {
    const res = await fetch(`/api/students/${encodeURIComponent(groupId)}`);
    const list = await res.json();
    state.studentRoster = list;
    renderStudentRoster();
  } catch (err) {
    console.error('Error loading roster:', err);
  }
}

function renderStudentRoster() {
  const container = document.getElementById('rosterListContainer');
  const badge = document.getElementById('rosterCountBadge');
  if (!container) return;

  badge.textContent = state.studentRoster.length;
  container.innerHTML = '';

  state.studentRoster.forEach((student, idx) => {
    const row = document.createElement('div');
    row.className = 'roster-item';
    row.innerHTML = `
      <div class="student-info">
        <span class="student-num">${idx + 1}.</span>
        <div>
          <div class="student-name">${student.fullName}</div>
          <div style="font-size:0.7rem; color:var(--text-dim);">ID: ${student.hemisId || '-'}</div>
        </div>
      </div>
      <div class="student-actions">
        <button type="button" class="status-pill present ${student.status === 'present' ? 'active' : ''}" data-idx="${idx}" data-status="present">Bor</button>
        <button type="button" class="status-pill absent ${student.status === 'absent' ? 'active' : ''}" data-idx="${idx}" data-status="absent">Yo'q</button>
        <button type="button" class="status-pill excused ${student.status === 'excused' ? 'active' : ''}" data-idx="${idx}" data-status="excused">Sababli</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Bind status pill clicks
  container.querySelectorAll('.status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const status = btn.getAttribute('data-status');
      state.studentRoster[idx].status = status;

      // Update active classes for this student row
      const parent = btn.parentElement;
      parent.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');

      // Recalculate present count from roster
      const presents = state.studentRoster.filter(s => s.status === 'present').length;
      state.presentCount = presents;
      const slider = document.getElementById('attendanceSlider');
      if (slider) slider.value = presents;
      updateCounterDisplay();
    });
  });

  // "Barchasi bor" button
  const btnAll = document.getElementById('btnAllPresent');
  if (btnAll) {
    btnAll.onclick = () => {
      state.studentRoster.forEach(s => s.status = 'present');
      renderStudentRoster();
      state.presentCount = state.studentRoster.length;
      const slider = document.getElementById('attendanceSlider');
      if (slider) slider.value = state.presentCount;
      updateCounterDisplay();
    };
  }
}

// Submit Attendance to Backend & Excel
async function handleAttendanceSubmit(e) {
  e.preventDefault();

  const btnSubmit = document.getElementById('btnSubmitAttendance');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span>⏳</span> Saqlanmoqda va Excelga yozilmoqda...`;

  try {
    const roomInput = document.getElementById('roomInput');
    const teacherInput = document.getElementById('teacherInput');
    const subjectInput = document.getElementById('subjectInput');
    const dateInput = document.getElementById('attendanceDate');
    const notesInput = document.getElementById('notesInput');
    const auditorInput = document.getElementById('auditorInput');
    const teacherCheck = document.getElementById('teacherPresentCheck');

    const absentList = state.studentRoster
      .filter(s => s.status === 'absent' || s.status === 'excused')
      .map(s => s.fullName);

    const assignedFacultyId = (state.currentUser?.role === 'uslubchi' && state.currentUser.facultyId) 
      ? state.currentUser.facultyId 
      : (state.selectedFaculty?.id || 'aniq-fanlar');

    const auditorName = auditorInput?.value || state.currentUser?.name || 'Inspektor';

    const payload = {
      facultyId: assignedFacultyId,
      groupId: state.selectedGroup?.name || '261-Fizika',
      date: dateInput.value,
      shift: state.selectedShift,
      shiftName: state.shiftName,
      pair: state.selectedPair,
      pairTime: state.pairTime,
      room: roomInput.value || state.selectedRoom,
      teacher: teacherInput.value,
      teacherPresent: teacherCheck ? teacherCheck.checked : true,
      subject: subjectInput.value,
      presentCount: state.presentCount,
      hemisTotal: state.hemisTotal,
      absentStudents: absentList,
      photoBase64: state.currentPhotoBase64 || null,
      notes: notesInput.value,
      auditor: auditorName
    };

    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Xatolik yuz berdi');
    }

    showToast(data.message, 'success');
    resetPhotoAudit();

    // Trigger celebration / refresh
    btnSubmit.innerHTML = `<span>✅</span> Saqlandi va Excel yangilandi!`;
    setTimeout(() => {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>✅</span> Saqlash va DAVOMAT.xlsx ga Yozish`;
    }, 2000);

    // Refresh dashboard stats in background
    loadDashboardStats();

  } catch (err) {
    console.error('Submit error:', err);
    showToast('Davomat saqlashda xatolik: ' + err.message, 'error');
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<span>❌ Qaytadan urinish</span>`;
  }
}

// ================= 5. DASHBOARD ANALYTICS =================
function initDashboardEvents() {
  const refreshBtn = document.getElementById('btnRefreshStats');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadDashboardStats);
  }

  const telegramBtn = document.getElementById('btnSendTelegramReport');
  if (telegramBtn) {
    telegramBtn.addEventListener('click', sendTelegramTestReport);
  }
}

async function loadDashboardStats() {
  try {
    const user = state.currentUser;
    const isScoped = user && user.role === 'uslubchi' && user.facultyId;
    const fetchUrl = isScoped 
      ? `/api/attendance/stats?facultyId=${encodeURIComponent(user.facultyId)}`
      : '/api/attendance/stats';

    const res = await fetch(fetchUrl);
    const stats = await res.json();

    // 1. KPI Cards
    const kpiRate = document.getElementById('kpiOverallRate');
    const kpiStudents = document.getElementById('kpiTotalStudents');
    const kpiAudited = document.getElementById('kpiAuditedGroups');
    const kpiOverallLabel = document.getElementById('kpiOverallLabel');
    const kpiTotalLabel = document.getElementById('kpiTotalLabel');
    const kpiStudentsSub = document.getElementById('kpiTotalSubtext');
    const comparisonTitle = document.getElementById('facultyComparisonTitle');
    const comparisonSubtitle = document.getElementById('facultyComparisonSubtitle');

    if (kpiRate) kpiRate.textContent = stats.overallAttendanceRate + '%';
    if (kpiStudents) kpiStudents.textContent = stats.totalInstituteStudents.toLocaleString();
    if (kpiAudited) kpiAudited.textContent = stats.totalAuditedGroups;

    if (stats.isScoped && stats.facultyScope) {
      if (kpiOverallLabel) kpiOverallLabel.textContent = "Fakultet Davomati";
      if (kpiTotalLabel) kpiTotalLabel.textContent = "Fakultet Talabalari";
      if (kpiStudentsSub) kpiStudentsSub.textContent = `${stats.totalGroups} ta guruh (${stats.facultyScope.shortName})`;
      if (comparisonTitle) comparisonTitle.textContent = `${stats.facultyScope.shortName} — Yo'nalishlar Ko'rsatkichi`;
      if (comparisonSubtitle) comparisonSubtitle.textContent = "Fakultet yo'nalishlari kesimidagi jonli davomat reytingi";
    } else {
      if (kpiOverallLabel) kpiOverallLabel.textContent = "Institut Umumiy Davomati";
      if (kpiTotalLabel) kpiTotalLabel.textContent = "Jami Institut Talabalari";
      if (kpiStudentsSub) kpiStudentsSub.textContent = `5 ta fakultet, ${stats.totalGroups} ta guruh`;
      if (comparisonTitle) comparisonTitle.textContent = "5 ta Fakultet Bo'yicha Jonli Davomat Ko'rsatkichi";
      if (comparisonSubtitle) comparisonSubtitle.textContent = "Real vaqt rejimida barcha fakultetlarning qatnashish reytingi";
    }

    // 2. Comparison Bars (Directions for Uslubchi, Faculties for Admin)
    const facList = document.getElementById('facultyComparisonList');
    if (facList) {
      facList.innerHTML = '';
      const listToRender = stats.isScoped ? (stats.directionStats || []) : (stats.facultyStats || []);

      listToRender.forEach(itemData => {
        const item = document.createElement('div');
        item.className = 'faculty-row-item';
        
        let barColor = 'var(--primary-gradient)';
        if (itemData.attendanceRate >= 90) barColor = 'var(--success-gradient)';
        else if (itemData.attendanceRate >= 80) barColor = 'var(--warning-gradient)';
        else if (itemData.attendanceRate > 0) barColor = 'var(--danger-gradient)';

        item.innerHTML = `
          <div class="faculty-meta-row">
            <div>
              <div class="fac-title">${itemData.name}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${itemData.totalGroups} ta guruh | HEMIS: ${itemData.totalStudents} talaba</div>
            </div>
            <div style="text-align:right;">
              <div class="fac-stat" style="color: ${itemData.attendanceRate >= 90 ? '#34d399' : (itemData.attendanceRate >= 80 ? '#fbbf24' : '#fb7185')};">
                ${itemData.attendanceRate > 0 ? itemData.attendanceRate + '%' : 'Kutilmoqda'}
              </div>
              <span class="chip-btn" style="font-size:0.68rem; padding:0.15rem 0.4rem;">${itemData.status || 'Kutilmoqda'}</span>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${itemData.attendanceRate || 0}%; background: ${barColor};"></div>
          </div>
          <div class="fac-details-sub">
            <span>Tekshirilgan: ${itemData.checkedGroups || 0} ta guruh</span>
            <span>Qatnashgan: ${itemData.presentStudents || 0} ta</span>
          </div>
        `;
        facList.appendChild(item);
      });
    }

    // 3. Pair & Shift Breakdown
    const pairContainer = document.getElementById('pairStatsContainer');
    if (pairContainer && stats.pairs) {
      pairContainer.innerHTML = '';

      if (stats.shifts && stats.shifts.length > 0) {
        const shiftsHeader = document.createElement('div');
        shiftsHeader.style.cssText = 'display:grid; grid-template-columns:repeat(3, 1fr); gap:0.4rem; margin-bottom:0.75rem;';
        stats.shifts.forEach(s => {
          shiftsHeader.innerHTML += `
            <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-subtle); border-radius:10px; padding:0.6rem 0.4rem; text-align:center;">
              <div style="font-size:0.75rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${s.icon} ${s.shortName || s.name}</div>
              <div style="font-size:0.65rem; color:var(--text-dim); font-family:'JetBrains Mono'; margin:0.15rem 0;">${s.hours}</div>
              <div style="font-size:0.95rem; font-weight:800; color:#38bdf8;">${s.rate}%</div>
            </div>
          `;
        });
        pairContainer.appendChild(shiftsHeader);
      }

      stats.pairs.forEach(p => {
        const pRow = document.createElement('div');
        pRow.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid var(--border-subtle); border-radius:12px; padding:0.85rem;';
        pRow.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
            <span style="font-weight:700; font-size:0.9rem;">${p.name}</span>
            <span style="font-weight:800; font-family:'JetBrains Mono'; color:#38bdf8;">${p.rate}%</span>
          </div>
          <div class="progress-track" style="height:6px;">
            <div class="progress-fill" style="width: ${p.rate}%;"></div>
          </div>
          <div style="font-size:0.72rem; color:var(--text-dim); margin-top:0.3rem;">
            ${p.checkedCount} ta guruh tekshirildi
          </div>
        `;
        pairContainer.appendChild(pRow);
      });
    }

    // 4. Live Audits Stream
    const auditStream = document.getElementById('auditStreamList');
    if (auditStream && stats.recentLogs) {
      auditStream.innerHTML = '';
      if (stats.recentLogs.length === 0) {
        auditStream.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-dim);">Hozircha tekshiruvlar yo'q</div>`;
      } else {
        stats.recentLogs.forEach(log => {
          const card = document.createElement('div');
          card.className = 'audit-card';
          const rate = log.hemisTotal > 0 ? ((log.presentCount / log.hemisTotal) * 100).toFixed(0) : 100;
          const shiftLabel = log.shiftName ? `${log.shiftName} • ` : '';
          const timeLabel = log.pairTime ? ` (${log.pairTime})` : '';

          const photoBtnHtml = log.photoUrl ? `
            <button type="button" class="audit-photo-btn" 
              data-photo="${log.photoUrl}" 
              data-title="${log.groupId} • ${log.room}" 
              data-meta="O'qituvchi: ${log.teacher || 'Belgilanmagan'} • ${log.pair}-para" 
              data-auditor="${log.auditor || 'Uslubchi'}" 
              data-time="${log.time || ''} ${log.date || ''}"
              title="Auditoriya dars rasmini ko'rish">
              <span>📸</span> Foto-fakt
            </button>
          ` : '';

          const noteText = (log.notes && String(log.notes).trim()) ? String(log.notes).trim() : '';
          const noteBtnHtml = noteText ? `
            <button type="button" class="audit-note-btn" 
              data-note="${encodeURIComponent(noteText)}"
              data-group="${encodeURIComponent(log.groupId || '')}"
              data-auditor="${encodeURIComponent(log.auditor || 'Uslubchi')}"
              data-time="${encodeURIComponent((log.time || '') + ' ' + (log.date || ''))}"
              title="Eslatma: ${noteText.replace(/"/g, '&quot;')} (Bosilsa to'liq ko'rsatiladi)">
              <span>📝</span> ${noteText.length > 20 ? noteText.slice(0, 18) + '...' : noteText}
            </button>
          ` : '';

          const actionsHtml = (photoBtnHtml || noteBtnHtml) ? `
            <div class="audit-actions-row">
              ${photoBtnHtml}
              ${noteBtnHtml}
            </div>
          ` : '';

          card.innerHTML = `
            <div class="audit-left">
              <span class="audit-room-tag">${log.room}</span>
              <div>
                <div class="audit-group-title">${log.groupId}</div>
                <div class="audit-subinfo">${log.teacher} • ${log.subject} (${shiftLabel}${log.pair}-para${timeLabel})</div>
              </div>
            </div>
            <div class="audit-right">
              <div class="audit-rate-num" style="color: ${rate >= 90 ? '#16a34a' : (rate >= 80 ? '#d97706' : '#dc2626')};">
                ${rate}%
              </div>
              <div class="audit-time-tag">${log.time || '10:00'} • ${log.presentCount}/${log.hemisTotal}</div>
              ${actionsHtml}
            </div>
          `;
          auditStream.appendChild(card);
        });

        // Attach click listeners for photo buttons
        auditStream.querySelectorAll('.audit-photo-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const photoUrl = btn.getAttribute('data-photo');
            const title = btn.getAttribute('data-title');
            const meta = btn.getAttribute('data-meta');
            const auditor = btn.getAttribute('data-auditor');
            const time = btn.getAttribute('data-time');
            openPhotoModal(photoUrl, title, meta, auditor, time);
          });
        });

        // Attach click listeners for note buttons
        auditStream.querySelectorAll('.audit-note-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const note = decodeURIComponent(btn.getAttribute('data-note') || '');
            const group = decodeURIComponent(btn.getAttribute('data-group') || '');
            const auditor = decodeURIComponent(btn.getAttribute('data-auditor') || '');
            showToast(`<b>📝 ${group}</b> (${auditor}):<br>${note}`, 'info');
          });
        });
      }
    }

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Telegram Test Report (Institute or Scoped Faculty)
async function sendTelegramTestReport() {
  try {
    const facultyId = state.currentUser?.role === 'uslubchi' ? state.currentUser.facultyId : null;
    const res = await fetch('/api/telegram/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facultyId })
    });
    const data = await res.json();
    showToast(data.message, 'success');
  } catch (e) {
    showToast('Telegram xizmati bilan bog\'lanishda xato', 'error');
  }
}

// ================= 6. EXCEL VIEWER =================
function initExcelViewer() {
  const tabs = document.querySelectorAll('#excelFacultyTabs .excel-tab-btn');
  const downloadLink = document.getElementById('btnDownloadFacultyExcel');
  const printBtn = document.getElementById('btnPrintExcelTable');

  // Faculty name lookup for print heading
  const facultyDisplayNames = {
    'aniq-fanlar': 'ANIQ FANLAR OLIY MAKTABI',
    'filologiya': 'FILOLOGIYA FAKULTETI',
    'ijtimoiy-amaliy': 'IJTIMOIY VA AMALIY FANLAR FAKULTETI',
    'boshlangich-talim': "BOSHLANG'ICH TA'LIM FAKULTETI",
    'pedagogika': 'PEDAGOGIKA FAKULTETI'
  };

  // Tab switching: update active tab, load grid, update download link
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const facId = btn.getAttribute('data-faculty');
      state.activeExcelFaculty = facId;
      loadExcelGrid(facId);

      // Update download link for the selected faculty
      if (downloadLink) {
        downloadLink.href = '/api/excel/download?faculty=' + encodeURIComponent(facId);
      }
    });
  });

  // Print button: populate heading, date, then trigger print
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      // Update the print heading with current faculty name
      const headingEl = document.getElementById('printFacultyHeading');
      if (headingEl) {
        headingEl.textContent = facultyDisplayNames[state.activeExcelFaculty] || state.activeExcelFaculty.toUpperCase();
      }

      // Update print date
      const dateSpan = document.getElementById('printDateSpan');
      if (dateSpan) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        dateSpan.textContent = `${dd}.${mm}.${yyyy}`;
      }

      // Update week span
      const weekSpan = document.getElementById('printWeekSpan');
      if (weekSpan) {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset);
        const saturday = new Date(monday);
        saturday.setDate(monday.getDate() + 5);

        const fmt = (d) => {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `${dd}.${mm}`;
        };
        weekSpan.textContent = `${fmt(monday)} - ${fmt(saturday)}.${now.getFullYear()}`;
      }

      // Small delay to let DOM update, then print
      setTimeout(() => {
        window.print();
      }, 100);
    });
  }

  // Initial load respecting user role
  const initialFac = (state.currentUser?.role === 'uslubchi' && state.currentUser.facultyId)
    ? state.currentUser.facultyId
    : 'aniq-fanlar';
  state.activeExcelFaculty = initialFac;
  loadExcelGrid(initialFac);
}


async function loadExcelGrid(facultyId) {
  const thead = document.getElementById('excelTableHead');
  const tbody = document.getElementById('excelTableBody');
  if (!thead || !tbody) return;

  thead.innerHTML = '<tr><th colspan="20" style="padding:1.5rem;">Yuklanmoqda...</th></tr>';
  tbody.innerHTML = '';

  try {
    const res = await fetch(`/api/excel/grid/${encodeURIComponent(facultyId)}`);
    const data = await res.json();
    const rows = data.grid;

    if (!rows || rows.length === 0) {
      thead.innerHTML = '<tr><th>Ma\'lumot topilmadi</th></tr>';
      return;
    }

    // Row 3 is typically the headers: 'Fakultet', 'Kurs', 'Guruhlar', 'HEMISDA', Dushanba...
    // Row 2 is dates
    let headHtml = '';
    const r2 = rows.find(r => r.rowNumber === 2);
    const r3 = rows.find(r => r.rowNumber === 3);

    if (r2 && r3) {
      headHtml += '<tr>';
      headHtml += `<th rowspan="2" class="col-sticky-kurs">Kurs</th><th rowspan="2" class="col-sticky-guruh">Guruh</th><th rowspan="2" class="col-sticky-hemis">HEMIS</th>`;
      headHtml += `<th colspan="4">DUSHANBA</th><th colspan="4">SESHANBA</th><th colspan="4">CHORSHANBA</th><th colspan="4">PAYSHANBA</th><th colspan="4">JUMA</th><th colspan="4">SHANBA</th><th rowspan="2">HAFTA %</th>`;
      headHtml += '</tr><tr>';
      for (let day = 0; day < 6; day++) {
        headHtml += `<th>1-p</th><th>2-p</th><th>3-p</th><th>Kun %</th>`;
      }
      headHtml += '</tr>';
    }
    thead.innerHTML = headHtml;

    // Separate data rows and calculate faculty HEMIS total
    const dataRows = rows.filter(r => r.rowNumber >= 4 && !String(r.values[2] || '').includes('JAMI'));
    const totalHemisFaculty = dataRows.reduce((sum, r) => sum + (parseFloat(r.values[3]) || 0), 0);

    // Body rows (Row 4 onwards)
    let bodyHtml = '';
    rows.filter(r => r.rowNumber >= 4).forEach(r => {
      const vals = r.values;
      const isTotalRow = String(vals[2] || '').includes('JAMI');
      
      bodyHtml += `<tr class="${isTotalRow ? 'total-row' : ''}">`;
      bodyHtml += `<td class="col-sticky-kurs">${vals[1] || ''}</td>`;
      bodyHtml += `<td class="col-sticky-guruh" style="text-align:left; font-weight:700;">${vals[2] || ''}</td>`;
      
      const hemisDisplay = isTotalRow ? (totalHemisFaculty || vals[3] || '') : (vals[3] || '');
      bodyHtml += `<td class="col-sticky-hemis" style="font-weight:700; color:#38bdf8;">${hemisDisplay}</td>`;

      // 6 days * 4 columns (1-p, 2-p, 3-p, %)
      const rowDayPcts = [];
      for (let c = 4; c < 28; c++) {
        const val = vals[c];
        const isPct = (c - 4) % 4 === 3;
        let cellClass = isPct ? 'pct-cell' : '';
        let displayVal = val !== undefined && val !== null ? val : '';

        if (isTotalRow) {
          if (!isPct) {
            // Pair column sum (1-p, 2-p, 3-p) across all groups in this faculty
            let colSum = 0;
            let hasAny = false;
            dataRows.forEach(dr => {
              const num = parseFloat(dr.values[c]);
              if (!isNaN(num) && num > 0) {
                colSum += num;
                hasAny = true;
              }
            });
            displayVal = hasAny ? colSum : (displayVal && !isNaN(parseFloat(displayVal)) ? displayVal : '');
          } else {
            // Day percentage column for JAMI row
            const dayPairSums = [];
            [c - 3, c - 2, c - 1].forEach(colIdx => {
              let pSum = 0;
              let hasP = false;
              dataRows.forEach(dr => {
                const num = parseFloat(dr.values[colIdx]);
                if (!isNaN(num) && num > 0) {
                  pSum += num;
                  hasP = true;
                }
              });
              if (hasP) dayPairSums.push(pSum);
            });

            if (dayPairSums.length > 0 && totalHemisFaculty > 0) {
              const avgP = dayPairSums.reduce((a, b) => a + b, 0) / dayPairSums.length;
              const pct = (avgP / totalHemisFaculty) * 100;
              displayVal = pct.toFixed(1) + '%';
              rowDayPcts.push(pct);
              if (pct >= 90) cellClass += ' pct-good';
              else if (pct >= 80) cellClass += ' pct-warn';
              else if (pct > 0) cellClass += ' pct-bad';
            } else {
              displayVal = '-';
            }
          }
        } else {
          // Regular group row
          if (isPct) {
            let numVal = parseFloat(displayVal);
            if (!isNaN(numVal)) {
              const pct = numVal <= 1 ? numVal * 100 : numVal;
              displayVal = pct.toFixed(0) + '%';
              rowDayPcts.push(pct);
              if (pct >= 90) cellClass += ' pct-good';
              else if (pct >= 80) cellClass += ' pct-warn';
              else if (pct > 0) cellClass += ' pct-bad';
            } else {
              const hemis = parseFloat(vals[3]) || 0;
              const p1 = parseFloat(vals[c - 3]);
              const p2 = parseFloat(vals[c - 2]);
              const p3 = parseFloat(vals[c - 1]);
              const pairs = [p1, p2, p3].filter(p => !isNaN(p));
              if (pairs.length > 0 && hemis > 0) {
                const avg = pairs.reduce((a, b) => a + b, 0) / pairs.length;
                const pct = (avg / hemis) * 100;
                displayVal = pct.toFixed(0) + '%';
                rowDayPcts.push(pct);
                if (pct >= 90) cellClass += ' pct-good';
                else if (pct >= 80) cellClass += ' pct-warn';
                else if (pct > 0) cellClass += ' pct-bad';
              } else {
                displayVal = '-';
              }
            }
          }
        }

        bodyHtml += `<td class="${cellClass}">${displayVal}</td>`;
      }

      // Hafta %
      const haftaVal = vals[28];
      let haftaText = '-';
      let hNum = parseFloat(haftaVal);
      if (!isNaN(hNum)) {
        const pct = hNum <= 1 ? hNum * 100 : hNum;
        haftaText = (isTotalRow ? pct.toFixed(1) : pct.toFixed(0)) + '%';
      } else if (rowDayPcts.length > 0) {
        const avgH = rowDayPcts.reduce((a, b) => a + b, 0) / rowDayPcts.length;
        haftaText = (isTotalRow ? avgH.toFixed(1) : avgH.toFixed(0)) + '%';
      }
      bodyHtml += `<td style="font-weight:800; color:#34d399; font-family:'JetBrains Mono';">${haftaText}</td>`;
      bodyHtml += '</tr>';
    });

    tbody.innerHTML = bodyHtml;
  } catch (err) {
    console.error('Error rendering Excel grid:', err);
    thead.innerHTML = '<tr><th colspan="20" style="color:var(--status-bad);">Excel jadvalini yuklashda xatolik</th></tr>';
  }
}

// ================= 7. INNOVATIONS & RECOMMENDATIONS =================
function initInnovations() {
  const btnQR = document.getElementById('btnGenerateDoorQR');
  const qrDisplay = document.getElementById('qrDisplayArea');
  const qrCanvas = document.getElementById('qrCanvas');
  const qrCaption = document.getElementById('qrCaption');

  if (btnQR) {
    btnQR.addEventListener('click', () => {
      const room = state.selectedRoom || '101-auditoriya';
      qrDisplay.style.display = 'block';
      qrCaption.textContent = `UrDPI Auditoriya: ${room}`;

      const targetUrl = window.location.origin + `/?room=${encodeURIComponent(room)}`;

      if (window.QRCode) {
        window.QRCode.toCanvas(qrCanvas, targetUrl, { width: 180 }, function (error) {
          if (error) console.error(error);
        });
      }
      showToast(`${room} uchun QR-kod yaratildi! Eshikka osish uchun tayyor`, 'success');
    });
  }

  const btnTelegramTest = document.getElementById('btnTestTelegramBot');
  if (btnTelegramTest) {
    btnTelegramTest.addEventListener('click', sendTelegramTestReport);
  }
}

// ================= 8. SETTINGS & MANAGING GROUPS =================
function initSettingsForms() {
  // Add Group
  const addGroupForm = document.getElementById('addGroupForm');
  if (addGroupForm) {
    addGroupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const facId = document.getElementById('settingsFacultySelect').value;
      const grpName = document.getElementById('newGroupName').value;
      const course = document.getElementById('newGroupCourse').value;
      const hemis = document.getElementById('newGroupHemis').value;

      try {
        const res = await fetch('/api/faculties/group', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ facultyId: facId, groupName: grpName, course, hemis })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Guruh "${grpName}" muvaffaqiyatli saqlandi!`, 'success');
          addGroupForm.reset();
          loadSeedData();
        }
      } catch (err) {
        showToast('Guruh qo\'shishda xatolik', 'error');
      }
    });
  }

  // Add Teacher
  const addTeacherForm = document.getElementById('addTeacherForm');
  if (addTeacherForm) {
    addTeacherForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newTeacherName').value;
      const dept = document.getElementById('newTeacherDept').value;

      try {
        const res = await fetch('/api/teachers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, department: dept })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`O'qituvchi "${name}" qo'shildi!`, 'success');
          addTeacherForm.reset();
          loadSeedData();
        }
      } catch (err) {
        showToast('O\'qituvchi qo\'shishda xato', 'error');
      }
    });
  }

  // Add Room
  const addRoomForm = document.getElementById('addRoomForm');
  if (addRoomForm) {
    addRoomForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('newRoomName').value;
      const bld = document.getElementById('newRoomBuilding').value;

      try {
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, building: bld })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Auditoriya "${name}" qo'shildi!`, 'success');
          addRoomForm.reset();
          loadSeedData();
        }
      } catch (err) {
        showToast('Xona qo\'shishda xato', 'error');
      }
    });
  }
}

// ================= UTILITIES: TOAST =================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ================= 📸 AUDITORIYA FOTO-FAKTI (CLASSROOM PHOTO AUDIT) =================
function initPhotoAudit() {
  const photoInput = document.getElementById('auditPhotoInput');
  const emptyBox = document.getElementById('photoEmptyState');
  const btnRetake = document.getElementById('btnRetakePhoto');
  const btnDelete = document.getElementById('btnDeletePhoto');
  const modalBackdrop = document.getElementById('photoModalBackdrop');
  const btnCloseModal = document.getElementById('btnClosePhotoModal');

  if (emptyBox && photoInput) {
    emptyBox.addEventListener('click', () => photoInput.click());
    emptyBox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        photoInput.click();
      }
    });
  }

  if (btnRetake && photoInput) {
    btnRetake.addEventListener('click', () => photoInput.click());
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      resetPhotoAudit();
      showToast('Auditoriya surati olib tashlandi', 'info');
    });
  }

  if (photoInput) {
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Iltimos, faqat rasm faylini tanlang!', 'error');
        return;
      }

      showToast('Rasm qayta ishlanmoqda va siqilmoqda...', 'info');

      try {
        const compressed = await processAndCompressImage(file);
        state.currentPhotoBase64 = compressed.base64;

        const imgPreview = document.getElementById('auditPhotoImg');
        const previewContainer = document.getElementById('photoPreviewContainer');
        const emptyState = document.getElementById('photoEmptyState');
        const statusBadge = document.getElementById('photoStatusBadge');
        const sizeBadge = document.getElementById('photoSizeBadge');
        const timeBadge = document.getElementById('photoTimestampBadge');

        if (imgPreview) imgPreview.src = compressed.base64;
        if (sizeBadge) sizeBadge.textContent = `~${compressed.sizeKb} KB (optimallashtirildi)`;
        if (timeBadge) timeBadge.textContent = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

        if (statusBadge) {
          statusBadge.className = 'photo-status-badge verified';
          statusBadge.textContent = '✓ Rasm biriktirildi';
        }

        if (emptyState) emptyState.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'flex';

        showToast('Auditoriya surati muvaffaqiyatli tayyorlandi! ✅', 'success');
      } catch (err) {
        console.error('Photo compression error:', err);
        showToast('Rasmni yuklashda xatolik yuz berdi', 'error');
      }
    });
  }

  // Modal close handlers
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', closePhotoModal);
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closePhotoModal);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePhotoModal();
    }
  });
}

// Compress and resize photo client-side using Canvas
function processAndCompressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Quality 0.78 JPEG gives outstanding clarity while keeping size ~120-250KB
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.78);
        const approxSizeKb = Math.round((compressedBase64.length * 3) / 4 / 1024);

        resolve({
          base64: compressedBase64,
          sizeKb: approxSizeKb
        });
      };
      img.onerror = () => reject(new Error('Rasmni yuklab bo\'lmadi'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Faylni o\'qishda xatolik'));
    reader.readAsDataURL(file);
  });
}

// Reset photo audit state & UI
function resetPhotoAudit() {
  state.currentPhotoBase64 = null;
  const photoInput = document.getElementById('auditPhotoInput');
  const imgPreview = document.getElementById('auditPhotoImg');
  const previewContainer = document.getElementById('photoPreviewContainer');
  const emptyState = document.getElementById('photoEmptyState');
  const statusBadge = document.getElementById('photoStatusBadge');

  if (photoInput) photoInput.value = '';
  if (imgPreview) imgPreview.src = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (emptyState) emptyState.style.display = 'flex';

  if (statusBadge) {
    statusBadge.className = 'photo-status-badge empty';
    statusBadge.textContent = 'Rasm yo\'q';
  }
}

// Open Lightbox Photo Modal
function openPhotoModal(photoUrl, title, meta, auditor, time) {
  const modal = document.getElementById('photoModalOverlay');
  const img = document.getElementById('photoModalImg');
  const titleEl = document.getElementById('photoModalTitle');
  const metaEl = document.getElementById('photoModalMeta');
  const auditorEl = document.getElementById('photoModalAuditor');
  const timeEl = document.getElementById('photoModalTime');
  const downloadBtn = document.getElementById('photoModalDownloadBtn');

  if (!modal || !img) return;

  img.src = photoUrl;
  if (titleEl) titleEl.textContent = title || 'Auditoriya Foto-fakti';
  if (metaEl) metaEl.textContent = meta || '';
  if (auditorEl) auditorEl.textContent = `👤 Tekshiruvchi: ${auditor || 'Uslubchi'}`;
  if (timeEl) timeEl.textContent = `⏰ ${time || ''}`;
  if (downloadBtn) {
    downloadBtn.href = photoUrl;
    downloadBtn.setAttribute('download', `UrDPI_Audit_${(title || 'foto').replace(/[^a-zA-Z0-9]/g, '_')}.jpg`);
  }

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Close Lightbox Photo Modal
function closePhotoModal() {
  const modal = document.getElementById('photoModalOverlay');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}
window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModal;
