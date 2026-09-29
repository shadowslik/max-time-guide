// Редактируемый маршрут из списка мест: считает время по порядку (клиентом,
// тем же способом, что бэкенд) и рисует таймлайн с возможностью убрать место.
// Используется и вкладкой «Цепочка», и вкладкой «Мой маршрут».

import Icon from './Icon.jsx';
import Timeline from './Timeline.jsx';
import { Badge, Button } from './ui.jsx';
import { addMinutes, clock } from '../lib/format.js';
import { walkMinutes } from '../lib/geo.js';

const visitOf = (place) => place.eval?.visit ?? place.idealVisit ?? 30;

// Считаем маршрут старт → места → старт. Возвращаем всё, что нужно панели и карте.
export function computeRoutePlan(places, start, minutes, startAt) {
  let cursor = startAt;
  let spent = 0;
  let prev = start;
  const timeline = [{ type: 'start', title: 'Выходишь отсюда', sub: clock(startAt) }];

  places.forEach((place, index) => {
    const walk = walkMinutes(prev, place.coords);
    const visit = visitOf(place);
    spent += walk + visit;
    const arrive = addMinutes(cursor, walk);
    const leave = addMinutes(arrive, visit);
    cursor = leave;
    prev = place.coords;
    timeline.push({ type: 'leg', text: `${walk} мин пешком` });
    timeline.push({
      type: 'stop',
      number: index + 1,
      title: place.name,
      sub: `${clock(arrive)} – ${clock(leave)} · ~${visit} мин на месте`,
      placeId: place.id,
    });
  });

  const walkBack = places.length ? walkMinutes(prev, start) : 0;
  const total = spent + walkBack;
  const over = total - minutes;
  const fits = over <= 0;

  if (places.length) {
    timeline.push({ type: 'leg', text: `${walkBack} мин пешком обратно` });
    timeline.push({
      type: 'finish',
      title: `На месте в ${clock(addMinutes(startAt, total))}`,
      sub: fits ? `успеваешь, запас ${minutes - total} мин` : `не успеваешь на ${over} мин`,
      tone: fits ? 'ok' : 'warn',
    });
  }

  const points = places.length ? [start, ...places.map((p) => p.coords), start] : [start];
  const markers = places.map((p, i) => ({
    id: p.id, coords: p.coords, tone: fits ? 'ok' : 'warn', size: 36, number: i + 1, title: p.name,
  }));

  return { timeline, points, markers, total, over, fits };
}

// Панель одной вкладки-маршрута: заголовок, таймлайн (с удалением) во всю высоту
// и «липкие» кнопки снизу. «Построить маршрут» — строит и сохраняет по нажатию.
export function RoutePlanPanel({ plan, places, minutes, built, onRemove, onBuild, onOpen, emptyHint }) {
  if (!places.length) {
    return <p className="lead" style={{ marginTop: 14 }}>{emptyHint}</p>;
  }

  // Пробрасываем в таймлайн кнопку удаления для каждой остановки.
  const items = plan.timeline.map((it) =>
    it.type === 'stop' && it.placeId ? { ...it, onRemove: () => onRemove(it.placeId) } : it,
  );

  return (
    <>
      <div className="row mt-4">
        <h2 className="title-m grow">
          {plan.fits ? `Успеешь всё за ${minutes} мин` : 'Не помещается в бюджет'}
        </h2>
        <Badge tone={plan.fits ? 'ok' : 'warn'}>
          {plan.fits ? `запас ${minutes - plan.total} мин` : `не хватает ${plan.over} мин`}
        </Badge>
      </div>

      {/* Таймлайн занимает всю высоту и прокручивается вместе со шторкой. */}
      <div className="mt-16">
        <Timeline items={items} />
      </div>

      {/* Кнопки закреплены снизу: список над ними прокручивается. */}
      <div
        style={{
          position: 'sticky', bottom: 0, marginTop: 12, paddingTop: 10,
          background: 'var(--surface)',
        }}
      >
        <Button onClick={onBuild}>
          <Icon name="route" size={19} />
          {built ? 'Маршрут сохранён' : 'Построить маршрут'}
        </Button>
        <Button variant="secondary" onClick={onOpen}>
          <Icon name="external" size={19} />
          Открыть в картах
        </Button>
      </div>
    </>
  );
}
