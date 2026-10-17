# 🚀 UrDPI Davomat va Monitoring Tizimi — Serverga O'rnatish Qo'llanmasi

Ushbu qo'llanma **Urganch davlat pedagogika instituti (UrDPI)** davomat va monitoring tizimini Linux serveriga (Ubuntu 20.04 / 22.04 / 24.04 LTS), VPS yoki bulutli xostingga professional darajada joylash (deploy qilish) uchun tayyorlandi.

---

## 📋 Tizim Talablari
- **Operatsion tizim**: Ubuntu 22.04 LTS yoki Debian 12 (yoki har qanday Linux VPS / Universitet ichki serveri)
- **Minimal resurslar**: 1 Core CPU, 1 GB RAM, 10 GB Disk
- **Node.js**: v18.x, v20.x yoki v22.x LTS
- **Internet ulanishi va statik IP** (yoki domen nomi: masalan `davomat.urdpi.uz`)

---

## 🌟 1-USUL: PM2 va Nginx orqali o'rnatish (Tavsiya etiladi)

Bu usul server o'chib yonsa ham tizimning avtomatik ishlab ketishini, 24/7 barqaror ishlashini va HTTPS (SSL) himoyasini ta'minlaydi.

### 1-qadam: Serverni tayyorlash va Node.js o'rnatish
Serveringizga SSH orqali kiring va buyruqlarni bajaring:

```bash
# Server paketlarini yangilash
sudo apt update && sudo apt upgrade -y

# Kerakli dasturlarni o'rnatish
sudo apt install -y curl wget git nginx certbot python3-certbot-nginx

# Node.js 20 LTS o'rnatish
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Versiyalarni tekshirish
node -v
npm -v
```

### 2-qadam: PM2 jarayon boshqaruvchisini o'rnatish
```bash
sudo npm install -g pm2
```

### 3-qadam: Loyiha fayllarini serverga yuklash
Loyiha uchun serverda katalog oching:
```bash
sudo mkdir -p /var/www/davomat
sudo chown -R $USER:$USER /var/www/davomat
cd /var/www/davomat
```

Fayllarni serverga yuklang (Git orqali yoki FileZilla / WinSCP / SFTP yordamida):
- Agar Git bo'lsa:
  ```bash
  git clone <sizning-git-repoyingiz> .
  ```
- Agar arxiv bo'lsa:
  ```bash
  tar -xvf davomat.tar.gz -C /var/www/davomat/
  ```

### 4-qadam: Bog'liqliklarni o'rnatish va .env sozlash
```bash
cd /var/www/davomat

# Production paketlarni o'rnatish
npm install --omit=dev

# .env faylini yaratish (agar bo'lmasa)
cp .env.example .env
nano .env
```

`.env` faylida quyidagi ma'lumotlar turadi:
```ini
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
APP_NAME=UrDPI Davomat va Monitoring

# Agar Telegram guruhga hisobot bormoqchi bo'lsa:
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```
*(Saqlash uchun: `Ctrl + O`, `Enter`, chiqish uchun: `Ctrl + X`)*

### 5-qadam: Tizimni PM2 orqali 24/7 ishga tushirish
Loyiha ichidagi tayyor `ecosystem.config.js` orqali ishga tushiring:

```bash
# PM2 bilan ishga tushirish
pm2 start ecosystem.config.js

# Server o'chib yonganda ham avtomatik qayta yonishi uchun:
pm2 startup
# (Terminalda ko'rsatilgan `sudo env PATH=...` buyrug'ini nusxalab yurgizing)
pm2 save
```

Holatni tekshirish:
```bash
pm2 status
pm2 logs urdpi-davomat
```

### 6-qadam: Nginx Reverse Proxy sozlash
Foydalanuvchilar port raqamisiz (to'g'ridan-to'g'ri `http://davomat.urdpi.uz` yoki server IP orqali) kirishlari uchun Nginx konfiguratsiyasini ulaymiz:

```bash
# Nginx sozlama faylini nusxalash
sudo cp /var/www/davomat/nginx/urdpi-davomat.conf /etc/nginx/sites-available/davomat.conf

# Fayldagi domen nomini o'zingiznikiga almashtiring:
sudo nano /etc/nginx/sites-available/davomat.conf
# (server_name davomat.urdpi.uz o'rniga o'z domeningizni yoki server IP sini yozing)

# Saytni faollashtirish
sudo ln -s /etc/nginx/sites-available/davomat.conf /etc/nginx/sites-enabled/

# Nginx sintaksisini tekshirish va qayta yuklash
sudo nginx -t
sudo systemctl reload nginx
```

### 7-qadam: Bepul SSL (HTTPS) sertifikat o'rnatish
Agar domeningiz (`davomat.urdpi.uz`) serveringiz IP siga yo'naltirilgan bo'lsa:

```bash
sudo certbot --nginx -d davomat.urdpi.uz
```
Certbot avtomatik tarzda SSL sertifikatni o'rnatadi va har 3 oyda o'zi avtomatik yangilab turadi!

---

## 🐳 2-USUL: Docker & Docker Compose orqali o'rnatish

Agar serveringizda Docker o'rnatilgan bo'lsa, tizim 1 ta buyruq bilan to'liq ko'tariladi:

```bash
cd /var/www/davomat

# Docker orqali fonda ishga tushirish
docker compose up -d --build

# Holatni ko'rish
docker compose ps
docker compose logs -f
```

*Eslatma*: `docker-compose.yml` da `data/` va `DAVOMAT.xlsx` fayllari volume orqali bog'langan, shuning uchun konteyner o'chirilsa ham ma'lumotlar serverda 100% xavfsiz saqlanadi.

---

## 💾 3-BO'LIM: Avtomatik Zaxira (Backup) va Xavfsizlik

Davomat tizimida barcha ma'lumotlar `data/*.json` va `DAVOMAT.xlsx` da saqlanadi. Ma'lumotlar yo'qolmasligi uchun loyihaga **avtomatik zaxira tizimi** kiritilgan.

### Zaxirani qo'lda olish:
```bash
npm run backup
```
Bu buyruq `backups/backup_SANA_SOAT` jildini yaratadi va barcha ma'lumotlarni nusxalaydi (30 kundan eski nusxalarni avtomatik tozalaydi).

### Har kuni avtomatik zaxiralash (Linux Cron):
Serverda har kecha soat 23:30 da avtomatik zaxira olish uchun:
```bash
crontab -e
```
Faylning eng oxiriga quyidagi qatorni qo'shing:
```cron
30 23 * * * cd /var/www/davomat && /usr/bin/node scripts/backup.js >> /var/www/davomat/logs/backup.log 2>&1
```

---

## 🤖 4-BO'LIM: Telegram Botni ulash (Qadamma-qadam)

Kunlik institut va fakultet hisobotlarini Telegram guruhga yoki dekanatga yuborish uchun:

1. Telegramda **@BotFather** ga kiring va `/newbot` buyrug'i orqali bot oching.
2. BotFather bergan **Token**ni nusxalang (masalan: `7123456789:AA...`).
3. Botni hisobot borishi kerak bo'lgan Telegram guruhga **Admin** qilib qo'shing.
4. Guruhning **Chat ID** sini aniqlang:
   - Guruhga biron xabar yozing;
   - Brauzerda: `https://api.telegram.org/bot<TOKENINGIZ>/getUpdates` manzilini oching;
   - Chiqqan JSON ichidan `"chat":{"id": -100xxxxxxxxxx}` qiymatini oling.
5. `/var/www/davomat/.env` faylini ochib, ikkala qiymatni kiriting:
   ```ini
   TELEGRAM_BOT_TOKEN=7123456789:AA...
   TELEGRAM_CHAT_ID=-100xxxxxxxxxx
   ```
6. Serverni qayta ishga tushiring:
   ```bash
   pm2 restart urdpi-davomat
   ```
Endi Dashboarddagi **"Telegramga Yuborish"** tugmasi bosilganda hisobot to'g'ridan-to'g'ri guruhga yetib boradi!

---

## 🛠 5-BO'LIM: Boshqaruv va Foydali Buyruqlar

| Maqsad | Buyruq |
|---|---|
| Tizim holatini ko'rish | `pm2 status` |
| Jonli xatolar va loglarni ko'rish | `pm2 logs urdpi-davomat` |
| Tizimni qayta ishga tushirish | `pm2 restart urdpi-davomat` |
| Tizimni to'xtatish | `pm2 stop urdpi-davomat` |
| Healthcheck holati | `curl http://localhost:3000/health` |
| Excel faylini to'g'ridan-to'g'ri serverdan yuklab olish | `scp user@server-ip:/var/www/davomat/DAVOMAT.xlsx ./` |
| Nginx qayta yuklash | `sudo systemctl reload nginx` |

---

## 🔒 6-BO'LIM: Standart Tizim Akkauntlari

| Login | Parol | Rol | Vazifa |
|---|---|---|---|
| **admin** | `123` | Bosh Administrator (Jamshid Boltaboyev) | Barcha 5 ta fakultet, to'liq institut monitoringi va barcha Excel jadvallari |
| **aniq** | `123` | Uslubchi | Aniq va tabiiy fanlar fakulteti |
| **filologiya** | `123` | Uslubchi | Filologiya fakulteti |
| **ijtimoiy** | `123` | Uslubchi | Ijtimoiy-iqtisodiy va amaliy fanlar fakulteti |
| **boshlangich** | `123` | Uslubchi | Boshlang'ich ta'lim fakulteti |
| **pedagogika** | `123` | Uslubchi | Pedagogika fakulteti |

*(Eslatma: Parollarni administrator tizimning "Sozlamalar" bo'limidan xohlagan vaqtda o'zgartirishi mumkin).*
