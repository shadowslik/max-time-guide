// Экран результатов. «Одно место» и «Цепочка» — это не разные экраны,
// а два режима одного: карта остаётся на месте, меняется только содержимое
// шторки и набор меток. Поэтому переключение вкладки не толкает экран,
// а плавно подменяет панель.

import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import MapCanvas, { schemaRoute } from '../components/MapCanvas.jsx';
import MapPin, { toneForStatus } from '../components/MapPin.jsx';
import TimeBudgetBar from '../components/TimeBudgetBar.jsx';
import Timeline from '../components/Timeline.jsx';
import { Badge, Button, Segmented, Sheet } from '../components/ui.jsx';
import { CITY, INTERESTS } from '../data/places.js';
import { addMinutes, clock, formatBudget, interestsLabel, plural } from '../lib/format.js';
import { externalRouteUrl, fetchRouteDetails } from '../lib/router.js';
import { openExternal } from '../lib/maxBridge.js';
import { toLatLon } from '../lib/ymaps.js';

const badgeTone = (status) => (status === 'fits' ? 'ok' : status === 'tight' ? 'warn' : 'muted');
const statusLabel = (status) => (status === 'fits' ? 'Успеваешь' : status === 'tight' ? 'Впритык' : 'Не успеешь');

function SinglePanel({ minutes, selected, others, onSelect, onOpenPlace, onRoute }) {
  if (!selected) {
    return <p className="lead">Под это время ничего не нашлось. Попробуй изменить подбор.</p>;
  }

  return (
    <>
      <button
        type="button"
        className="mt-16"
        aria-label={`Подробнее: ${selected.name}`}
        style={{ border: 0, background: 'none', padding: 0, width: '100%', textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
        onClick={onOpenPlace}
      >
        <div className="row row--top">
          <div className="grow">
            <div className="row">
              <h2 className="title-s">{selected.name}</h2>
              <Badge tone={badgeTone(selected.eval.status)}>{statusLabel(selected.eval.status)}</Badge>
            </div>
            <div style={{ marginTop: 5, fontSize: 13, color: 'var(--text-2)' }}>
              {interestsLabel(selected.interests, INTERESTS)} · {selected.price} · {selected.hours}
            </div>
          </div>
          <span style={{ flexShrink: 0, color: 'var(--chevron)', marginTop: 3, display: 'flex' }}>
            <Icon name="chevronRight" size={20} />
          </span>
        </div>
      </button>

      <div className="mt-14">
        <TimeBudgetBar budget={minutes} walkTo={selected.walkTo} visit={selected.eval.visit} walkBack={selected.walkBack} />
      </div>

      <Button className="mt-16" onClick={onRoute} style={{ height: 52 }}>Построить маршрут</Button>

      {others.length > 0 && (
        <>
          <div className="section-label mt-20">Ещё рядом</div>
          <div className="list mt-4">
            {others.map((place, index) => (
              <div key={place.id}>
                {index > 0 && <div className="list__sep" />}
                <button type="button" className="list__row" onClick={() => onSelect(place.id)} aria-label={`Показать: ${place.name}`}>
                  <span className="list__icon" style={{ background: 'transparent' }}>
                    <MapPin tone={toneForStatus(place.eval.status)} size={22} />
                  </span>
                  <span className="list__body">
                    <span className="list__title" style={{ display: 'block' }}>{place.name}</span>
                    <span className="list__sub" style={{ display: 'block' }}>
                      {place.walkTo} мин пешком · ~{place.eval.visit} мин на месте
                    </span>
                  </span>
                  <Badge tone={badgeTone(place.eval.status)}>
                    {place.eval.status === 'fits' ? 'успеешь' : place.eval.status === 'tight' ? 'впритык' : 'нет'}
                  </Badge>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ChainPanel({ chain, minutes, startAt, onOpen }) {
  const items = [{ type: 'start', title: 'Выходишь отсюда', sub: clock(startAt) }];
  let cursor = startAt;

  chain.legs.forEach((leg, index) => {
    cursor = addMinutes(cursor, leg.walk);
    const arrive = cursor;
    cursor = addMinutes(cursor, leg.visit);
    items.push({ type: 'leg', text: `${leg.walk} мин пешком` });
    items.push({
      type: 'stop',
      number: index + 1,
      title: leg.place.name,
      sub: `${clock(arrive)} – ${clock(cursor)} · ~${leg.visit} мин · ${interestsLabel(leg.place.interests.slice(0, 1), INTERESTS)}`,
    });
  });

  const home = addMinutes(cursor, chain.walkBack);
  items.push({ type: 'leg', text: `${chain.walkBack} мин пешком обратно` });
  items.push({
    type: 'finish',
    title: `Ты снова здесь в ${clock(home)}`,
    sub: `до конца твоего времени ещё ${chain.buffer} минут`,
    tone: 'ok',
  });

  return (
    <>
      <div className="row mt-16">
        <h2 className="title-m grow">Успеешь оба за {formatBudget(minutes)}</h2>
        <Badge tone="ok">запас {chain.buffer} мин</Badge>
      </div>

      <div className="mt-14">
        <Timeline items={items} />
      </div>

      <Button className="mt-16" onClick={onOpen} style={{ height: 52 }}>
        <Icon name="external" size={19} />
        Открыть маршрут
      </Button>
    </>
  );
}

export default function ResultsScreen({
  theme, minutes, interests, results, selected, chain, mode, startAt,
  onSelect, onOpenPlace, onRoute, onEdit, onBack, onMode,
}) {
  const chainMode = mode === 'chain' && Boolean(chain);

  const found = results.length;
  const fits = results.filter((p) => p.eval.status !== 'no').length;
  const counts = {
    ok: results.filter((p) => p.eval.status === 'fits').length,
    warn: results.filter((p) => p.eval.status === 'tight').length,
    muted: results.filter((p) => p.eval.status === 'no').length,
  };
  const others = results.filter((place) => place.id !== selected?.id);

  // Точки обхода для режима цепочки: старт → места → обратно.
  const chainPoints = chainMode
    ? [CITY.user.coords, ...chain.legs.map((leg) => leg.place.coords), CITY.user.coords]
    : null;
  const [chainRoute, setChainRoute] = useState(null);

  useEffect(() => {
    if (!chainPoints) {
      setChainRoute(null);
      return undefined;
    }
    setChainRoute(chainPoints.map(toLatLon));
    let alive = true;
    fetchRouteDetails(chainPoints).then((details) => {
      if (alive && details) setChainRoute(details.line);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainMode, chain?.legs.map((l) => l.place.id).join()]);

  const markers = chainMode
    ? chain.legs.map((leg, index) => ({
        id: leg.place.id,
        coords: leg.place.coords,
        pin: leg.place.pin,
        tone: 'ok',
        size: 38,
        number: index + 1,
        title: leg.place.name,
        label: leg.place.short,
      }))
    : results.map((place) => {
        const active = place.id === selected?.id;
        return {
          id: place.id,
          coords: place.coords,
          pin: place.pin,
          title: place.name,
          tone: toneForStatus(place.eval.status),
          size: active ? 40 : place.eval.status === 'no' ? 24 : 30,
          glyph: active ? 'museum' : undefined,
          label: active ? `${place.short} · ${place.walkTo} мин` : undefined,
          labelTone: 'dark',
        };
      });

  return (
    <div className="screen screen--map">
      <MapCanvas
        theme={theme}
        center={chainMode ? chain.legs[0].place.coords : selected?.coords ?? CITY.user.coords}
        zoom={chainMode ? 14 : CITY.zoom}
        user={CITY.user}
        markers={markers}
        route={chainMode ? chainRoute : undefined}
        routeSchema={chainMode ? [CITY.user.pin, ...chain.legs.map((l) => l.place.pin), CITY.user.pin] : undefined}
        focus={chainMode ? undefined : selected?.pin}
        fit={chainMode ? chainPoints : [CITY.user.coords, selected?.coords]}
        bottomInset={chainMode ? 300 : 300}
        onSelect={chainMode ? undefined : onSelect}
      >
        <div className="params drop" style={{ position: 'absolute', left: 16, right: 16, top: 16 }}>
          <button type="button" className="icon-button" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} aria-label="Назад" onClick={onBack}>
            <Icon name="chevronLeft" size={21} />
          </button>
          <div className="params__body">
            <div className="params__title">
              {formatBudget(minutes)} · {interestsLabel(interests, INTERESTS)}
            </div>
            <div className="params__sub">
              {CITY.name}, {CITY.district} · до {clock(addMinutes(startAt, minutes))}
            </div>
          </div>
          <button type="button" className="params__edit" aria-label="Изменить время и интересы" onClick={onEdit}>
            <Icon name="tune" size={20} />
          </button>
        </div>

        <div className="banner drop" style={{ position: 'absolute', left: 16, top: 80, animationDelay: '70ms' }}>
          <span className="dot" style={{ background: 'var(--ok)' }} />
          <span>
            {fits} из {plural(found, 'места', 'мест', 'мест')} успеваешь за {formatBudget(minutes)}
          </span>
        </div>

        {!chainMode && (
          <div className="legend drop" style={{ position: 'absolute', left: 16, top: 124, animationDelay: '140ms' }}>
            {[
              { key: 'ok', color: 'var(--ok)', label: 'успеешь', value: counts.ok },
              { key: 'warn', color: 'var(--warn)', label: 'впритык', value: counts.warn },
              { key: 'muted', color: 'var(--muted-pin)', label: 'не успеешь', value: counts.muted },
            ]
              .filter((item) => item.value > 0)
              .map((item) => (
                <span className="legend__item" key={item.key}>
                  <span className="dot dot--sm" style={{ background: item.color }} />
                  {item.label} {item.value}
                </span>
              ))}
          </div>
        )}

        <Sheet snap={chainMode ? [300, 560] : [300, 620]}>
          <Segmented
            value={chainMode ? 'chain' : 'single'}
            onChange={onMode}
            items={[
              { id: 'single', label: 'Одно место' },
              { id: 'chain', label: chain ? `Цепочка · ${chain.legs.length} места` : 'Цепочка' },
            ]}
          />

          {/* key по режиму — панель пересоздаётся и проигрывает появление */}
          <div className="panel-swap" key={chainMode ? 'chain' : 'single'}>
            {chainMode ? (
              <ChainPanel
                chain={chain}
                minutes={minutes}
                startAt={startAt}
                onOpen={() => openExternal(externalRouteUrl(chainPoints))}
              />
            ) : (
              <SinglePanel
                minutes={minutes}
                selected={selected}
                others={others}
                onSelect={onSelect}
                onOpenPlace={onOpenPlace}
                onRoute={onRoute}
              />
            )}
          </div>
        </Sheet>
      </MapCanvas>
    </div>
  );
}
