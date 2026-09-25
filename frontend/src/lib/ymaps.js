// Загрузчик JS API Яндекс.Карт (версия 2.1).
//
// Ключ берётся из VITE_YANDEX_MAPS_API_KEY (см. .env.example).
// Если ключа нет или API не загрузился — возвращаем null, и карта
// рисуется схематично (SchematicMap), приложение остаётся рабочим.
//
// ВНИМАНИЕ про порядок координат: в данных мы храним [долгота, широта]
// (формат GeoJSON), а API 2.1 принимает [широта, долгота]. Разворот
// делает toLatLon — используйте её на каждой границе с API.

const API_KEY = import.meta.env.VITE_YANDEX_MAPS_API_KEY;
const SRC = `https://api-maps.yandex.ru/2.1/?apikey=${API_KEY}&lang=ru_RU`;

export const hasApiKey = Boolean(API_KEY);

export const toLatLon = ([lon, lat]) => [lat, lon];

let loader = null;

function injectScript() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-ymaps]');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.dataset.ymaps = 'true';
    script.onload = resolve;
    script.onerror = () =>
      reject(
        new Error(
          'скрипт не загрузился. Частые причины: ключ выдан под другую версию API ' +
            '(этот код работает с JS API 2.1); в кабинете не заданы ограничения по ' +
            `HTTP referer или IP; текущий origin (${location.origin}) не в списке ` +
            'разрешённых; либо до api-maps.yandex.ru нет сети.',
        ),
      );
    document.head.appendChild(script);
  });
}

export function loadYmaps() {
  if (!hasApiKey) return Promise.resolve(null);
  if (loader) return loader;

  loader = injectScript()
    .then(() => new Promise((resolve) => window.ymaps.ready(resolve)))
    .then(() => window.ymaps)
    .catch((error) => {
      console.warn('[Рядом] Яндекс.Карты недоступны, показываем схематичную карту —', error.message);
      return null;
    });

  return loader;
}
