// Клиент «API Получения деталей маршрута» Яндекса (Routing API).
//
// Это отдельный платный продукт со своим ключом — не тем, что у JS API.
// Ключ лежит в VITE_YANDEX_ROUTER_API_KEY.
//
// ВНИМАНИЕ: у Routing API нет ограничения по HTTP referer, поэтому ключ,
// попавший в клиентский бандл, виден любому, кто откроет DevTools. Для
// продакшена запрос нужно унести на бэкенд; здесь он во фронтенде осознанно,
// ради демо. Точка переноса одна — функция requestRoute ниже.

const API_KEY = import.meta.env.VITE_YANDEX_ROUTER_API_KEY;
const ENDPOINT = 'https://api.routing.yandex.net/v2/route';

export const hasRouterKey = Boolean(API_KEY);

// В данных координаты лежат как [долгота, широта], API ждёт «широта,долгота».
const toWaypoint = ([lon, lat]) => `${lat},${lon}`;

async function requestRoute(points) {
  const url =
    `${ENDPOINT}?apikey=${encodeURIComponent(API_KEY)}` +
    `&waypoints=${encodeURIComponent(points.map(toWaypoint).join('|'))}` +
    '&mode=walking';

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Routing API ответил ${response.status}`);
  }
  return response.json();
}

// Возвращает { line, legs } либо null, если маршрут построить не удалось.
//   line — [[широта, долгота], …] в порядке, который ждут Яндекс.Карты 2.1;
//   legs — по одному участку на пару соседних точек: { duration (мин), length (м) }.
export async function fetchRouteDetails(points) {
  if (!hasRouterKey || points.length < 2) return null;

  try {
    const data = await requestRoute(points);
    const legs = data?.route?.legs;
    if (!Array.isArray(legs) || !legs.length) return null;

    const line = [];
    const summary = [];

    for (const leg of legs) {
      let seconds = 0;
      let meters = 0;
      for (const step of leg.steps ?? []) {
        seconds += step.duration ?? 0;
        meters += step.length ?? 0;
        for (const point of step.polyline?.points ?? []) line.push(point);
      }
      summary.push({ duration: Math.round(seconds / 60), length: Math.round(meters) });
    }

    return line.length > 1 ? { line, legs: summary } : null;
  } catch (error) {
    console.warn('[Рядом] Маршрут не построен, рисуем прямую линию —', error.message);
    return null;
  }
}

// Ссылка на пеший маршрут в Яндекс.Картах — для кнопки «Открыть маршрут».
export function externalRouteUrl(points) {
  const rtext = points.map(toWaypoint).join('~');
  return `https://yandex.ru/maps/?rtext=${encodeURIComponent(rtext)}&rtt=pd`;
}
