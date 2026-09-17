// Date-only calendar cells retain their labels; the default "today" is WIB.
export function todayWib(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function toLocalDateKey(date) {
  if (date === undefined) return todayWib();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromLocalDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function shiftCalendarMonth(dateKey, offset) {
  const date = fromLocalDateKey(dateKey);
  const target = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return toLocalDateKey(target);
}
