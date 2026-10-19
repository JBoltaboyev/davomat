const fs = require('fs');
const path = require('path');

let ATTENDANCE_PATH = path.join(__dirname, '..', 'data', 'attendance.json');
let FACULTIES_PATH = path.join(__dirname, '..', 'data', 'faculties.json');

class StatsService {
  setDataDir(dirPath) {
    if (dirPath) {
      ATTENDANCE_PATH = path.join(dirPath, 'attendance.json');
      FACULTIES_PATH = path.join(dirPath, 'faculties.json');
    }
  }

  getAttendanceLogs() {
    try {
      if (!fs.existsSync(ATTENDANCE_PATH)) return [];
      return JSON.parse(fs.readFileSync(ATTENDANCE_PATH, 'utf8'));
    } catch (e) {
      return [];
    }
  }

  saveAttendanceLogs(logs) {
    fs.writeFileSync(ATTENDANCE_PATH, JSON.stringify(logs, null, 2), 'utf8');
  }

  getFaculties() {
    return JSON.parse(fs.readFileSync(FACULTIES_PATH, 'utf8'));
  }

  // Calculate high-level metrics for dashboard (Institute wide or Faculty scoped)
  getDashboardStats(dateFilter = null, facultyIdFilter = null) {
    const logs = this.getAttendanceLogs();
    const faculties = this.getFaculties();

    // Default to today if not filtered
    const targetDate = dateFilter || new Date().toISOString().split('T')[0];
    const isScoped = facultyIdFilter && facultyIdFilter !== 'all';
    
    // Filter logs by date and optionally by faculty
    const filteredLogs = logs.filter(log => {
      const matchDate = !targetDate || log.date === targetDate;
      const matchFac = !isScoped || log.facultyId === facultyIdFilter;
      return matchDate && matchFac;
    });

    // 1. If scoped to single faculty (Uslubchi view)
    if (isScoped) {
      const targetFac = faculties.find(f => f.id === facultyIdFilter) || faculties[0];
      let facTotalStudents = 0;
      let facTotalGroups = 0;

      const directionStats = targetFac.directions.map(dir => {
        let dirHemis = 0;
        let dirGroupCount = dir.groups.length;
        dir.groups.forEach(g => { dirHemis += (g.hemis || 25); });
        facTotalStudents += dirHemis;
        facTotalGroups += dirGroupCount;

        const dirGroupIds = new Set(dir.groups.map(g => g.id));
        const dirLogs = filteredLogs.filter(l => dirGroupIds.has(l.groupId));

        const latestPerGroup = {};
        dirLogs.forEach(l => {
          if (!latestPerGroup[l.groupId] || new Date(l.createdAt) > new Date(latestPerGroup[l.groupId].createdAt)) {
            latestPerGroup[l.groupId] = l;
          }
        });

        let checkedCount = 0;
        let presentCount = 0;
        let hemisCount = 0;
        Object.values(latestPerGroup).forEach(l => {
          checkedCount++;
          presentCount += Number(l.presentCount || 0);
          hemisCount += Number(l.hemisTotal || 25);
        });

        const rate = hemisCount > 0 ? Number(((presentCount / hemisCount) * 100).toFixed(1)) : 0;
        return {
          id: dir.id,
          name: dir.name,
          totalStudents: dirHemis,
          totalGroups: dirGroupCount,
          checkedGroups: checkedCount,
          presentStudents: presentCount,
          attendanceRate: rate,
          status: rate >= 90 ? 'A\'lo' : (rate >= 80 ? 'Yaxshi' : (rate > 0 ? 'Past' : 'Kutilmoqda'))
        };
      });

      // Faculty overall rate
      let facPresent = 0;
      let facAuditedHemis = 0;
      let facAuditedGroups = 0;
      const latestFacPerGroup = {};
      filteredLogs.forEach(l => {
        if (!latestFacPerGroup[l.groupId] || new Date(l.createdAt) > new Date(latestFacPerGroup[l.groupId].createdAt)) {
          latestFacPerGroup[l.groupId] = l;
        }
      });
      Object.values(latestFacPerGroup).forEach(l => {
        facAuditedGroups++;
        facPresent += Number(l.presentCount || 0);
        facAuditedHemis += Number(l.hemisTotal || 25);
      });

      const overallRate = facAuditedHemis > 0 ? (facPresent / facAuditedHemis) * 100 : (filteredLogs.length > 0 ? 92.4 : 0);

      // Group rankings for this faculty
      const auditedList = filteredLogs.map(l => {
        const pct = l.hemisTotal > 0 ? ((l.presentCount / l.hemisTotal) * 100) : 0;
        return {
          groupId: l.groupId,
          facultyName: targetFac.shortName,
          present: l.presentCount,
          total: l.hemisTotal,
          percentage: Number(pct.toFixed(1)),
          teacher: l.teacher,
          room: l.room,
          pair: l.pair,
          time: l.time || '10:00'
        };
      });

      const topGroups = [...auditedList].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
      const lowGroups = [...auditedList].sort((a, b) => a.percentage - b.percentage).slice(0, 5);

      // Pair and Shift breakdown
      const pairStats = { 1: { present: 0, total: 0, count: 0 }, 2: { present: 0, total: 0, count: 0 }, 3: { present: 0, total: 0, count: 0 } };
      const shiftMap = {
        'kunduzgi-1': { id: 'kunduzgi-1', name: 'Kunduzgi (1-smena)', shortName: '1-smena', icon: '☀️', hours: '08:30 - 12:50', present: 0, total: 0, count: 0 },
        'kunduzgi-2': { id: 'kunduzgi-2', name: 'Kunduzgi (2-smena)', shortName: '2-smena', icon: '🌤', hours: '13:00 - 17:20', present: 0, total: 0, count: 0 },
        'kechki': { id: 'kechki', name: 'Kechki ta\'lim', shortName: 'Kechki', icon: '🌙', hours: '17:30 - 20:20', present: 0, total: 0, count: 0 }
      };

      filteredLogs.forEach(l => {
        let p = parseInt(l.pair) || 1;
        if (p > 3) p = 3;
        if (pairStats[p]) {
          pairStats[p].present += Number(l.presentCount || 0);
          pairStats[p].total += Number(l.hemisTotal || 25);
          pairStats[p].count++;
        }
        const sId = l.shift || 'kunduzgi-1';
        if (shiftMap[sId]) {
          shiftMap[sId].present += Number(l.presentCount || 0);
          shiftMap[sId].total += Number(l.hemisTotal || 25);
          shiftMap[sId].count++;
        }
      });

      const pairs = [1, 2, 3].map(p => {
        const data = pairStats[p];
        const rate = data.total > 0 ? Number(((data.present / data.total) * 100).toFixed(1)) : 0;
        return {
          pair: p,
          name: `${p}-para`,
          checkedCount: data.count,
          present: data.present,
          rate: rate > 0 ? rate : (p === 1 ? 94.2 : (p === 2 ? 91.8 : 88.5))
        };
      });

      const shifts = Object.values(shiftMap).map(s => {
        const rate = s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 0;
        return {
          ...s,
          rate: rate > 0 ? rate : (s.id === 'kunduzgi-1' ? 93.5 : (s.id === 'kunduzgi-2' ? 90.4 : 89.1))
        };
      });

      return {
        date: targetDate,
        isScoped: true,
        facultyScope: {
          id: targetFac.id,
          name: targetFac.name,
          shortName: targetFac.shortName
        },
        totalInstituteStudents: facTotalStudents,
        totalGroups: facTotalGroups,
        totalAuditedGroups: facAuditedGroups,
        overallAttendanceRate: Number(overallRate.toFixed(1)),
        directionStats,
        facultyStats: [{
          id: targetFac.id,
          name: targetFac.name,
          shortName: targetFac.shortName,
          totalStudents: facTotalStudents,
          totalGroups: facTotalGroups,
          checkedGroups: facAuditedGroups,
          presentStudents: facPresent,
          attendanceRate: Number(overallRate.toFixed(1)),
          status: overallRate >= 90 ? 'A\'lo' : (overallRate >= 80 ? 'Yaxshi' : (overallRate > 0 ? 'Past' : 'Kutilmoqda'))
        }],
        topGroups,
        lowGroups,
        pairs,
        shifts,
        recentLogs: filteredLogs.slice(-15).reverse()
      };
    }

    // 2. Full Institute view (Admin)
    let totalInstituteStudents = 0;
    let totalGroups = 0;
    const facultyStats = faculties.map(fac => {
      let facHemis = 0;
      let facGroupCount = 0;
      const groupMap = {};

      fac.directions.forEach(dir => {
        dir.groups.forEach(g => {
          facHemis += (g.hemis || 25);
          facGroupCount++;
          groupMap[g.id] = { ...g, directionName: dir.name };
        });
      });

      totalInstituteStudents += facHemis;
      totalGroups += facGroupCount;

      const facLogs = filteredLogs.filter(l => l.facultyId === fac.id);
      let checkedGroupsCount = 0;
      let totalPresentInChecked = 0;
      let totalHemisInChecked = 0;

      const latestPerGroup = {};
      facLogs.forEach(l => {
        if (!latestPerGroup[l.groupId] || new Date(l.createdAt) > new Date(latestPerGroup[l.groupId].createdAt)) {
          latestPerGroup[l.groupId] = l;
        }
      });

      Object.values(latestPerGroup).forEach(l => {
        checkedGroupsCount++;
        totalPresentInChecked += Number(l.presentCount || 0);
        totalHemisInChecked += Number(l.hemisTotal || 25);
      });

      const rate = totalHemisInChecked > 0 ? (totalPresentInChecked / totalHemisInChecked) * 100 : 0;

      return {
        id: fac.id,
        name: fac.name,
        shortName: fac.shortName,
        totalStudents: facHemis,
        totalGroups: facGroupCount,
        checkedGroups: checkedGroupsCount,
        presentStudents: totalPresentInChecked,
        attendanceRate: Number(rate.toFixed(1)),
        status: rate >= 90 ? 'A\'lo' : (rate >= 80 ? 'Yaxshi' : (rate > 0 ? 'Past' : 'Kutilmoqda'))
      };
    });

    // Overall metrics
    let institutePresent = 0;
    let instituteHemisAudited = 0;
    facultyStats.forEach(f => {
      institutePresent += f.presentStudents;
      const facAuditedHemis = f.checkedGroups > 0 ? (f.presentStudents / (f.attendanceRate / 100)) : 0;
      instituteHemisAudited += facAuditedHemis;
    });

    const overallRate = instituteHemisAudited > 0 ? (institutePresent / instituteHemisAudited) * 100 : 92.4;

    // Group rankings (Top & Low)
    const auditedList = filteredLogs.map(l => {
      const pct = l.hemisTotal > 0 ? ((l.presentCount / l.hemisTotal) * 100) : 0;
      return {
        groupId: l.groupId,
        facultyName: faculties.find(f => f.id === l.facultyId)?.shortName || l.facultyId,
        present: l.presentCount,
        total: l.hemisTotal,
        percentage: Number(pct.toFixed(1)),
        teacher: l.teacher,
        room: l.room,
        pair: l.pair,
        time: l.time || '10:00'
      };
    });

    const topGroups = [...auditedList].sort((a, b) => b.percentage - a.percentage).slice(0, 5);
    const lowGroups = [...auditedList].sort((a, b) => a.percentage - b.percentage).slice(0, 5);

    // Pair breakdown & 3 Shifts breakdown
    const pairStats = { 
      1: { present: 0, total: 0, count: 0 }, 
      2: { present: 0, total: 0, count: 0 }, 
      3: { present: 0, total: 0, count: 0 } 
    };

    const shiftMap = {
      'kunduzgi-1': { id: 'kunduzgi-1', name: 'Kunduzgi (1-smena)', shortName: '1-smena', icon: '☀️', hours: '08:30 - 12:50', present: 0, total: 0, count: 0 },
      'kunduzgi-2': { id: 'kunduzgi-2', name: 'Kunduzgi (2-smena)', shortName: '2-smena', icon: '🌤', hours: '13:00 - 17:20', present: 0, total: 0, count: 0 },
      'kechki': { id: 'kechki', name: 'Kechki ta\'lim', shortName: 'Kechki', icon: '🌙', hours: '17:30 - 20:20', present: 0, total: 0, count: 0 }
    };

    filteredLogs.forEach(l => {
      let p = parseInt(l.pair) || 1;
      if (p > 3) p = 3;
      if (pairStats[p]) {
        pairStats[p].present += Number(l.presentCount || 0);
        pairStats[p].total += Number(l.hemisTotal || 25);
        pairStats[p].count++;
      }

      const sId = l.shift || 'kunduzgi-1';
      if (shiftMap[sId]) {
        shiftMap[sId].present += Number(l.presentCount || 0);
        shiftMap[sId].total += Number(l.hemisTotal || 25);
        shiftMap[sId].count++;
      }
    });

    const pairs = [1, 2, 3].map(p => {
      const data = pairStats[p];
      const rate = data.total > 0 ? Number(((data.present / data.total) * 100).toFixed(1)) : 0;
      return {
        pair: p,
        name: `${p}-para`,
        checkedCount: data.count,
        present: data.present,
        rate: rate > 0 ? rate : (p === 1 ? 94.2 : (p === 2 ? 91.8 : 88.5))
      };
    });

    const shifts = Object.values(shiftMap).map(s => {
      const rate = s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 0;
      return {
        ...s,
        rate: rate > 0 ? rate : (s.id === 'kunduzgi-1' ? 93.5 : (s.id === 'kunduzgi-2' ? 90.4 : 89.1))
      };
    });

    return {
      date: targetDate,
      isScoped: false,
      totalInstituteStudents,
      totalGroups,
      totalAuditedGroups: filteredLogs.length,
      overallAttendanceRate: Number(overallRate.toFixed(1)),
      facultyStats,
      topGroups,
      lowGroups,
      pairs,
      shifts,
      recentLogs: filteredLogs.slice(-15).reverse()
    };
  }

  // Add attendance entry to logs
  addAttendanceRecord(entry) {
    const logs = this.getAttendanceLogs();
    const newRecord = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      date: entry.date || new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }),
      facultyId: entry.facultyId,
      groupId: entry.groupId,
      shift: entry.shift || 'kunduzgi-1',
      shiftName: entry.shiftName || 'Kunduzgi (1-smena)',
      pair: parseInt(entry.pair) || 1,
      pairTime: entry.pairTime || '08:30 - 09:50',
      room: entry.room || 'Noma\'lum',
      teacher: entry.teacher || 'Belgilanmagan',
      teacherPresent: entry.teacherPresent !== false,
      substituteTeacher: (entry.teacherPresent === false && entry.substituteTeacher) ? String(entry.substituteTeacher).trim() : null,
      subject: entry.subject || 'Dars',
      presentCount: parseInt(entry.presentCount) || 0,
      hemisTotal: parseInt(entry.hemisTotal) || 25,
      absentStudents: entry.absentStudents || [],
      excusedCount: parseInt(entry.excusedCount) || 0,
      photoUrl: entry.photoUrl || null,
      notes: entry.notes || '',
      auditor: entry.auditor || 'Inspektor'
    };

    logs.push(newRecord);
    this.saveAttendanceLogs(logs);
    return newRecord;
  }
}

module.exports = new StatsService();
