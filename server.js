require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');

const excelService = require('./services/excelService');
const statsService = require('./services/statsService');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Health Check for monitoring & deployment
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    app: 'UrDPI Davomat va Monitoring Tizimi',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    nodeVersion: process.version
  });
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/davomat', express.static(path.join(__dirname, 'public')));
app.use('/davomat', express.static(__dirname));

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const FACULTIES_FILE = path.join(DATA_DIR, 'faculties.json');
const TEACHERS_FILE = path.join(DATA_DIR, 'teachers.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const EXCEL_FILE = path.join(__dirname, 'DAVOMAT.xlsx');

// Helper to read JSON
const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
};

// Helper to write JSON
const writeJson = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
};

// ================= AUTH ENDPOINTS =================

// 0. User Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Login va parol kiritilishi shart!' });
  }

  const users = readJson(USERS_FILE);
  const cleanUser = String(username).trim().toLowerCase();
  const user = users.find(u => 
    (u.username.toLowerCase() === cleanUser || u.id.toLowerCase() === cleanUser) && 
    String(u.password) === String(password)
  );

  if (!user) {
    return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri!' });
  }

  const token = 'urdpi_' + Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
  const safeUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    facultyId: user.facultyId,
    facultyName: user.facultyName,
    phone: user.phone || '',
    token
  };

  res.json({ success: true, user: safeUser });
});

// Get all users (Admin view)
app.get('/api/auth/users', (req, res) => {
  const users = readJson(USERS_FILE).map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    facultyId: u.facultyId,
    facultyName: u.facultyName,
    phone: u.phone || ''
  }));
  res.json(users);
});

// Update or reset user password
app.post('/api/auth/change-password', (req, res) => {
  const { userId, oldPassword, newPassword, isAdminReset } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'Foydalanuvchi va yangi parol talab qilinadi!' });
  }

  const users = readJson(USERS_FILE);
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: 'Foydalanuvchi topilmadi!' });

  if (!isAdminReset && oldPassword && String(users[idx].password) !== String(oldPassword)) {
    return res.status(400).json({ error: 'Eski parol noto\'g\'ri kiritildi!' });
  }

  users[idx].password = String(newPassword).trim();
  writeJson(USERS_FILE, users);
  res.json({ success: true, message: 'Parol muvaffaqiyatli yangilandi!' });
});

// ================= API ENDPOINTS =================

// 1. Get all faculties, directions, and groups (or filtered by facultyId)
app.get('/api/faculties', (req, res) => {
  const { facultyId } = req.query;
  const faculties = readJson(FACULTIES_FILE);
  if (facultyId && facultyId !== 'all') {
    const filtered = faculties.filter(f => f.id === facultyId);
    return res.json(filtered.length > 0 ? filtered : faculties);
  }
  res.json(faculties);
});

// Add or edit group
app.post('/api/faculties/group', (req, res) => {
  const { facultyId, directionId, groupName, course, hemis } = req.body;
  if (!facultyId || !groupName) {
    return res.status(400).json({ error: 'Fakultet va guruh nomi majburiy!' });
  }

  const faculties = readJson(FACULTIES_FILE);
  const fac = faculties.find(f => f.id === facultyId);
  if (!fac) return res.status(404).json({ error: 'Fakultet topilmadi' });

  let dir = fac.directions.find(d => d.id === directionId);
  if (!dir) {
    dir = fac.directions[0];
  }

  const newGroup = {
    id: groupName.trim(),
    name: groupName.trim(),
    course: parseInt(course) || 1,
    hemis: parseInt(hemis) || 25
  };

  const existingIdx = dir.groups.findIndex(g => g.name.toLowerCase() === groupName.toLowerCase().trim());
  if (existingIdx >= 0) {
    dir.groups[existingIdx] = { ...dir.groups[existingIdx], ...newGroup };
  } else {
    dir.groups.push(newGroup);
  }

  writeJson(FACULTIES_FILE, faculties);
  res.json({ success: true, group: newGroup });
});

// 2. Teachers list
app.get('/api/teachers', (req, res) => {
  res.json(readJson(TEACHERS_FILE));
});

app.post('/api/teachers', (req, res) => {
  const { name, department, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'O\'qituvchi ismi majburiy' });
  const teachers = readJson(TEACHERS_FILE);
  const newTeacher = {
    id: 't_' + Date.now(),
    name: name.trim(),
    department: department || 'Kafedra',
    phone: phone || ''
  };
  teachers.push(newTeacher);
  writeJson(TEACHERS_FILE, teachers);
  res.json({ success: true, teacher: newTeacher });
});

// 3. Rooms list
app.get('/api/rooms', (req, res) => {
  res.json(readJson(ROOMS_FILE));
});

app.post('/api/rooms', (req, res) => {
  const { name, building, capacity } = req.body;
  if (!name) return res.status(400).json({ error: 'Xona nomi majburiy' });
  const rooms = readJson(ROOMS_FILE);
  const newRoom = {
    id: 'r_' + Date.now(),
    name: name.trim(),
    building: building || 'Bosh bino',
    capacity: parseInt(capacity) || 30
  };
  rooms.push(newRoom);
  writeJson(ROOMS_FILE, rooms);
  res.json({ success: true, room: newRoom });
});

// 4. Students for a specific group
app.get('/api/students/:groupId', (req, res) => {
  const rawId = (req.params.groupId || '').trim();
  const allStudents = readJson(STUDENTS_FILE);
  let list = allStudents[rawId];
  if (!list) {
    const clean = rawId.toLowerCase().replace(/\s+/g, ' ');
    const matchedKey = Object.keys(allStudents).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === clean);
    if (matchedKey) list = allStudents[matchedKey];
  }
  res.json(list || []);
});

// 5. Submit Attendance (Double write: DB + Real-time Excel!)
app.post('/api/attendance', async (req, res) => {
  try {
    const entry = req.body;

    if (!entry.facultyId || !entry.groupId || entry.presentCount === undefined) {
      return res.status(400).json({ error: 'Fakultet, guruh va qatnashganlar soni talab qilinadi!' });
    }

    // A) Add to internal database logs
    const savedRecord = statsService.addAttendanceRecord(entry);

    // B) Sync directly into DAVOMAT.xlsx
    let excelResult = null;
    try {
      excelResult = await excelService.recordAttendance(entry);
    } catch (excelErr) {
      console.error('Excel sync error:', excelErr);
      excelResult = { error: excelErr.message };
    }

    res.json({
      success: true,
      record: savedRecord,
      excel: excelResult,
      message: `Davomat muvaffaqiyatli qabul qilindi va Excelga yozildi! (Sheet: ${excelResult?.sheet || 'DAVOMAT'}, Katak: ${excelResult?.cell || '-'})`
    });
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Get Attendance Logs
app.get('/api/attendance/logs', (req, res) => {
  const { facultyId, groupId, date } = req.query;
  let logs = statsService.getAttendanceLogs();

  if (date) logs = logs.filter(l => l.date === date);
  if (facultyId) logs = logs.filter(l => l.facultyId === facultyId);
  if (groupId) logs = logs.filter(l => l.groupId.toLowerCase().includes(groupId.toLowerCase()));

  res.json(logs.reverse());
});

// 7. Get Dashboard Analytics (All institute or scoped to faculty)
app.get('/api/attendance/stats', (req, res) => {
  const { date, facultyId } = req.query;
  const stats = statsService.getDashboardStats(date, facultyId);
  res.json(stats);
});

// 8. Get Excel Grid data for in-browser visual table
app.get('/api/excel/grid/:facultyId', async (req, res) => {
  try {
    const facultyId = req.params.facultyId || 'aniq-fanlar';
    const gridData = await excelService.getFacultyGrid(facultyId);
    res.json(gridData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Download fresh DAVOMAT.xlsx (All or specific faculty)
app.get('/api/excel/download', async (req, res) => {
  try {
    const facultyId = req.query.faculty;
    const today = new Date().toISOString().split('T')[0];

    if (!facultyId || facultyId === 'all') {
      if (fs.existsSync(EXCEL_FILE)) {
        return res.download(EXCEL_FILE, `UrDPI_DAVOMAT_Barcha_Fakultetlar_${today}.xlsx`);
      }
    }

    const faculties = JSON.parse(fs.readFileSync(FACULTIES_FILE, 'utf8'));
    const fac = faculties.find(f => f.id === facultyId);
    const safeName = fac ? fac.shortName.replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '_') : 'Fakultet';

    const wb = await excelService.exportFacultyWorkbook(facultyId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=UrDPI_${safeName}_DAVOMAT_${today}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Download error:', err);
    if (fs.existsSync(EXCEL_FILE)) {
      res.download(EXCEL_FILE, `UrDPI_DAVOMAT.xlsx`);
    } else {
      res.status(500).json({ error: 'Excel faylni yuklashda xatolik' });
    }
  }
});

// Helper: Real Telegram Bot API message dispatcher
const sendTelegramMessage = (text) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return Promise.resolve({ sent: false, reason: 'TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan (Simulyatsiya rejimi)' });
  }

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    };

    const request = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ sent: Boolean(parsed.ok), response: parsed });
        } catch (e) {
          resolve({ sent: false, error: e.message });
        }
      });
    });

    request.on('error', (err) => resolve({ sent: false, error: err.message }));
    request.on('timeout', () => {
      request.destroy();
      resolve({ sent: false, error: 'Telegram API timeout (8s)' });
    });
    request.write(payload);
    request.end();
  });
};

// 10. Telegram Bot Report Dispatch (Real Bot or Simulation)
app.post('/api/telegram/send-report', async (req, res) => {
  try {
    const { facultyId } = req.body || {};
    const stats = statsService.getDashboardStats(null, facultyId);
    const today = new Date().toLocaleDateString('uz-UZ');
    const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

    let text = '';
    if (stats.isScoped && stats.facultyScope) {
      text += `📊 <b>UrDPI ${stats.facultyScope.name.toUpperCase()} KUNLIK DAVOMAT HISOBOTI</b>\n`;
      text += `📅 Sana: ${today} (${time})\n`;
      text += `🏛 Fakultet umumiy davomati: <b>${stats.overallAttendanceRate}%</b>\n`;
      text += `👥 Qatnashganlar: <b>${stats.totalAuditedGroups} ta guruh tekshirildi</b> (${stats.totalInstituteStudents} ta talabadan)\n\n`;
      text += `<b>Ta'lim yo'nalishlari ko'rsatkichi:</b>\n`;

      (stats.directionStats || []).forEach(d => {
        const icon = d.attendanceRate >= 90 ? '🟢' : (d.attendanceRate >= 80 ? '🟡' : '🔴');
        text += `${icon} ${d.name}: <b>${d.attendanceRate}%</b> (${d.presentStudents}/${d.totalStudents})\n`;
      });
    } else {
      text += `📊 <b>UrDPI INSTITUT KUNLIK DAVOMAT HISOBOTI</b>\n`;
      text += `📅 Sana: ${today} (${time})\n`;
      text += `🏛 Institut umumiy davomati: <b>${stats.overallAttendanceRate}%</b>\n`;
      text += `👥 Qatnashganlar: <b>${stats.totalAuditedGroups} ta guruh tekshirildi</b>\n\n`;
      text += `<b>Fakultetlar ko'rsatkichi:</b>\n`;

      stats.facultyStats.forEach(f => {
        const icon = f.attendanceRate >= 90 ? '🟢' : (f.attendanceRate >= 80 ? '🟡' : '🔴');
        text += `${icon} ${f.shortName}: <b>${f.attendanceRate}%</b> (${f.presentStudents}/${f.totalStudents})\n`;
      });
    }

    text += `\n<i>Hisobot avtomatik tarzda "DAVOMAT.xlsx" bazasidan shakllantirildi.</i>`;

    // Dispatch to real Telegram if configured
    const tgResult = await sendTelegramMessage(text);

    let notice = '';
    if (tgResult.sent) {
      notice = stats.isScoped 
        ? `${stats.facultyScope.shortName} bo'yicha hisobot Telegram guruhga yuborildi! ✅` 
        : 'Telegram guruhga hisobot muvaffaqiyatli yuborildi! ✅';
    } else {
      notice = stats.isScoped 
        ? `${stats.facultyScope.shortName} bo'yicha hisobot shakllantirildi (Simulyatsiya)`
        : 'Hisobot shakllantirildi (Telegram sozlanmagan bo\'lsa simulyatsiya qilinadi)';
    }

    res.json({
      success: true,
      message: notice,
      realTelegramSent: tgResult.sent,
      telegramDetail: tgResult,
      previewText: text
    });
  } catch (err) {
    console.error('Telegram dispatch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve Single Page App
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const server = app.listen(PORT, HOST, () => {
  console.log(`=================================================`);
  console.log(`🏛  UrDPI Davomat va Monitoring Tizimi ishga tushdi!`);
  console.log(`🌐  Local URL: http://localhost:${PORT}`);
  console.log(`📱  Mobil / Tarmoqdan kirish: http://<server-ip>:${PORT}`);
  console.log(`📑  Excel sinxronizatsiya: ${EXCEL_FILE}`);
  console.log(`🩺  Health Check: http://localhost:${PORT}/health`);
  console.log(`=================================================`);
});

// Graceful Shutdown for Production (PM2, Docker, Systemd)
const handleShutdown = (signal) => {
  console.log(`\n🛑 [${signal}] Signali qabul qilindi. Server xavfsiz to'xtatilmoqda...`);
  server.close(() => {
    console.log('✅ Barcha ulanishlar yopildi. Server to\'xtatildi.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Majburiy to\'xtatildi (timeout).');
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
