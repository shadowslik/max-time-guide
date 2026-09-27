// Поиск адреса теперь идёт через бэкенд (GET /api/geocode) — ключ геокодера
// живёт на сервере. Задержку и отмену запроса по-прежнему держит вызывающий
// экран (AddressScreen), сюда просто прокидывается signal.
//
// Координаты везде [долгота, широта].

// Адресный поиск теперь всегда доступен (эндпоинт на бэке есть).
export const hasGeocoder = true;

export async function searchAddress(query, signal) {
  const text = query.trim();
  if (text.length < 3) return [];

  try {
    const response = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`, { signal });
    if (!response.ok) throw new Error(`API ответил ${response.status}`);
    const data = await response.json();
    return data.results ?? [];
  } catch (error) {
    if (error.name === 'AbortError') return [];
    console.warn('[Рядом] Поиск адреса не сработал —', error.message);
    return [];
  }
}
