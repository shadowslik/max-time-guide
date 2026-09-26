// Геометрия на сфере. Координаты везде в порядке [долгота, широта] —
// так их принимает и MapLibre, и OpenRouteService, поэтому разворачивать
// ничего не нужно (в отличие от прежнего API Яндекс.Карт).

const WALK_SPEED_KMH = 4.8;
// По улицам идёшь длиннее, чем по прямой. Коэффициент подобран так, чтобы
// оценка «на глаз» совпадала с реальными пешими маршрутами в центре города.
const DETOUR = 1.3;

export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Минуты пешком между двумя точками. Минимум три минуты: дойти куда-то
// быстрее просто не получается, даже если это соседнее здание.
export function walkMinutes(from, to) {
  return Math.max(3, Math.round(((distanceKm(from, to) * DETOUR) / WALK_SPEED_KMH) * 60));
}

// «1,1 км» или «650 м» — как пишут в картах.
export function formatDistance(from, to) {
  const km = distanceKm(from, to) * DETOUR;
  if (km < 1) return `${Math.round((km * 1000) / 50) * 50} м`;
  return `${km.toFixed(1).replace('.', ',')} км`;
}
