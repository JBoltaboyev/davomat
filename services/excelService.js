const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const EXCEL_PATH = path.join(__dirname, '..', 'DAVOMAT.xlsx');
const BACKUP_PATH = path.join(__dirname, '..', 'DAVOMAT_template_original.xlsx');
const FACULTIES_PATH = path.join(__dirname, '..', 'data', 'faculties.json');

// Column mapping for days of week:
// Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5, Saturday = 6
const DAY_BASE_COLS = {
  1: 5,  // Dushanba: Col E (5), F (6), G (7), % H (8)
  2: 9,  // Seshanba: Col I (9), J (10), K (11), % L (12)
  3: 13, // Chorshanba: Col M (13), N (14), O (15), % P (16)
  4: 17, // Payshanba: Col Q (17), R (18), S (19), % T (20)
  5: 21, // Juma: Col U (21), V (22), W (23), % X (24)
  6: 25  // Shanba: Col Y (25), Z (26), AA (27), % AB (28)
};

const DAY_NAMES = {
  1: 'DUSHANBA',
  2: 'SESHANBA',
  3: 'CHORSHANBA',
  4: 'PAYSHANBA',
  5: 'JUMA',
  6: 'SHANBA'
};

class ExcelService {
  constructor() {
    this.excelPath = EXCEL_PATH;
    this.facultiesPath = FACULTIES_PATH;
  }

  setPaths(excelPath, facultiesPath) {
    if (excelPath) this.excelPath = excelPath;
    if (facultiesPath) this.facultiesPath = facultiesPath;
  }

  getFacultiesData() {
    return JSON.parse(fs.readFileSync(this.facultiesPath || FACULTIES_PATH, 'utf8'));
  }

  // Get current week dates (Monday to Saturday)
  getWeekDates(baseDate = new Date()) {
    const d = new Date(baseDate);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));

    const dates = [];
    for (let i = 0; i < 6; i++) {
      const nextDate = new Date(monday);
      nextDate.setDate(monday.getDate() + i);
      dates.push(nextDate.toISOString().split('T')[0]);
    }
    return dates; // [Mon, Tue, Wed, Thu, Fri, Sat]
  }

  // Find or create sheet for a faculty
  ensureFacultySheet(wb, faculty) {
    let sheet = wb.getWorksheet(faculty.sheetName) || 
                wb.getWorksheet(faculty.name) || 
                wb.getWorksheet(faculty.shortName);

    if (!sheet) {
      const targetName = (faculty.sheetName || faculty.shortName || faculty.name).slice(0, 31);
      sheet = wb.addWorksheet(targetName);
      this.setupFacultySheetLayout(sheet, faculty);
    }
    return sheet;
  }

  // Build standard UrDPI sheet layout matching DAVOMAT.xlsx Лист1
  setupFacultySheetLayout(sheet, faculty) {
    sheet.views = [{ state: 'frozen', ySplit: 3, xSplit: 4 }];

    // Row 1: Header
    try {
      sheet.mergeCells('A1:AC1');
    } catch (e) {}
    const r1 = sheet.getCell('A1');
    r1.value = `${faculty.name.toUpperCase()} - KUNDUZGI YO'NALISHLAR DAVOMAT JADVALI`;
    r1.font = { bold: true, size: 14, color: { argb: 'FF1E293B' } };
    r1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    // Row 2: Dates
    const weekDates = this.getWeekDates();
    [1, 2, 3, 4, 5, 6].forEach((dayNum, idx) => {
      const baseCol = DAY_BASE_COLS[dayNum];
      try {
        sheet.mergeCells(2, baseCol, 2, baseCol + 2);
      } catch (e) {}
      const c = sheet.getCell(2, baseCol);
      c.value = weekDates[idx];
      c.font = { bold: true, size: 10 };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    sheet.getRow(2).height = 22;

    // Row 3: Headers
    sheet.getCell('A3').value = 'Fakultet';
    sheet.getCell('B3').value = 'Kurs';
    sheet.getCell('C3').value = 'GURUHLAR';
    sheet.getCell('D3').value = 'HEMISDA';

    [1, 2, 3, 4, 5, 6].forEach(dayNum => {
      const baseCol = DAY_BASE_COLS[dayNum];
      const dayCell = sheet.getCell(3, baseCol);
      dayCell.value = DAY_NAMES[dayNum];
      dayCell.font = { bold: true, size: 10 };
      dayCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const pctCell = sheet.getCell(3, baseCol + 3);
      pctCell.value = 'KUNLIK\nDAVOMAT %';
      pctCell.font = { bold: true, size: 9 };
      pctCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    const haftaCell = sheet.getCell('AC3');
    haftaCell.value = 'HAFTA\nDAVOMATI %';
    haftaCell.font = { bold: true, size: 9 };
    haftaCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getRow(3).height = 28;

    // Apply header styles
    ['A3', 'B3', 'C3', 'D3', 'AC3'].forEach(addr => {
      const cell = sheet.getCell(addr);
      cell.font = { bold: true, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' }
      };
    });

    // Populate rows from faculty.directions.groups
    let currentRow = 4;
    faculty.directions.forEach(dir => {
      dir.groups.forEach(grp => {
        sheet.getCell(`A${currentRow}`).value = currentRow === 4 ? faculty.name : '';
        sheet.getCell(`B${currentRow}`).value = grp.course;
        sheet.getCell(`C${currentRow}`).value = grp.name;
        sheet.getCell(`D${currentRow}`).value = grp.hemis || 25;

        // Daily formulas
        [1, 2, 3, 4, 5, 6].forEach(dayNum => {
          const b = DAY_BASE_COLS[dayNum];
          const colL1 = sheet.getColumn(b).letter;
          const colL3 = sheet.getColumn(b + 2).letter;
          const pctL = sheet.getColumn(b + 3).letter;
          sheet.getCell(`${pctL}${currentRow}`).value = {
            formula: `IFERROR(AVERAGE(${colL1}${currentRow}:${colL3}${currentRow})/D${currentRow},"")`
          };
          sheet.getCell(`${pctL}${currentRow}`).numFmt = '0.0%';
        });

        // Hafta formulasi
        sheet.getCell(`AC${currentRow}`).value = {
          formula: `IFERROR(AVERAGE(H${currentRow},L${currentRow},P${currentRow},T${currentRow},X${currentRow},AB${currentRow}),"")`
        };
        sheet.getCell(`AC${currentRow}`).numFmt = '0.0%';

        currentRow++;
      });
    });

    // Total row
    const totalRow = currentRow;
    sheet.getCell(`C${totalRow}`).value = 'JAMI TALABALAR SONI';
    sheet.getCell(`C${totalRow}`).font = { bold: true };
    sheet.getCell(`D${totalRow}`).value = { formula: `SUM(D4:D${totalRow - 1})` };
    sheet.getCell(`D${totalRow}`).font = { bold: true };

    [1, 2, 3, 4, 5, 6].forEach(dayNum => {
      const b = DAY_BASE_COLS[dayNum];
      for (let p = 0; p < 3; p++) {
        const colLetter = sheet.getColumn(b + p).letter;
        sheet.getCell(`${colLetter}${totalRow}`).value = {
          formula: `SUM(${colLetter}4:${colLetter}${totalRow - 1})`
        };
      }
      const pctL = sheet.getColumn(b + 3).letter;
      const colL1 = sheet.getColumn(b).letter;
      const colL3 = sheet.getColumn(b + 2).letter;
      sheet.getCell(`${pctL}${totalRow}`).value = {
        formula: `IFERROR(AVERAGE(${colL1}${totalRow}:${colL3}${totalRow})/D${totalRow},"")`
      };
      sheet.getCell(`${pctL}${totalRow}`).numFmt = '0.0%';
    });

    sheet.getCell(`AC${totalRow}`).value = {
      formula: `IFERROR(AVERAGE(H${totalRow},L${totalRow},P${totalRow},T${totalRow},X${totalRow},AB${totalRow}),"")`
    };
    sheet.getCell(`AC${totalRow}`).numFmt = '0.0%';

    // Styling borders & widths
    sheet.getColumn('A').width = 24;
    sheet.getColumn('B').width = 8;
    sheet.getColumn('C').width = 26;
    sheet.getColumn('D').width = 12;
    for (let c = 5; c <= 29; c++) {
      sheet.getColumn(c).width = (c % 4 === 0 || c === 29) ? 14 : 10;
    }
  }

  // Ensure "UMUMIY MONITORING" overview sheet exists
  ensureOverviewSheet(wb) {
    let sheet = wb.getWorksheet('Umumiy Monitoring');
    if (sheet) {
      return sheet;
    }
    sheet = wb.addWorksheet('Umumiy Monitoring');
    sheet.views = [{ state: 'normal' }];

    // Header
    try {
      sheet.mergeCells('A1:J1');
    } catch (e) {}
    const title = sheet.getCell('A1');
    title.value = "URGANCH DAVLAT PEDAGOGIKA INSTITUTI (UrDPI) - UMUMIY DAVOMAT MONITORINGI";
    title.font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 36;

    try {
      sheet.mergeCells('A2:J2');
    } catch (e) {}
    const sub = sheet.getCell('A2');
    sub.value = `Oxirgi yangilanish: ${new Date().toLocaleString('uz-UZ')} | Barcha 5 ta fakultet bo'yicha integratsiyalangan hisobot`;
    sub.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 20;

    // Headers
    const headers = [
      '№', 'Fakultet nomi', 'Guruhlar soni', 'HEMIS talabalar soni',
      'Bugun qatnashganlar', 'Kunlik davomat %', 'Haftalik o\'rtacha %', 'Holat'
    ];
    sheet.getRow(4).values = headers;
    sheet.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(4).height = 28;

    for (let i = 1; i <= headers.length; i++) {
      const cell = sheet.getRow(4).getCell(i);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 38;
    sheet.getColumn(3).width = 16;
    sheet.getColumn(4).width = 22;
    sheet.getColumn(5).width = 22;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 20;
    sheet.getColumn(8).width = 16;

    return sheet;
  }

  // Update Excel live when attendance is submitted
  async recordAttendance(entry) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(this.excelPath);
    } catch (e) {
      if (fs.existsSync(BACKUP_PATH)) {
        await wb.xlsx.readFile(BACKUP_PATH);
      } else {
        throw e;
      }
    }

    const faculties = this.getFacultiesData();
    const faculty = faculties.find(f => f.id === entry.facultyId) || faculties[0];

    // Ensure all 5 faculty sheets exist in workbook
    faculties.forEach(fac => {
      this.ensureFacultySheet(wb, fac);
    });

    // Target sheet for this attendance
    let sheetName = faculty.sheetName || faculty.name;
    let targetSheet = wb.getWorksheet(sheetName);
    if (!targetSheet) {
      targetSheet = this.ensureFacultySheet(wb, faculty);
    }

    // Determine target column based on date and pair
    const dateObj = new Date(entry.date || new Date());
    let dayOfWeek = dateObj.getDay(); // 0: Sun, 1: Mon, ...
    if (dayOfWeek === 0) dayOfWeek = 1; // Default to Monday if Sunday
    if (dayOfWeek > 6) dayOfWeek = 6;

    const baseCol = DAY_BASE_COLS[dayOfWeek];
    const pair = Math.min(Math.max(parseInt(entry.pair) || 1, 1), 3);
    const targetCol = baseCol + (pair - 1);

    // Find row for group
    let targetRow = null;
    const cleanGroupName = (entry.groupId || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim().toLowerCase();

    // Scan column C (GURUHLAR)
    for (let r = 4; r <= targetSheet.rowCount; r++) {
      const cellVal = targetSheet.getCell(`C${r}`).value;
      if (cellVal && String(cellVal).replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim().toLowerCase() === cleanGroupName) {
        targetRow = r;
        break;
      }
    }

    // If not found in Sheet, append group
    if (!targetRow) {
      targetRow = targetSheet.rowCount + 1;
      targetSheet.getCell(`C${targetRow}`).value = entry.groupId;
      targetSheet.getCell(`D${targetRow}`).value = entry.hemisTotal || 25;
    }

    // Write attendance count to the exact cell (no cell notes)
    const cell = targetSheet.getCell(targetRow, targetCol);
    cell.value = parseInt(entry.presentCount, 10);
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    if (cell.note) {
      delete cell.note;
    }

    // Helper to get numeric value
    const parseNum = (v) => {
      if (typeof v === 'number') return v;
      if (v && typeof v.result === 'number') return v.result;
      const parsed = parseFloat(v);
      return !isNaN(parsed) ? parsed : null;
    };

    // Calculate and store formula result for this group's daily %
    const hemisVal = parseNum(targetSheet.getCell(`D${targetRow}`).value) || 25;
    const p1 = parseNum(targetSheet.getCell(targetRow, baseCol).value);
    const p2 = parseNum(targetSheet.getCell(targetRow, baseCol + 1).value);
    const p3 = parseNum(targetSheet.getCell(targetRow, baseCol + 2).value);
    const pairNums = [p1, p2, p3].filter(v => v !== null);

    if (pairNums.length > 0 && hemisVal > 0) {
      const avgDay = pairNums.reduce((a, b) => a + b, 0) / pairNums.length;
      const dayRate = +(avgDay / hemisVal).toFixed(4);
      const dayPctCell = targetSheet.getCell(targetRow, baseCol + 3);
      const colL1 = targetSheet.getColumn(baseCol).letter;
      const colL3 = targetSheet.getColumn(baseCol + 2).letter;
      const formula = dayPctCell.value && dayPctCell.value.formula
        ? dayPctCell.value.formula
        : `IFERROR(AVERAGE(${colL1}${targetRow}:${colL3}${targetRow})/D${targetRow},"")`;
      dayPctCell.value = { formula, result: dayRate };
      dayPctCell.numFmt = '0.0%';
    }

    // Calculate weekly rate
    const weekBaseCols = [5, 9, 13, 17, 21, 25];
    const dayRates = [];
    weekBaseCols.forEach(b => {
      const cellVal = targetSheet.getCell(targetRow, b + 3).value;
      const rate = parseNum(cellVal);
      if (rate !== null) dayRates.push(rate);
    });

    if (dayRates.length > 0) {
      const haftaRate = +(dayRates.reduce((a, b) => a + b, 0) / dayRates.length).toFixed(4);
      const haftaCell = targetSheet.getCell(`AC${targetRow}`);
      const hFormula = haftaCell.value && haftaCell.value.formula
        ? haftaCell.value.formula
        : `IFERROR(AVERAGE(H${targetRow},L${targetRow},P${targetRow},T${targetRow},X${targetRow},AB${targetRow}),"")`;
      haftaCell.value = { formula: hFormula, result: haftaRate };
      haftaCell.numFmt = '0.0%';
    }

    // Recalculate faculty sheet and overview sheet, ensure all notes are removed
    this.clearAllNotes(wb);
    this.recalculateFacultySheet(targetSheet, faculty);
    this.updateOverviewSheetData(wb, faculties);

    // Save workbook
    await wb.xlsx.writeFile(this.excelPath);

    return {
      success: true,
      sheet: targetSheet.name,
      row: targetRow,
      col: targetCol,
      cell: cell.address,
      value: cell.value
    };
  }

  // Synchronize attendance logs from JSON DB into workbook sheets
  syncAttendanceLogs(wb) {
    const attendanceFile = path.join(__dirname, '..', 'data', 'attendance.json');
    if (!fs.existsSync(attendanceFile)) return;
    let logs = [];
    try {
      logs = JSON.parse(fs.readFileSync(attendanceFile, 'utf8'));
    } catch (e) {
      return;
    }

    const faculties = this.getFacultiesData();

    logs.forEach(l => {
      const d = new Date(l.date || new Date());
      let dow = d.getDay();
      if (dow === 0) dow = 1;
      if (dow > 6) dow = 6;
      const baseCol = DAY_BASE_COLS[dow] || 5;
      const pair = Math.min(Math.max(parseInt(l.pair) || 1, 1), 3);
      const targetCol = baseCol + (pair - 1);

      const fac = faculties.find(f => f.id === l.facultyId) || faculties[0];
      const sheet = wb.getWorksheet(fac.sheetName || fac.name) || wb.getWorksheet(fac.shortName);
      if (!sheet) return;

      const cleanGroupName = (l.groupId || '').replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim().toLowerCase();
      let targetRow = null;
      sheet.eachRow((r, ri) => {
        if (ri >= 4) {
          const val = r.getCell(3).value;
          if (val && String(val).replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim().toLowerCase() === cleanGroupName) {
            targetRow = ri;
          }
        }
      });

      if (targetRow) {
        const cell = sheet.getCell(targetRow, targetCol);
        cell.value = parseInt(l.presentCount, 10);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (cell.note) {
          delete cell.note;
        }
      }
    });
  }

  // Recalculate formulas and computed values for a faculty sheet
  recalculateFacultySheet(sheet, faculty) {
    if (!sheet) return;

    const parseNum = (v) => {
      if (typeof v === 'number') return v;
      if (v && typeof v.result === 'number') return v.result;
      const parsed = parseFloat(v);
      return !isNaN(parsed) ? parsed : null;
    };

    let jamiRowIdx = null;
    sheet.eachRow((r, ri) => {
      if (ri >= 4 && String(r.getCell(3).value || '').includes('JAMI')) {
        jamiRowIdx = ri;
      }
    });

    const maxDataRow = jamiRowIdx ? (jamiRowIdx - 1) : sheet.rowCount;

    // 1. Recalculate group rows
    for (let r = 4; r <= maxDataRow; r++) {
      const hemisVal = parseNum(sheet.getCell(r, 4).value) || 25;
      const groupDayRates = [];

      for (let dow = 1; dow <= 6; dow++) {
        const bCol = DAY_BASE_COLS[dow];
        const p1 = parseNum(sheet.getCell(r, bCol).value);
        const p2 = parseNum(sheet.getCell(r, bCol + 1).value);
        const p3 = parseNum(sheet.getCell(r, bCol + 2).value);
        const pairs = [p1, p2, p3].filter(v => v !== null);

        if (pairs.length > 0 && hemisVal > 0) {
          const avgDay = pairs.reduce((a, b) => a + b, 0) / pairs.length;
          const dayRate = Math.min(+(avgDay / hemisVal).toFixed(4), 1.0);
          const colL1 = sheet.getColumn(bCol).letter;
          const colL3 = sheet.getColumn(bCol + 2).letter;
          sheet.getCell(r, bCol + 3).value = {
            formula: `IFERROR(AVERAGE(${colL1}${r}:${colL3}${r})/D${r},"")`,
            result: dayRate
          };
          sheet.getCell(r, bCol + 3).numFmt = '0.0%';
          groupDayRates.push(dayRate);
        }
      }

      if (groupDayRates.length > 0) {
        const haftaRate = Math.min(+(groupDayRates.reduce((a, b) => a + b, 0) / groupDayRates.length).toFixed(4), 1.0);
        sheet.getCell(r, 29).value = {
          formula: `IFERROR(AVERAGE(H${r},L${r},P${r},T${r},X${r},AB${r}),"")`,
          result: haftaRate
        };
        sheet.getCell(r, 29).numFmt = '0.0%';
      }
    }

    // 2. Recalculate JAMI row
    if (jamiRowIdx) {
      let facHemis = 0;
      for (let r = 4; r <= maxDataRow; r++) {
        facHemis += (parseNum(sheet.getCell(r, 4).value) || 25);
      }
      sheet.getCell(jamiRowIdx, 4).value = { formula: `SUM(D4:D${maxDataRow})`, result: facHemis };

      const jamiDayRates = [];
      for (let dow = 1; dow <= 6; dow++) {
        const bCol = DAY_BASE_COLS[dow];
        const activePairSums = [];

        for (let p = 0; p < 3; p++) {
          const colIdx = bCol + p;
          const colLetter = sheet.getColumn(colIdx).letter;
          let colSum = 0;
          let hasColVal = false;
          for (let r = 4; r <= maxDataRow; r++) {
            const v = parseNum(sheet.getCell(r, colIdx).value);
            if (v !== null) {
              colSum += v;
              hasColVal = true;
            }
          }
          if (hasColVal) {
            sheet.getCell(jamiRowIdx, colIdx).value = {
              formula: `SUM(${colLetter}4:${colLetter}${maxDataRow})`,
              result: colSum
            };
            activePairSums.push(colSum);
          }
        }

        if (activePairSums.length > 0 && facHemis > 0) {
          const avgJamiDay = activePairSums.reduce((a, b) => a + b, 0) / activePairSums.length;
          const dayRate = Math.min(+(avgJamiDay / facHemis).toFixed(4), 1.0);
          const colL1 = sheet.getColumn(bCol).letter;
          const colL3 = sheet.getColumn(bCol + 2).letter;
          sheet.getCell(jamiRowIdx, bCol + 3).value = {
            formula: `IFERROR(AVERAGE(${colL1}${jamiRowIdx}:${colL3}${jamiRowIdx})/D${jamiRowIdx},"")`,
            result: dayRate
          };
          sheet.getCell(jamiRowIdx, bCol + 3).numFmt = '0.0%';
          jamiDayRates.push(dayRate);
        }
      }

      if (jamiDayRates.length > 0) {
        const weekRate = Math.min(+(jamiDayRates.reduce((a, b) => a + b, 0) / jamiDayRates.length).toFixed(4), 1.0);
        sheet.getCell(jamiRowIdx, 29).value = {
          formula: `IFERROR(AVERAGE(H${jamiRowIdx},L${jamiRowIdx},P${jamiRowIdx},T${jamiRowIdx},X${jamiRowIdx},AB${jamiRowIdx}),"")`,
          result: weekRate
        };
        sheet.getCell(jamiRowIdx, 29).numFmt = '0.0%';
      }
    }
  }

  // Remove all cell notes/comments across all worksheets
  clearAllNotes(wb) {
    wb.worksheets.forEach(ws => {
      ws.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: false }, cell => {
          delete cell._comment;
          if (cell._value && cell._value.model && cell._value.model.comment) {
            delete cell._value.model.comment;
          }
        });
      });
    });
  }

  // Recalculate all faculty sheets in workbook
  recalculateAllSheets(wb) {
    this.clearAllNotes(wb);
    const faculties = this.getFacultiesData();
    faculties.forEach(fac => {
      const sheet = wb.getWorksheet(fac.sheetName || fac.name) || wb.getWorksheet(fac.shortName);
      if (sheet) {
        this.recalculateFacultySheet(sheet, fac);
      }
    });
  }

  // Refresh Overview sheet with calculated totals from all sheets
  updateOverviewSheetData(wb, faculties) {
    const overview = this.ensureOverviewSheet(wb);
    let rowIdx = 5;
    let grandTotalGroups = 0;
    let grandTotalHemis = 0;
    let grandTotalPresent = 0;
    let grandTotalCheckedHemis = 0;
    let grandTotalCheckedGroups = 0;

    const subCell = overview.getCell('A2');
    if (subCell) {
      subCell.value = `Oxirgi yangilanish: ${new Date().toLocaleString('uz-UZ')} | Barcha 5 ta fakultet bo'yicha integratsiyalangan hisobot`;
    }

    const todayDate = new Date();
    let todayDayOfWeek = todayDate.getDay();
    if (todayDayOfWeek === 0) todayDayOfWeek = 1;
    if (todayDayOfWeek > 6) todayDayOfWeek = 6;
    const todayBaseCol = DAY_BASE_COLS[todayDayOfWeek] || 5;

    const parseNum = (v) => {
      if (typeof v === 'number') return v;
      if (v && typeof v.result === 'number') return v.result;
      const parsed = parseFloat(v);
      return !isNaN(parsed) ? parsed : null;
    };

    faculties.forEach((fac, idx) => {
      const sheet = wb.getWorksheet(fac.sheetName || fac.name) || wb.getWorksheet(fac.shortName);
      let groupCount = 0;
      let hemisSum = 0;

      fac.directions.forEach(d => {
        d.groups.forEach(g => {
          groupCount++;
          hemisSum += (g.hemis || 25);
        });
      });

      let presentSum = 0;
      let checkedGroupsCount = 0;
      let checkedHemisSum = 0;
      const weeklyRates = [];

      if (sheet) {
        let jamiRowIdx = null;
        sheet.eachRow((r, i) => {
          if (i >= 4 && String(r.getCell(3).value || '').includes('JAMI')) {
            jamiRowIdx = i;
          }
        });
        const maxDataRow = jamiRowIdx ? (jamiRowIdx - 1) : sheet.rowCount;

        for (let r = 4; r <= maxDataRow; r++) {
          const hemisVal = parseNum(sheet.getCell(r, 4).value) || 25;
          const p1 = parseNum(sheet.getCell(r, todayBaseCol).value);
          const p2 = parseNum(sheet.getCell(r, todayBaseCol + 1).value);
          const p3 = parseNum(sheet.getCell(r, todayBaseCol + 2).value);
          const pairs = [p1, p2, p3].filter(v => v !== null);

          if (pairs.length > 0) {
            checkedGroupsCount++;
            checkedHemisSum += hemisVal;
            const groupAvg = pairs.reduce((a, b) => a + b, 0) / pairs.length;
            presentSum += Math.round(groupAvg);
          }

          const weekVal = parseNum(sheet.getCell(r, 29).value);
          if (weekVal !== null && weekVal > 0) {
            weeklyRates.push(weekVal);
          }
        }
      }

      grandTotalGroups += groupCount;
      grandTotalHemis += hemisSum;
      grandTotalPresent += presentSum;
      grandTotalCheckedHemis += checkedHemisSum;
      grandTotalCheckedGroups += checkedGroupsCount;

      const dayRate = checkedHemisSum > 0 ? (presentSum / checkedHemisSum) : 0;
      let haftaRate = dayRate;
      if (weeklyRates.length > 0) {
        haftaRate = weeklyRates.reduce((a, b) => a + b, 0) / weeklyRates.length;
      }
      haftaRate = Math.min(haftaRate, 1.0);

      const statusText = checkedGroupsCount === 0
        ? 'Kutilmoqda'
        : (dayRate >= 0.9 ? 'A\'lo' : (dayRate >= 0.8 ? 'Yaxshi' : 'Qoniqarli'));

      const row = overview.getRow(rowIdx);
      row.values = [
        idx + 1,
        fac.name,
        groupCount,
        hemisSum,
        checkedGroupsCount > 0 ? presentSum : '-',
        checkedGroupsCount > 0 ? (dayRate * 100).toFixed(1) + '%' : '-',
        haftaRate > 0 ? (haftaRate * 100).toFixed(1) + '%' : (checkedGroupsCount > 0 ? (dayRate * 100).toFixed(1) + '%' : '-'),
        statusText
      ];
      row.alignment = { vertical: 'middle' };
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };

      const statusCell = row.getCell(8);
      if (statusText === "A'lo") statusCell.font = { color: { argb: 'FF16A34A' }, bold: true };
      else if (statusText === 'Yaxshi') statusCell.font = { color: { argb: 'FF2563EB' }, bold: true };
      else if (statusText === 'Qoniqarli') statusCell.font = { color: { argb: 'FFF59E0B' }, bold: true };
      else statusCell.font = { color: { argb: 'FF94A3B8' }, italic: true };

      rowIdx++;
    });

    // Grand total row
    const grandDayRate = grandTotalCheckedHemis > 0 ? (grandTotalPresent / grandTotalCheckedHemis) : 0;
    const grandRow = overview.getRow(rowIdx);
    grandRow.values = [
      '',
      'INSTITUT BO\'YICHA JAMI',
      grandTotalGroups,
      grandTotalHemis,
      grandTotalCheckedGroups > 0 ? grandTotalPresent : '-',
      grandTotalCheckedGroups > 0 ? (grandDayRate * 100).toFixed(1) + '%' : '-',
      grandTotalCheckedGroups > 0 ? (grandDayRate * 100).toFixed(1) + '%' : '-',
      grandTotalCheckedGroups === 0 ? 'Kutilmoqda' : (grandDayRate >= 0.85 ? 'Barqaror' : 'Nazoratda')
    ];
    grandRow.font = { bold: true };
    grandRow.alignment = { vertical: 'middle' };
    grandRow.getCell(2).alignment = { horizontal: 'left' };
    grandRow.getCell(3).alignment = { horizontal: 'center' };
    grandRow.getCell(4).alignment = { horizontal: 'center' };
    grandRow.getCell(5).alignment = { horizontal: 'center' };
    grandRow.getCell(6).alignment = { horizontal: 'center' };
    grandRow.getCell(7).alignment = { horizontal: 'center' };
    grandRow.getCell(8).alignment = { horizontal: 'center' };

    const grandStatusCell = grandRow.getCell(8);
    if (grandDayRate >= 0.85) grandStatusCell.font = { color: { argb: 'FF16A34A' }, bold: true };
    else if (grandDayRate > 0) grandStatusCell.font = { color: { argb: 'FFF59E0B' }, bold: true };
    else grandStatusCell.font = { color: { argb: 'FF94A3B8' }, italic: true };

    grandRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
  }

  // Read full grid for browser display
  async getFacultyGrid(facultyId) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(this.excelPath);

    const faculties = this.getFacultiesData();
    const faculty = faculties.find(f => f.id === facultyId) || faculties[0];

    const sheet = wb.getWorksheet(faculty.sheetName || faculty.name) || wb.getWorksheet(faculty.shortName) || wb.worksheets[0];

    const grid = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowValues = [];
      for (let c = 1; c <= 29; c++) {
        let val = row.getCell(c).value;
        // ExcelJS returns various object types for cell values:
        // - { formula, result } — formula cells
        // - { richText: [...] } — rich text cells
        // - { error: ... } — error cells
        // - { text, hyperlink } — hyperlink cells
        // - Date objects
        // - plain strings/numbers
        if (val !== null && val !== undefined && typeof val === 'object') {
          if (val instanceof Date) {
            // Format dates nicely
            val = val.toLocaleDateString('uz-UZ');
          } else if (val.result !== undefined) {
            // Formula cell — use computed result
            val = val.result;
          } else if (val.formula !== undefined) {
            // Formula without result yet
            val = '';
          } else if (Array.isArray(val.richText)) {
            // Rich text — concatenate text segments
            val = val.richText.map(rt => rt.text || '').join('');
          } else if (val.text !== undefined) {
            // Hyperlink or shared string
            val = val.text;
          } else if (val.error !== undefined) {
            // Error cell
            val = '';
          } else {
            // Any other unknown object — force to empty
            val = '';
          }
        }
        rowValues.push(val !== undefined && val !== null ? val : '');
      }
      // Dynamically calculate missing day % and hafta % for rows >= 4
      if (rowNumber >= 4) {
        const hemisVal = parseFloat(rowValues[3]) || 0;
        const dayPctIndices = [7, 11, 15, 19, 23, 27];
        const dayRates = [];

        dayPctIndices.forEach(pctIdx => {
          let currPct = rowValues[pctIdx];
          if (currPct !== '' && currPct !== null && currPct !== undefined && !isNaN(parseFloat(currPct))) {
            dayRates.push(parseFloat(currPct));
          } else {
            const p1 = parseFloat(rowValues[pctIdx - 3]);
            const p2 = parseFloat(rowValues[pctIdx - 2]);
            const p3 = parseFloat(rowValues[pctIdx - 1]);
            const pairs = [p1, p2, p3].filter(v => !isNaN(v));

            if (pairs.length > 0 && hemisVal > 0) {
              const avg = pairs.reduce((a, b) => a + b, 0) / pairs.length;
              const rate = +(avg / hemisVal).toFixed(4);
              rowValues[pctIdx] = rate;
              dayRates.push(rate);
            }
          }
        });

        // Hafta % (column index 28)
        let weekPct = rowValues[28];
        if ((weekPct === '' || weekPct === null || weekPct === undefined || isNaN(parseFloat(weekPct))) && dayRates.length > 0) {
          const avgWeek = dayRates.reduce((a, b) => a + b, 0) / dayRates.length;
          rowValues[28] = +avgWeek.toFixed(4);
        }
      }

      grid.push({ rowNumber, values: rowValues });
    });

    // Also compute JAMI row sums & percentages if empty
    const jamiRowObj = grid.find(r => r.rowNumber >= 4 && String(r.values[2] || '').includes('JAMI'));
    if (jamiRowObj) {
      const dataRows = grid.filter(r => r.rowNumber >= 4 && !String(r.values[2] || '').includes('JAMI'));
      // Total Hemis
      if (!jamiRowObj.values[3] || isNaN(parseFloat(jamiRowObj.values[3]))) {
        const totHemis = dataRows.reduce((sum, r) => sum + (parseFloat(r.values[3]) || 0), 0);
        jamiRowObj.values[3] = totHemis;
      }
      const totHemis = parseFloat(jamiRowObj.values[3]) || 1;

      // For each day (columns 4..27)
      const dayCols = [4, 8, 12, 16, 20, 24];
      const jamiDayRates = [];
      dayCols.forEach(bCol => {
        const pairAverages = [];
        for (let p = 0; p < 3; p++) {
          const colIdx = bCol + p;
          const colSum = dataRows.reduce((sum, r) => {
            const val = parseFloat(r.values[colIdx]);
            return sum + (!isNaN(val) ? val : 0);
          }, 0);
          const hasAny = dataRows.some(r => !isNaN(parseFloat(r.values[colIdx])));
          if (hasAny) {
            jamiRowObj.values[colIdx] = colSum;
            pairAverages.push(colSum);
          }
        }
        const pctIdx = bCol + 3;
        if (pairAverages.length > 0 && totHemis > 0) {
          const avg = pairAverages.reduce((a, b) => a + b, 0) / pairAverages.length;
          const rate = +(avg / totHemis).toFixed(4);
          jamiRowObj.values[pctIdx] = rate;
          jamiDayRates.push(rate);
        }
      });

      if (jamiDayRates.length > 0) {
        const weekAvg = +(jamiDayRates.reduce((a, b) => a + b, 0) / jamiDayRates.length).toFixed(4);
        jamiRowObj.values[28] = weekAvg;
      }
    }

    return {
      faculty,
      sheetName: sheet.name,
      grid
    };
  }

  // Export single faculty workbook or full workbook
  async exportFacultyWorkbook(facultyId) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(this.excelPath);
    } catch (e) {
      if (fs.existsSync(BACKUP_PATH)) {
        await wb.xlsx.readFile(BACKUP_PATH);
      } else {
        throw e;
      }
    }

    const faculties = this.getFacultiesData();

    // Ensure all 5 faculty sheets exist, sync logs, recalculate formulas and overview
    faculties.forEach(fac => {
      this.ensureFacultySheet(wb, fac);
    });
    this.syncAttendanceLogs(wb);
    this.recalculateAllSheets(wb);
    this.updateOverviewSheetData(wb, faculties);

    // Save recalculated workbook to disk
    try {
      await wb.xlsx.writeFile(this.excelPath);
    } catch (writeErr) {
      console.error('Error saving recalculated workbook:', writeErr);
    }

    if (!facultyId || facultyId === 'all') {
      return wb;
    }

    const faculty = faculties.find(f => f.id === facultyId) || faculties[0];
    const targetSheet = wb.getWorksheet(faculty.sheetName || faculty.name) || wb.getWorksheet(faculty.shortName) || wb.worksheets[0];

    const newWb = new ExcelJS.Workbook();
    newWb.creator = 'UrDPI Davomat Tizimi';
    newWb.created = new Date();

    const newSheet = newWb.addWorksheet((faculty.shortName || faculty.name).slice(0, 31));
    newSheet.views = [{ state: 'frozen', ySplit: 3, xSplit: 4 }];

    // Copy rows and styles
    targetSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const newRow = newSheet.getRow(rowNumber);
      if (row.height) newRow.height = row.height;
      for (let c = 1; c <= 29; c++) {
        const srcCell = row.getCell(c);
        const destCell = newRow.getCell(c);
        destCell.value = srcCell.value;
        if (destCell.note) delete destCell.note;
        if (srcCell.numFmt) destCell.numFmt = srcCell.numFmt;
        if (srcCell.font) destCell.font = JSON.parse(JSON.stringify(srcCell.font));
        if (srcCell.alignment) destCell.alignment = JSON.parse(JSON.stringify(srcCell.alignment));
        if (srcCell.fill) destCell.fill = JSON.parse(JSON.stringify(srcCell.fill));
        if (srcCell.border) destCell.border = JSON.parse(JSON.stringify(srcCell.border));
      }
    });

    // Copy column widths
    for (let c = 1; c <= 29; c++) {
      newSheet.getColumn(c).width = targetSheet.getColumn(c).width || 12;
    }

    // Set merged cells safely
    try {
      newSheet.mergeCells('A1:AC1');
      const weekCols = [5, 9, 13, 17, 21, 25];
      weekCols.forEach(baseCol => {
        try { newSheet.mergeCells(2, baseCol, 2, baseCol + 2); } catch (e) {}
      });
    } catch (e) {}

    return newWb;
  }
}

module.exports = new ExcelService();
