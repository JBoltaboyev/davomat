/**
 * UrDPI Davomat Tizimi - Avtomatik Zaxira (Backup) Skripti
 * Ishlatish: node scripts/backup.js yoki npm run backup
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const EXCEL_FILE = path.join(ROOT_DIR, 'DAVOMAT.xlsx');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${mm}-${dd}_${hh}-${mi}-${ss}`;
}

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isFile()) {
      fs.copyFileSync(fromPath, toPath);
    } else {
      copyFolderSync(fromPath, toPath);
    }
  });
}

function performBackup() {
  console.log('🔄 UrDPI Davomat tizimi zaxiralash (backup) boshlandi...');

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = formatTimestamp();
  const targetFolder = path.join(BACKUPS_DIR, `backup_${timestamp}`);
  fs.mkdirSync(targetFolder, { recursive: true });

  // 1. Zaxiraga data papkasini nusxalash
  if (fs.existsSync(DATA_DIR)) {
    const targetData = path.join(targetFolder, 'data');
    copyFolderSync(DATA_DIR, targetData);
    console.log(`✅ [data/] papkasi muvaffaqiyatli nusxalandi.`);
  }

  // 2. Zaxiraga DAVOMAT.xlsx ni nusxalash
  if (fs.existsSync(EXCEL_FILE)) {
    const targetExcel = path.join(targetFolder, 'DAVOMAT.xlsx');
    fs.copyFileSync(EXCEL_FILE, targetExcel);
    console.log(`✅ [DAVOMAT.xlsx] fayli muvaffaqiyatli nusxalandi.`);
  }

  // 3. 30 kundan eski zaxiralarni avtomatik tozalash (joyni tejash uchun)
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const existingBackups = fs.readdirSync(BACKUPS_DIR);
  existingBackups.forEach(name => {
    const itemPath = path.join(BACKUPS_DIR, name);
    try {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory() && (now - stats.mtimeMs > THIRTY_DAYS_MS)) {
        fs.rmSync(itemPath, { recursive: true, force: true });
        console.log(`🗑 Eski zaxira tozalandi: ${name}`);
      }
    } catch (e) {}
  });

  console.log(`🎉 Zaxiralash yakunlandi! Joylashuv: ${targetFolder}`);
}

performBackup();
