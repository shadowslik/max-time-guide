// «Мой маршрут» — пользователь сам набирает места, а экран считает, успеет ли
// он обойти их подряд и вернуться. Порядок — как добавляли. Время считаем на
// клиенте (walkMinutes) — тем же способом, что и бэкенд.

import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import MapCanvas from '../components/MapCanvas.jsx';
import Timeline from '../components/Timeline.jsx';
import { Badge, Button, Sheet } from '../components/ui.jsx';
import { addMinutes, clock, formatBudget } from '../lib/format.js';
import { walkMinutes } from '../lib/geo.js';
import { externalRouteUrl, fetchRouteDetails } from '../lib/router.js';
import { openExternal } from '../lib/maxBridge.js';

// Сколько минут закладываем на само место.
const visitOf = (place) => place.eval?.visit ?? place.idealVisit ?? 30;

export default function CustomChainScreen({ theme, start, minutes, startAt, chain, onRemove, onBack }) {
  // Считаем цепочку по порядку: старт → места → обратно.
  let cursor = startAt;
  let spent = 0;
  const timeline = [{ type: 'start', title: 'Выходишь отсюда', sub: clock(startAt) }];

  let prev = start;
  chain.forEach((place, index) => {
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
      onRemove: () => onRemove(place.id),
    });
  });

  const walkBack = chain.length ? walkMinutes(prev, start) : 0;
  const total = spent + walkBack;
  const over = total - minutes;
  const fits = over <= 0;

  if (chain.length) {
    timeline.push({ type: 'leg', text: `${walkBack} мин пешком обратно` });
    timeline.push({
      type: 'finish',
      title: `Дома в ${clock(addMinutes(startAt, total))}`,
      sub: fits ? `успеваешь, запас ${minutes - total} мин` : `не успеваешь на ${over} мин`,
      tone: fits ? 'ok' : 'warn',
    });
  }

  // Точки для карты: старт → места → старт.
  const points = chain.length ? [start, ...chain.map((p) => p.coords), start] : [start];
  const [route, setRoute] = useState(points);
  useEffect(() => {
    setRoute(points);
    if (chain.length < 1) return undefined;
    let alive = true;
    fetchRouteDetails(points).then((d) => {
      if (alive && d) setRoute(d.line);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.map((p) => p.id).join()]);

  const markers = chain.map((p, i) => ({
    id: p.id,
    coords: p.coords,
    tone: fits ? 'ok' : 'warn',
    size: 36,
    number: i + 1,
    title: p.name,
  }));

  return (
    <div className="screen screen--map">
      <MapCanvas
        theme={theme}
        center={chain[0]?.coords ?? start}
        zoom={14}
        user={{ coords: start }}
        markers={markers}
        route={chain.length ? route : undefined}
        fit={points}
        bottomInset={430}
      >
        <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', gap: 10 }}>
          <button type="button" className="icon-button icon-button--float" aria-label="Назад" onClick={onBack}>
            <Icon name="chevronLeft" size={22} />
          </button>
        </div>

        <Sheet snap={[260, 430]}>
          <div className="row">
            <h1 className="title-m grow">Мой маршрут · {chain.length}</h1>
            <Badge tone={fits ? 'ok' : 'warn'}>
              {chain.length === 0
                ? 'пусто'
                : fits
                ? `запас ${minutes - total} мин`
                : `не хватает ${over} мин`}
            </Badge>
          </div>

          {chain.length === 0 ? (
            <p className="lead" style={{ marginTop: 14 }}>
              Добавляй места кнопкой «В мой маршрут» — и я посчитаю, успеешь ли обойти их за {formatBudget(minutes)}.
            </p>
          ) : (
            <>
              {/* Мест может быть много — список прокручиваем, кнопка остаётся видна. */}
              <div className="mt-18" style={{ maxHeight: 250, overflowY: 'auto', margin: '18px -4px 0', padding: '0 4px' }}>
                <Timeline items={timeline} />
              </div>
              <div className="spacer" style={{ minHeight: 12 }} />
              <Button onClick={() => openExternal(externalRouteUrl(points))}>
                <Icon name="external" size={19} />
                Открыть маршрут
              </Button>
            </>
          )}
        </Sheet>
      </MapCanvas>
    </div>
  );
}
