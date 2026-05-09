const holidays2026 = require('../../data/hk-holidays/2026.json');

function hkTodayYmd(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' });
}

function isWeekend(ymd) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function normalizeHolidaySet(holidayList) {
  return new Set((holidayList || []).map(String));
}

function addBusinessDays(startYmd, businessDays, holidaySet) {
  const holidays = holidaySet || normalizeHolidaySet(holidays2026);
  let cursor = String(startYmd);
  let left = Number(businessDays);
  if (!Number.isFinite(left) || left < 0) throw new Error('businessDays must be >= 0');

  while (left > 0) {
    cursor = addDaysYmd(cursor, 1);
    if (isWeekend(cursor)) continue;
    if (holidays.has(cursor)) continue;
    left -= 1;
  }

  return cursor;
}

module.exports = {
  hkTodayYmd,
  isWeekend,
  addDaysYmd,
  normalizeHolidaySet,
  addBusinessDays
};

