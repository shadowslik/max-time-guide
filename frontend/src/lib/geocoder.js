// Поиск адреса по строке. Используем геокодер MapTiler — он входит в тот же
// бесплатный ключ, что и тайлы. Если ключа нет, пробуем геокодер
// OpenRouteService: он делит квоту с маршрутами, но лучше так, чем никак.
//
// Координаты везде [долгота, широта].

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;
const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;

export const hasGeocoder = Boolean(MAPTILER_KEY || ORS_KEY);

// Подсказки нужны «вокруг города», а не по всему миру.
const FOCUS = [49.1086, 55.7951];

async function searchMapTiler(query, signal) {
  const url =
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json` +
    `?key=${MAPTILER_KEY}&language=ru&country=ru&limit=6` +
    `&proximity=${FOCUS.join(',')}`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`MapTiler ответил ${response.status}`);
  const data = await response.json();

  return (data.features ?? [])
    .filter((f) => Array.isArray(f.center))
    .map((f) => ({
      id: f.id,
      title: f.text || f.place_name,
      subtitle: (f.place_name || '').split(', ').slice(1, 3).join(', '),
      coords: f.center,
    }));
}

async function searchOrs(query, signal) {
  const url =
    'https://api.openrouteservice.org/geocode/search' +
    `?api_key=${ORS_KEY}&text=${encodeURIComponent(query)}&size=6&lang=ru` +
    `&focus.point.lon=${FOCUS[0]}&focus.point.lat=${FOCUS[1]}`;

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`OpenRouteService ответил ${response.status}`);
  const data = await response.json();

  return (data.features ?? []).map((f) => ({
    id: f.properties?.id,
    title: f.properties?.name,
    subtitle: [f.properties?.locality, f.properties?.region].filter(Boolean).join(', '),
    coords: f.geometry?.coordinates,
  }));
}

export async function searchAddress(query, signal) {
  const text = query.trim();
  if (text.length < 3) return [];

  try {
    if (MAPTILER_KEY) return await searchMapTiler(text, signal);
    if (ORS_KEY) return await searchOrs(text, signal);
    return [];
  } catch (error) {
    if (error.name === 'AbortError') return [];
    console.warn('[Рядом] Поиск адреса не сработал —', error.message);
    return [];
  }
}
