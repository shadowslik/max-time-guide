// Стиль карты для MapLibre.
//
// По умолчанию — растровые тайлы OpenStreetMap: ключ не нужен, работает сразу
// из коробки. Если задан VITE_MAPTILER_KEY, берём векторный стиль MapTiler:
// у него есть настоящая тёмная схема, без CSS-инверсии тайлов.
//
// Атрибуция обязательна в обоих случаях и выводится контролом MapLibre.

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

export const hasVectorStyle = Boolean(MAPTILER_KEY);

const OSM_RASTER = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function mapStyle(theme) {
  if (!MAPTILER_KEY) return OSM_RASTER;
  const name = theme === 'dark' ? 'streets-v2-dark' : 'streets-v2';
  return `https://api.maptiler.com/maps/${name}/style.json?key=${MAPTILER_KEY}`;
}
