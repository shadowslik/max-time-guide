// Стиль карты для MapLibre.
//
// По умолчанию — растровые тайлы CARTO basemaps: ключ не нужен, есть светлая и
// тёмная схемы (light_all / dark_all), и они разрешены для приложений. Раньше
// брали tile.openstreetmap.org напрямую — OSM блокирует прод-приложения (HTTP 451).
// Если задан VITE_MAPTILER_KEY, берём векторный стиль MapTiler.
//
// Тема обрабатывается самим стилем (свои тёмные тайлы), поэтому CSS-инверсия
// холста больше не нужна. Атрибуция обязательна и выводится контролом MapLibre.

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

// Тема задаётся стилем карты (свои светлые/тёмные тайлы), а не CSS-фильтром.
export const hasVectorStyle = true;

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// MapLibre не раскрывает {s}: перечисляем поддомены a–d явно.
function cartoTiles(variant) {
  return ['a', 'b', 'c', 'd'].map(
    (s) => `https://${s}.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}.png`,
  );
}

function cartoStyle(theme) {
  const variant = theme === 'dark' ? 'dark_all' : 'light_all';
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: cartoTiles(variant),
        tileSize: 256,
        maxzoom: 20,
        attribution: CARTO_ATTRIBUTION,
      },
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
  };
}

export function mapStyle(theme) {
  if (!MAPTILER_KEY) return cartoStyle(theme);
  const name = theme === 'dark' ? 'streets-v2-dark' : 'streets-v2';
  return `https://api.maptiler.com/maps/${name}/style.json?key=${MAPTILER_KEY}`;
}
