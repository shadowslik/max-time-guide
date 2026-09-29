// Экран результатов. Три режима одной шторки: «Одно место», «Цепочка» и
// «Мой маршрут». Карта остаётся на месте, меняется содержимое шторки и метки.
// «Цепочка» и «Мой маршрут» — редактируемые маршруты (можно убирать места),
// считаются на клиенте одним и тем же способом (RoutePlan).

import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import MapCanvas from '../components/MapCanvas.jsx';
import MapPin, { toneForStatus } from '../components/MapPin.jsx';
import TimeBudgetBar from '../components/TimeBudgetBar.jsx';
import { Badge, Button, Segmented, Sheet } from '../components/ui.jsx';
import { computeRoutePlan, RoutePlanPanel } from '../components/RoutePlan.jsx';
import { CITY, INTERESTS } from '../data/places.js';
import { addMinutes, clock, formatBudget, interestsLabel, plural } from '../lib/format.js';
import { externalRouteUrl, fetchRouteDetails } from '../lib/router.js';
import { openExternal } from '../lib/maxBridge.js';

const badgeTone = (status) => (status === 'fits' ? 'ok' : status === 'tight' ? 'warn' : 'muted');
const statusLabel = (status) => (status === 'fits' ? 'Успеваешь' : status === 'tight' ? 'Впритык' : 'Не успеешь');

function SinglePanel({ minutes, selected, others, onSelect, onOpenPlace, onRoute, inRoute, onToggle }) {
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
        <div className="row">
          <div className="grow">
            <div className="row">
              <h2 className="title-s">{selected.name}</h2>
              <Badge tone={badgeTone(selected.eval.status)}>{statusLabel(selected.eval.status)}</Badge>
            </div>
            <div style={{ marginTop: 5, fontSize: 13, color: 'var(--text-2)' }}>
              {interestsLabel(selected.interests, INTERESTS)} · {selected.price} · {selected.hours}
            </div>
          </div>
          <span style={{ flexShrink: 0, color: 'var(--chevron)', display: 'flex' }}>
            <Icon name="chevronRight" size={20} />
          </span>
        </div>
      </button>

      <div className="mt-14">
        <TimeBudgetBar budget={minutes} walkTo={selected.walkTo} visit={selected.eval.visit} walkBack={selected.walkBack} />
      </div>

      <div className="row mt-16" style={{ gap: 10 }}>
        <Button className="grow" onClick={onRoute} style={{ height: 52, margin: 0 }}>Построить маршрут</Button>
        <button
          type="button"
          className="icon-button"
          style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, color: inRoute?.(selected.id) ? 'var(--accent-text)' : 'var(--text-2)' }}
          aria-label={inRoute?.(selected.id) ? 'Убрать из моего маршрута' : 'В мой маршрут'}
          onClick={() => onToggle?.(selected)}
        >
          <Icon name={inRoute?.(selected.id) ? 'check' : 'plus'} size={22} />
        </button>
      </div>

      {others.length > 0 && (
        <>
          <div className="section-label mt-20">Ещё рядом</div>
          <div className="list mt-4">
            {others.map((place, index) => (
              <div key={place.id}>
                {index > 0 && <div className="list__sep" />}
                <div className="list__row" style={{ cursor: 'default' }}>
                  <button
                    type="button"
                    className="list__icon"
                    style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                    aria-label={`Показать: ${place.name}`}
                    onClick={() => onSelect(place.id)}
                  >
                    <MapPin tone={toneForStatus(place.eval.status)} size={22} />
                  </button>
                  <button
                    type="button"
                    className="list__body"
                    style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}
                    onClick={() => onSelect(place.id)}
                  >
                    <span className="list__title" style={{ display: 'block' }}>{place.name}</span>
                    <span className="list__sub" style={{ display: 'block' }}>
                      {place.walkTo} мин пешком · ~{place.eval.visit} мин на месте
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    style={{ width: 36, height: 36, flexShrink: 0, color: inRoute?.(place.id) ? 'var(--accent-text)' : 'var(--text-2)' }}
                    aria-label={inRoute?.(place.id) ? 'Убрать из маршрута' : 'В маршрут'}
                    onClick={() => onToggle?.(place)}
                  >
                    <Icon name={inRoute?.(place.id) ? 'check' : 'plus'} size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function ResultsScreen({
  theme, start, origin, minutes, interests, results, selected, chain, chains = [], mode, startAt,
  onSelect, onOpenPlace, onMarkerOpen, onRoute, onEdit, onBack, onMode,
  myList = [], inMy, onToggleMy, onRemoveMy, onSaveRoute,
}) {
  // Варианты автоцепочки (когда времени не хватило на все интересы).
  const variants = chains.length ? chains : chain ? [chain] : [];
  const [variantIdx, setVariantIdx] = useState(0);
  const activeVariant = variants[Math.min(variantIdx, variants.length - 1)] ?? null;

  // Редактируемая копия цепочки: сидируется из выбранного варианта, дальше её
  // можно править (убирать места) независимо.
  const [chainList, setChainList] = useState([]);
  const variantKey = activeVariant ? activeVariant.legs.map((l) => l.place.id).join() : '';
  useEffect(() => {
    setChainList(activeVariant ? activeVariant.legs.map((l) => l.place) : []);
  }, [variantKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const routeMode = mode === 'chain' || mode === 'my';
  const activeList = mode === 'my' ? myList : chainList;
  const removeFromActive = mode === 'my' ? onRemoveMy : (id) => setChainList((l) => l.filter((p) => p.id !== id));

  const plan = routeMode ? computeRoutePlan(activeList, start, minutes, startAt) : null;

  const found = results.length;
  const fits = results.filter((p) => p.eval.status !== 'no').length;
  const counts = {
    ok: results.filter((p) => p.eval.status === 'fits').length,
    warn: results.filter((p) => p.eval.status === 'tight').length,
    muted: results.filter((p) => p.eval.status === 'no').length,
  };
  const others = results.filter((place) => place.id !== selected?.id);

  // Линию маршрута строим НЕ сразу, а по кнопке «Построить маршрут». При смене
  // вкладки/состава мест сбрасываем — чтобы старая геометрия не висела.
  const [routeLine, setRouteLine] = useState(null);
  const [built, setBuilt] = useState(false);
  const routeKey = routeMode ? activeList.map((p) => p.id).join() : '';
  useEffect(() => {
    setRouteLine(null);
    setBuilt(false);
  }, [routeKey, mode]);

  const buildRoute = () => {
    if (activeList.length < 1) return;
    setBuilt(true);
    setRouteLine(plan.points); // сразу прямая, реальную геометрию подменит роутер
    fetchRouteDetails(plan.points).then((d) => d && setRouteLine(d.line));
    onSaveRoute?.(activeList); // сохраняем в «Мои маршруты» (профиль)
  };

  const markers = routeMode
    ? plan.markers
    : results
        // На карте показываем только места с рейтингом от 4★ (без рейтинга —
        // оставляем; выбранное место видно всегда).
        .filter((place) => place.id === selected?.id || place.rating == null || place.rating >= 4)
        .map((place) => {
          const active = place.id === selected?.id;
          return {
            id: place.id,
            coords: place.coords,
            title: place.name,
            tone: toneForStatus(place.eval.status),
            size: active ? 40 : place.eval.status === 'no' ? 24 : 30,
            label: active ? `${place.short} · ${place.walkTo} мин` : undefined,
            labelTone: 'dark',
          };
        });

  const chainCount = chainList.length || (activeVariant ? activeVariant.legs.length : 0);

  return (
    <div className="screen screen--map">
      <MapCanvas
        theme={theme}
        center={routeMode ? (activeList[0]?.coords ?? start) : selected?.coords ?? start}
        zoom={routeMode ? 14 : CITY.zoom}
        user={{ coords: start }}
        markers={markers}
        route={routeMode ? routeLine : undefined}
        fit={routeMode ? (plan.points) : [start, selected?.coords]}
        bottomInset={300}
        onSelect={onMarkerOpen ?? onSelect}
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
              {origin || CITY.name} · до {clock(addMinutes(startAt, minutes))}
            </div>
          </div>
          <button type="button" className="params__edit" aria-label="Изменить время и интересы" onClick={onEdit}>
            <Icon name="tune" size={20} />
          </button>
        </div>

        {!routeMode && (
          <>
            <div className="banner drop" style={{ position: 'absolute', left: 16, top: 80, animationDelay: '70ms' }}>
              <span className="dot" style={{ background: 'var(--ok)' }} />
              <span>
                {fits} из {plural(found, 'места', 'мест', 'мест')} успеваешь за {formatBudget(minutes)}
              </span>
            </div>

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
          </>
        )}

        <Sheet snap={[188, 360, 620]} initial={360}>
          <Segmented
            value={mode}
            onChange={onMode}
            items={[
              { id: 'single', label: 'Одно место' },
              { id: 'chain', label: chainCount ? `Цепочка · ${chainCount}` : 'Цепочка' },
              { id: 'my', label: myList.length ? `Мой маршрут · ${myList.length}` : 'Мой маршрут' },
            ]}
          />

          {/* Варианты автоцепочки: выбор, когда времени мало на все интересы. */}
          {mode === 'chain' && variants.length > 1 && (
            <>
              <div className="section-label mt-16" style={{ marginBottom: 8 }}>
                На всё сразу времени мало — выбери вариант
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}>
                {variants.map((v, i) => {
                  const active = i === Math.min(variantIdx, variants.length - 1);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setVariantIdx(i)}
                      style={{
                        flexShrink: 0, padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
                        border: `1.5px solid ${active ? 'var(--accent)' : 'var(--sep)'}`,
                        background: active ? 'var(--accent-soft)' : 'var(--surface)',
                        color: active ? 'var(--accent-soft-text)' : 'var(--text)',
                        fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap',
                      }}
                    >
                      {interestsLabel(v.interests, INTERESTS) || `Вариант ${i + 1}`}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="panel-swap" key={mode === 'chain' ? `chain-${variantIdx}` : mode}>
            {mode === 'single' ? (
              <SinglePanel
                minutes={minutes}
                selected={selected}
                others={others}
                onSelect={onSelect}
                onOpenPlace={onOpenPlace}
                onRoute={onRoute}
                inRoute={inMy}
                onToggle={onToggleMy}
              />
            ) : (
              <RoutePlanPanel
                plan={plan}
                places={activeList}
                minutes={minutes}
                built={built}
                onBuild={buildRoute}
                onRemove={removeFromActive}
                onOpenPlace={onMarkerOpen ?? onSelect}
                onOpen={() => openExternal(externalRouteUrl(plan.points))}
                emptyHint={
                  mode === 'my'
                    ? `Добавляй места кнопкой «+» на вкладке «Одно место» — посчитаю, успеешь ли обойти их за ${formatBudget(minutes)}.`
                    : 'Под эти интересы цепочку собрать не вышло. Попробуй изменить подбор или собери свой маршрут.'
                }
              />
            )}
          </div>
        </Sheet>
      </MapCanvas>
    </div>
  );
}
