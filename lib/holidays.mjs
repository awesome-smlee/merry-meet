export function normalizeHolidays(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid holiday calendar');
  }

  const calendar = {};
  for (const [year, dates] of Object.entries(data)) {
    if (!/^\d{4}$/.test(year) || !dates || typeof dates !== 'object') {
      throw new Error('Invalid holiday year');
    }

    const holidays = {};
    for (const [date, names] of Object.entries(dates)) {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !date.startsWith(`${year}-`) ||
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date ||
        !Array.isArray(names) ||
        !names.length ||
        names.some(
          (name) =>
            typeof name !== 'string' || !name.trim() || name.length > 100,
        )
      ) {
        throw new Error('Invalid holiday entry');
      }
      holidays[date] = [...new Set(names.map((name) => name.trim()))];
    }
    if (!Object.keys(holidays).length) throw new Error('Empty holiday year');
    calendar[year] = holidays;
  }
  if (!Object.keys(calendar).length) throw new Error('Empty holiday calendar');
  return calendar;
}

export function holidayLabel(names = []) {
  return names
    .map((name) => (name.startsWith('대체공휴일') ? '대체공휴일' : name))
    .filter((name, index, all) => all.indexOf(name) === index)
    .join(' · ');
}
