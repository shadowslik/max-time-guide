// Подбор мест под свободное время: «успеешь / впритык / не успеешь»,
// плюс сборка цепочки из двух мест на то же окно времени.
//
// Дорога считается от точки, которую пользователь поставил на карте,
// поэтому все тайминги меняются вместе с меткой — фиксированных значений
// «сколько идти» в данных больше нет.

import { PLACES } from '../data/places.js';
import { formatDistance, walkMinutes } from './geo.js';

export const BUFFER = 10; // запас времени, мин

// Место с посчитанной дорогой от точки старта.
function withTravel(place, from) {
  const walk = walkMinutes(from, place.coords);
  return {
    ...place,
    walkTo: walk,
    walkBack: walk,
    distance: formatDistance(from, place.coords),
  };
}

// «Успеваешь / впритык / не успеешь» для места под доступное время.
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
export function pickPlaces(minutes, interestIds, from) {
  // Пустой список интересов означает «покажи что угодно».
  const matched = PLACES.filter(
    (p) => interestIds.length === 0 || p.interests.some((i) => interestIds.includes(i)),
  )
    .map((p) => withTravel(p, from))
    .map((p) => ({ ...p, eval: evaluatePlace(p, minutes) }));

  const rank = { fits: 0, tight: 1, no: 2 };
  matched.sort((a, b) => rank[a.eval.status] - rank[b.eval.status] || a.eval.road - b.eval.road);
  return matched;
}

// Цепочка из двух мест: перебираем пары и берём ту, где суммарно больше
// времени «на месте» при уложенном бюджете.
export function buildChain(minutes, interestIds, from) {
  const candidates = pickPlaces(minutes, interestIds, from).filter((p) => p.eval.status !== 'no');
  let best = null;

  for (const a of candidates) {
    for (const b of candidates) {
      if (a.id === b.id) continue;
      const hop = walkMinutes(a.coords, b.coords);
      const road = a.walkTo + hop + b.walkBack;
      const free = minutes - road - BUFFER;
      if (free < a.minVisit + b.minVisit) continue;

      const share = a.idealVisit / (a.idealVisit + b.idealVisit);
      let visitA = Math.min(a.idealVisit, Math.max(a.minVisit, Math.round(free * share)));
      let visitB = Math.min(b.idealVisit, Math.max(b.minVisit, free - visitA));
      if (visitA + visitB > free) visitA = free - visitB;
      if (visitA < a.minVisit) continue;

      // Округляем до пяти минут — так подписи выглядят как живой план, а не расчёт.
      visitA = Math.max(a.minVisit, Math.round(visitA / 5) * 5);
      visitB = Math.max(b.minVisit, Math.round(visitB / 5) * 5);
      const total = a.walkTo + visitA + hop + visitB + b.walkBack;
      if (total > minutes) continue;

      const score = visitA + visitB;
      if (!best || score > best.score || (score === best.score && total < best.total)) {
        best = {
          score,
          total,
          buffer: minutes - total,
          walkBack: b.walkBack,
          legs: [
            { place: a, walk: a.walkTo, visit: visitA },
            { place: b, walk: hop, visit: visitB },
          ],
        };
      }
    }
  }
  return best;
}
