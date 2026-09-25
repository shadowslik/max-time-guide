// Форматирование времени и текстовых подписей.

export function formatDuration(min) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}

// «2 часа», «1,5 часа», «30 мин» — как в кнопках выбора времени.
export function formatBudget(min) {
  if (min < 60) return `${min} мин`;
  const hours = min / 60;
  if (Number.isInteger(hours)) {
    const word = hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов';
    return `${hours} ${word}`;
  }
  return `${String(hours).replace('.', ',')} часа`;
}

export function clock(date) {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

export function formatDate(date) {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

// «История, Архитектура» или «Что угодно», если ничего не выбрано.
export function interestsLabel(ids, interests) {
  if (!ids.length) return 'Что угодно';
  return ids
    .map((id) => interests.find((i) => i.id === id)?.label)
    .filter(Boolean)
    .join(', ');
}
