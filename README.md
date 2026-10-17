# 🏛 UrDPI Davomat va Monitoring Tizimi (5 ta Fakultet)

Urganch davlat pedagogika instituti (UrDPI) uchun ishlab chiqilgan zamonaviy, mobil qurilmalarga moslashtirilgan davomat olish va umumiy monitoring axborot tizimi.

Ushbu tizim **auditoriyaga kirib tezkor davomat olish**, **5 ta fakultet bo'yicha umumiy monitoring** va barcha ma'lumotlarni **haqiqiy `DAVOMAT.xlsx` Excel fayliga avtomatik real-vaqt rejimida yozib borish** uchun mo'ljallangan.

---

## 🚀 Asosiy Imkoniyatlar

1. 📱 **Mobil Auditoriya Davomati (Xonama-xona nazorat rejimi)**:
   - Telefon yoki planshet orqali istalgan auditoriyaga kirganda qulay bir qo'l bilan boshqarish.
   - **Xona / Auditoriya** (101, 102, 201, 203, 301, 305...) tezkor tanlash.
   - **Fakultet, Yo'nalish, Kurs va Guruh** (Masalan: *Aniq fanlar oliy maktabi -> Fizika -> 261-Fizika*).
   - **Juftlik (Para) va O'qish Vaqti (3 ta Smena)**: Hozirgi real vaqtga qarab avtomatik aniqlanadi:
     - ☀️ **Kunduzgi (1-smena)**: 1-para (08:30-09:50), 2-para (10:00-11:20), 3-para (11:30-12:50).
     - 🌤 **Kunduzgi (2-smena)**: 1-para (13:00-14:20), 2-para (14:30-15:50), 3-para (16:00-17:20).
     - 🌙 **Kechki ta'lim**: 1-para (17:30-18:50), 2-para (19:00-20:20).
   - **O'qituvchi nazorati**: Dars o'tayotgan o'qituvchi xonada bor-yo'qligi qayd etiladi.
   - **Ikkita davomat usuli**:
     - ⚡ *Tezkor hisoblash*: Katta sensorli hisoblagich (+ / -) va slayd panel.
     - 📋 *HEMIS talabalar ro'yxati*: Har bir talaba yonida `[Bor] [Yo'q] [Sababli]` tugmalari va bir bosishda "Barchasi bor" imkoniyati.

2. 📊 **Institut Umumiy Monitoringi (Rektorat va Dekanat Katta Paneli)**:
   - Institut bo'yicha umumiy davomat foizi va qatnashgan talabalar soni.
   - 5 ta fakultetning jonli taqqoslama ko'rsatkichi (progress bar va reyting).
   - Paralar va smenalar bo'yicha dinamika (1-smena, 2-smena, Kechki ta'lim hamda 1, 2, 3-paralar).
   - Jonli tekshiruvlar oqimi (Qaysi xona, o'qituvchi, guruh, smena, para va tekshiruvchi).

3. 📑 **Avtomatik Excel Sinxronizatsiyasi (`DAVOMAT.xlsx`)**:
   - Har bir olingan davomat `DAVOMAT.xlsx` faylidagi tegishli fakultet varag'i, guruh qatori va hafta kuni/para ustuniga yoziladi.
   - Kunlik o'rtacha davomat va foizlar Excel formulalari (`=IFERROR(AVERAGE(...)/D..., "")`) orqali qayta hisoblanadi.
   - Barcha 5 ta fakultet va "Umumiy Monitoring" varag'i yaratilgan.
   - Istalgan vaqtda brauzerdan turib yangilangan Excel faylni yuklab olish mumkin.

4. 🤖 **Qo'shimcha Innovatsion Imkoniyatlar va Tavsiyalar**:
   - 📲 **Auditoriya Eshiklari Uchun QR-kod**: Har bir xona eshigiga QR kod chop etiladi. Inspektor telefon kamerasini tutganda ushbu auditoriya avtomatik ochiladi.
   - ✈️ **Telegram Bot Integratsiyasi**: Kunlik 10:00 va 14:00 da Rektorat va dekanat guruhlariga avtomatik qisqacha svodka yuborish.
   - 🔄 **HEMIS API Moslashuvchanligi**: HEMIS dars jadvallari va talabalar kontingenti bilan to'g'ridan-to'g'ri integratsiyalashga tayyor backend.
   - 📴 **Offline PWA / Kesh**: Wi-Fi yoki internet uzilgan paytda ham davomat olinib, tarmoq paydo bo'lganda avtomatik serverga jo'natiladi.

---

## 🏛 Institutdagi 5 ta Fakultet va Yo'nalishlar (Jami: 221 ta guruh, 5,151 ta talaba)

1. **Aniq fanlar oliy maktabi** (31 ta guruh, 696 talaba: Fizika, Astronomiya, Matematika, Amaliy matematika, ATT, Sun'iy intellekt, 4-kurs)
2. **Filologiya fakulteti** (70 ta guruh, 1,488 talaba: O'zbek tili va adabiyoti, Rus tili va adabiyoti, Xorijiy til va adabiyoti / Ingliz tili)
3. **Ijtimoiy va amaliy fanlar fakulteti** (46 ta guruh, 1,086 talaba: Tarix, Milliy g'oya, Jismoniy madaniyat, Musiqa ta'limi, TSMG)
4. **Boshlang'ich ta'lim fakulteti** (48 ta guruh, 1,243 talaba: Boshlang'ich ta'lim, Maktabgacha ta'lim)
5. **Pedagogika fakulteti** (26 ta guruh, 638 talaba: Pedagogika va psixologiya, Geografiya, Biologiya, Kimyo, Texnologik ta'lim)

---

## 💻 Qanday Ishga Tushiriladi?

Server allaqachon fonda faol ishlab turibdi:

1. **Kompyuterda ochish**:
   Brauzerda: [http://localhost:3000](http://localhost:3000)

2. **Telefonda ochish (Wi-Fi orqali)**:
   Telefoningizdan ushbu manzilga kiring:
   👉 **`http://172.10.11.59:3000`** *(yoki kompyuteringizning mahalliy IP manzili)*

3. **Serverni qayta ishga tushirish (zarurat bo'lsa)**:
   ```powershell
   npm start
   # yoki
   node server.js
   ```

---

## 📂 Fayllar Strukturasi

- `DAVOMAT.xlsx` — Asosiy jonli sinxronlanuvchi Excel fayli
- `DAVOMAT_template_original.xlsx` — Boshlang'ich nusxa (xavfsizlik uchun)
- `server.js` — Express backend va REST API
- `services/excelService.js` — ExcelJS orqali katakchalarni aniqlash, formulalarni yangilash va yozish servisi
- `services/statsService.js` — Real-vaqt monitoringi va tahlil servisi
- `data/faculties.json` — 5 ta fakultet, yo'nalishlar va HEMIS guruhlari bazasi
- `data/teachers.json` — O'qituvchilar bazasi
- `data/rooms.json` — Auditoriyalar bazasi
- `data/attendance.json` — Barcha davomat tekshiruvlari jurnali
- `public/index.html` — Mobil va desktop moslashuvchan Single Page Application
- `public/css/style.css` — Zamonaviy UrDPI korporativ dizayn tizimi
- `public/js/app.js` — Barcha interaktiv funksiyalar va integratsiyalar
