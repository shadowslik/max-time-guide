// Стиль карты для MapLibre.
//
// По умолчанию — векторные тайлы OpenFreeMap: ключ не нужен, лимитов нет, есть
// светлый и тёмный стили, использование в приложениях разрешено. Раньше брали
// tile.openstreetmap.org (OSM блокирует прод-приложения, HTTP 451) и CARTO
// (теперь требует ключ — «API KEY REQUIRED»). OpenFreeMap свободен от этого.
// Если задан VITE_MAPTILER_KEY — используем векторный стиль MapTiler.
//
// Тема обрабатывается самим стилем (свои светлые/тёмные тайлы), CSS-инверсия
// холста не нужна. Атрибуция обязательна и выводится контролом MapLibre.

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

// Тема задаётся стилем карты (свои светлый/тёмный стили), а не CSS-фильтром.
export const hasVectorStyle = true;

// Готовые стили OpenFreeMap (полноценный MapLibre style JSON по ссылке).
const OPENFREEMAP = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export function mapStyle(theme) {
  if (MAPTILER_KEY) {
    const name = theme === 'dark' ? 'streets-v2-dark' : 'streets-v2';
    return `https://api.maptiler.com/maps/${name}/style.json?key=${MAPTILER_KEY}`;
  }
  return theme === 'dark' ? OPENFREEMAP.dark : OPENFREEMAP.light;
}
