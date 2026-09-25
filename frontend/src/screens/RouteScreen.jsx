import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import MapCanvas, { schemaRoute } from '../components/MapCanvas.jsx';
import Timeline from '../components/Timeline.jsx';
import { Badge, Button, Sheet } from '../components/ui.jsx';
import { CITY } from '../data/places.js';
import { addMinutes, clock, formatBudget } from '../lib/format.js';
import { toLatLon } from '../lib/ymaps.js';
import { externalRouteUrl, fetchRouteDetails } from '../lib/router.js';
import { openExternal } from '../lib/maxBridge.js';

export default function RouteScreen({ theme, place, minutes, startAt, onBack, onEdit }) {
  const points = [CITY.user.coords, place.coords];
  // Пока Routing API не ответил (или ключа нет) показываем прямую линию —
  // направление читается сразу, а реальная геометрия подменит её позже.
  const [route, setRoute] = useState(() => points.map(toLatLon));

  useEffect(() => {
    let alive = true;
    fetchRouteDetails(points).then((details) => {
      if (alive && details) setRoute(details.line);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  const plan = place.eval;
  const arrive = addMinutes(startAt, place.walkTo);
  const leave = addMinutes(arrive, plan.visit);
  const home = addMinutes(leave, place.walkBack);
  const buffer = Math.max(0, minutes - plan.road - plan.visit);

  const items = [
    { type: 'start', title: 'Выходишь отсюда', sub: `сейчас, ${clock(startAt)}` },
    { type: 'leg', text: `${place.walkTo} мин пешком · ${place.distance}` },
    {
      type: 'stop',
      glyph: 'museum',
      title: place.name,
      sub: `${clock(arrive)} – ${clock(leave)} · ~${plan.visit} мин на месте`,
    },
    { type: 'leg', text: `${place.walkBack} мин пешком обратно` },
    {
      type: 'finish',
      title: `Ты снова здесь в ${clock(home)}`,
      sub: buffer > 0 ? `на ${buffer} минут раньше, чем нужно` : 'ровно в срок',
      tone: 'ok',
    },
  ];

  return (
    <div className="screen screen--map">
      <MapCanvas
        theme={theme}
        center={place.coords}
        zoom={15}
        user={CITY.user}
        markers={[{ id: place.id, coords: place.coords, pin: place.pin, tone: 'ok', size: 40, glyph: 'museum', title: place.name }]}
        route={route}
        routeSchema={schemaRoute(CITY.user.pin, place.pin)}
        fit={points}
        focus={{ x: (CITY.user.pin.x + place.pin.x) / 2, y: (CITY.user.pin.y + place.pin.y) / 2 }}
        bottomInset={430}
      >
        <div style={{ position: 'absolute', left: 16, top: 16, display: 'flex', gap: 10 }}>
          <button type="button" className="icon-button icon-button--float" aria-label="Назад" onClick={onBack}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <div className="banner" style={{ height: 44, padding: '0 15px', fontSize: 14.5, fontWeight: 650 }}>
            <span style={{ color: 'var(--accent-text)', display: 'flex' }}>
              <Icon name="walk" size={18} />
            </span>
            Пешком
          </div>
        </div>

        <Sheet snap={[248, 430]}>
          <div className="row">
            <h1 className="title-m grow">План на {formatBudget(minutes)}</h1>
            <Badge tone={buffer > 0 ? 'ok' : 'warn'}>запас {buffer} мин</Badge>
          </div>

          <div className="mt-18">
            <Timeline items={items} />
          </div>

          <div className="spacer" />

          <Button onClick={() => openExternal(externalRouteUrl(points))}>
            <Icon name="external" size={19} />
            Открыть маршрут
          </Button>
          <Button variant="secondary" onClick={onEdit}>Изменить время или интересы</Button>
        </Sheet>
      </MapCanvas>
    </div>
  );
}
