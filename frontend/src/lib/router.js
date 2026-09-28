// Пешие маршруты через OpenRouteService.
//
// Бесплатный тариф: 2500 запросов в сутки, 40 000 в месяц — на все сервисы
// вместе. Ключ бесплатный, но требует регистрации на openrouteservice.org.
// Без ключа приложение работает: линия маршрута рисуется прямой, а тайминги
// всё равно считает свой планировщик и от сети не зависят.
//
// Координаты везде [долгота, широта] — родной формат и ORS, и MapLibre.

// Геометрию пешего маршрута теперь отдаёт бэкенд (POST /api/route) — ключ ORS
// живёт на сервере, а не в бандле.

// Возвращает { line, legs } либо null, если маршрут построить не удалось.
//   line — [[долгота, широта], …] для слоя линии на карте;
//   legs — по участку на пару соседних точек: { duration (мин), length (м) }.
export async function fetchRouteDetails(points) {
  if (points.length < 2) return null;

  try {
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    });
    if (!response.ok) throw new Error(`API ответил ${response.status}`);

    const data = await response.json();
    const line = data?.line;
    if (!Array.isArray(line) || line.length < 2) return null;
    return { line, legs: data.legs ?? [] };
  } catch (error) {
    console.warn('[Рядом] Маршрут не построен, рисуем прямую линию —', error.message);
    return null;
  }
}

// Ссылка на пеший маршрут во внешних картах — для кнопки «Открыть маршрут».
// OpenStreetMap умеет строить маршрут по ссылке и не требует ключа.
export function externalRouteUrl(points) {
  let pts = points;
  // Круговой маршрут заканчивается в точке старта. Для внешней ссылки это значит
  // from == to, и маршрут не строится — поэтому возврат в старт отбрасываем.
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (
    pts.length > 2 &&
    first && last &&
    first[0] === last[0] && first[1] === last[1]
  ) {
    pts = pts.slice(0, -1);
  }
  const [fromLon, fromLat] = pts[0];
  const [toLon, toLat] = pts[pts.length - 1];
  return (
    'https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot' +
    `&route=${fromLat}%2C${fromLon}%3B${toLat}%2C${toLon}`
  );
}
