// Подбор мест под свободное время: «успеешь / впритык / не успеешь»,
// а также сборка цепочки из двух мест на одно окно времени.

import { PLACES } from '../data/places.js';

export const BUFFER = 10; // запас времени, мин
const WALK_SPEED_KMH = 4.8;

// Расчёт «успеваешь / впритык / не успеваешь» для места под доступное время.
export function evaluatePlace(place, minutes) {
  const road = place.walkTo + place.walkBack;
  const idealTotal = road + place.idealVisit + BUFFER;
  const minTotal = road + place.minVisit + BUFFER;

  if (minutes >= idealTotal) {
    return {
      status: 'fits',
      visit: place.idealVisit,
      buffer: minutes - road - place.idealVisit,
      road,
      total: road + place.idealVisit,
    };
  }
  if (minutes >= minTotal) {
    const visit = minutes - road - BUFFER;
    return { status: 'tight', visit, buffer: BUFFER, road, total: road + visit };
  }
  return {
    status: 'no',
    visit: place.minVisit,
    buffer: minutes - minTotal,
    road,
    total: road + place.minVisit,
  };
}

// Отбор и сортировка мест под интересы и время.
export function pickPlaces(minutes, interestIds) {
  // Пустой список интересов означает «покажи что угодно».
  const matched = PLACES.filter(
    (p) => interestIds.length === 0 || p.interests.some((i) => interestIds.includes(i)),
  ).map((p) => ({ ...p, eval: evaluatePlace(p, minutes) }));

  const rank = { fits: 0, tight: 1, no: 2 };
  matched.sort((a, b) => rank[a.eval.status] - rank[b.eval.status] || a.eval.road - b.eval.road);
  return matched;
}

// Пешая дистанция между двумя точками, км (формула гаверсинуса).
function distanceKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Минуты пешком между местами. Коэффициент 1.25 — поправка на то,
// что по улицам идёшь длиннее, чем по прямой.
export function hopMinutes(a, b) {
  return Math.max(3, Math.round((distanceKm(a.coords, b.coords) * 1.25) / WALK_SPEED_KMH * 60));
}

// Цепочка из двух мест: перебираем пары и берём ту, где суммарно
// больше времени «на месте» при уложенном бюджете.
export function buildChain(minutes, interestIds) {
  const candidates = pickPlaces(minutes, interestIds).filter((p) => p.eval.status !== 'no');
  let best = null;

  for (const a of candidates) {
    for (const b of candidates) {
      if (a.id === b.id) continue;
      const hop = hopMinutes(a, b);
      const road = a.walkTo + hop + b.walkBack;
      const free = minutes - road - BUFFER;
      if (free < a.minVisit + b.minVisit) continue;

      const share = a.idealVisit / (a.idealVisit + b.idealVisit);
      let visitA = Math.min(a.idealVisit, Math.max(a.minVisit, Math.round(free * share)));
      let visitB = Math.min(b.idealVisit, Math.max(b.minVisit, free - visitA));
      if (visitA + visitB > free) visitA = free - visitB;
      if (visitA < a.minVisit) continue;

      // Округляем до пяти минут — так подписи выглядят как живой план, а не как расчёт.
      visitA = Math.max(a.minVisit, Math.round(visitA / 5) * 5);
      visitB = Math.max(b.minVisit, Math.round(visitB / 5) * 5);
      const total = a.walkTo + visitA + hop + visitB + b.walkBack;
      if (total > minutes) continue;

      const score = visitA + visitB;
      if (!best || score > best.score || (score === best.score && total < best.total)) {
        best = { score, total, buffer: minutes - total, legs: [
          { place: a, walk: a.walkTo, visit: visitA },
          { place: b, walk: hop, visit: visitB },
        ], walkBack: b.walkBack };
      }
    }
  }
  return best;
}
