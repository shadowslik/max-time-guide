// Карта экрана. Если задан ключ VITE_YANDEX_MAPS_API_KEY — рисуем настоящие
// Яндекс.Карты; иначе показываем схему из дизайна, чтобы прототип оставался
// полностью рабочим без внешних сервисов.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import SchematicMap, { SCHEMA_VIEWBOX } from './SchematicMap.jsx';
import MapPin, { CenterPin, pinHtml, userDotHtml } from './MapPin.jsx';
import { hasApiKey, loadYmaps, toLatLon } from '../lib/ymaps.js';

function useYmaps() {
  const [mod, setMod] = useState(null);
  useEffect(() => {
    let alive = true;
    loadYmaps().then((result) => {
      if (alive) setMod(result);
    });
    return () => {
      alive = false;
    };
  }, []);
  return mod;
}

// Размер контейнера нужен, чтобы совместить схему (390×844) с экраном
// по тем же правилам, что и preserveAspectRatio="xMidYMin slice".
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: SCHEMA_VIEWBOX.width, height: SCHEMA_VIEWBOX.height });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

function schemaPath(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
}

function Marker({ marker, onSelect }) {
  const pin = <MapPin tone={marker.tone} size={marker.size ?? 30} number={marker.number} glyph={marker.glyph} title={marker.title} />;
  if (!onSelect) return pin;
  return (
    <button type="button" onClick={() => onSelect(marker.id)} aria-label={marker.title} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}>
      {pin}
    </button>
  );
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function SchematicLayer({ theme, markers, user, showHalo, routeSchema, centerPin, onSelect, focus, bottomInset = 0 }) {
  const [ref, size] = useElementSize();
  const { width: vw, height: vh } = SCHEMA_VIEWBOX;
  // Схема ровно накрывает экран, поэтому панорамировать её некуда.
  // Подзумиваем, когда часть экрана занята шторкой — появляется запас,
  // и метка уезжает из-под шторки в видимую часть.
  const cover = Math.max(size.width / vw, size.height / vh);
  const scale = bottomInset > 0 || focus ? cover * 1.3 : cover;

  // Центрируем схему на интересной точке, учитывая, что низ экрана
  // закрыт шторкой: иначе метка окажется прямо под ней.
  const anchor = focus ?? user?.pin ?? { x: vw / 2, y: vh / 2 };
  const visibleHeight = size.height - Math.min(bottomInset, size.height * 0.82);
  const offsetX = clamp(size.width / 2 - anchor.x * scale, Math.min(0, size.width - vw * scale), 0);
  const offsetY = clamp(visibleHeight / 2 - anchor.y * scale, Math.min(0, size.height - vh * scale), 0);

  return (
    <div className="map__canvas" ref={ref}>
      <div
        style={{
          position: 'absolute',
          width: vw,
          height: vh,
          transformOrigin: '0 0',
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        }}
      >
        <SchematicMap theme={theme} />

        {routeSchema?.length > 1 && (
          <svg width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} fill="none" style={{ position: 'absolute', inset: 0 }}>
            <path d={schemaPath(routeSchema)} stroke="var(--surface)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d={schemaPath(routeSchema)} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 7" />
          </svg>
        )}

        {user && showHalo && <span className="user-halo" style={{ left: user.pin.x, top: user.pin.y }} />}
        {user && <span className="user-dot" style={{ left: user.pin.x, top: user.pin.y }} />}
        {user?.label && (
          <span className="pin-label pin-label--accent" style={{ left: user.pin.x, top: user.pin.y - 20 }}>
            {user.label}
          </span>
        )}

        {markers.map((marker, index) => (
          <span key={marker.id}>
            <span
              className={`pin pin-drop${marker.tone === 'muted' ? ' pin--muted' : ''}`}
              style={{ left: marker.pin.x, top: marker.pin.y, animationDelay: `${index * 55}ms` }}
            >
              <Marker marker={marker} onSelect={onSelect} />
            </span>
            {marker.label && (
              <span
                className={`pin-label${marker.labelTone === 'dark' ? ' pin-label--dark' : ''}`}
                style={{ left: marker.pin.x, top: marker.pin.y - (marker.size ?? 30) * 1.3 - 8 }}
              >
                {marker.label}
              </span>
            )}
          </span>
        ))}

        {centerPin && (
          <>
            <span className="center-pin__shadow" />
            <span className="center-pin">
              <CenterPin />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#5B47F5';
}

const MAX_ZOOM = 16;

function YandexLayer({ ymaps, center, zoom, markers, user, showHalo, route, fit, bottomInset, onSelect }) {
  const nodeRef = useRef(null);
  // Карта живёт в state, а не в ref: её создание должно вызывать перерисовку,
  // иначе эффект с метками не узнает, что карту пересоздали, и та останется пустой.
  const [map, setMap] = useState(null);

  useEffect(() => {
    const instance = new ymaps.Map(
      nodeRef.current,
      { center: toLatLon(center), zoom, controls: [] },
      { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true },
    );
    setMap(instance);
    return () => {
      instance.destroy();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymaps]);

  // Массивы приходят новые на каждый рендер, поэтому сравниваем их по подписи:
  // иначе метки пересоздавались бы постоянно и анимация появления мигала бы.
  const markersKey = markers.map((m) => `${m.id}:${m.tone}:${m.size}:${m.number ?? ''}:${m.label ?? ''}`).join('|');
  const routeKey = route?.length ? `${route.length}:${route[0]}` : '';
  const fitKey = (fit ?? []).filter(Boolean).map((c) => c.join()).join('|');

  const latest = useRef({ markers, route, user, fit, center });
  latest.current = { markers, route, user, fit, center };

  useEffect(() => {
    if (!map) return;
    const state = latest.current;
    map.geoObjects.removeAll();

    if (state.route?.length > 1) {
      map.geoObjects.add(new ymaps.Polyline(state.route, {}, { strokeColor: '#FFFFFF', strokeWidth: 7, strokeOpacity: 0.9 }));
      map.geoObjects.add(
        new ymaps.Polyline(state.route, {}, { strokeColor: cssVar('--accent'), strokeWidth: 3, strokeStyle: 'dot' }),
      );
    }

    if (state.user) {
      map.geoObjects.add(
        new ymaps.Placemark(toLatLon(state.user.coords), {}, {
          iconLayout: ymaps.templateLayoutFactory.createClass(userDotHtml({ halo: showHalo, label: state.user.label })),
          iconShape: { type: 'Circle', coordinates: [0, 0], radius: 12 },
          zIndex: 700,
        }),
      );
    }

    state.markers.forEach((marker, index) => {
      const size = marker.size ?? 30;
      const placemark = new ymaps.Placemark(toLatLon(marker.coords), { hintContent: marker.title }, {
        iconLayout: ymaps.templateLayoutFactory.createClass(pinHtml({ ...marker, delay: index * 55 })),
        iconShape: { type: 'Rectangle', coordinates: [[-size / 2, -size * 1.3], [size / 2, 0]] },
        zIndex: marker.tone === 'muted' ? 500 : 600,
      });
      if (onSelect) placemark.events.add('click', () => onSelect(marker.id));
      map.geoObjects.add(placemark);
    });

    // Кадрирование. Вписываем только значимые точки: если тянуть рамку
    // до мест, куда всё равно не успеть, карта отъезжает и центр не читается.
    const meaningful =
      state.fit ?? [state.user?.coords, ...state.markers.filter((m) => m.tone !== 'muted').map((m) => m.coords)];
    const points = meaningful.filter(Boolean).map(toLatLon);

    try {
      if (points.length > 1) {
        map
          .setBounds(ymaps.util.bounds.fromPoints(points), {
            checkZoomRange: true,
            zoomMargin: [80, 48, bottomInset + 32, 48],
          })
          .then(() => {
            // Не приближаемся вплотную: две соседние точки иначе дают зум 19.
            if (map.getZoom() > MAX_ZOOM) map.setZoom(MAX_ZOOM);
          }, () => {});
      } else {
        map.setCenter(toLatLon(state.center), zoom);
        if (bottomInset) {
          const pixelCenter = map.getGlobalPixelCenter();
          map.setGlobalPixelCenter([pixelCenter[0], pixelCenter[1] + bottomInset / 2]);
        }
      }
    } catch {
      /* карта ещё не готова принять кадрирование — оставляем как есть */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ymaps, markersKey, routeKey, fitKey, showHalo, zoom, bottomInset, onSelect]);

  return <div className="map__canvas" ref={nodeRef} />;
}

export default function MapCanvas({
  theme = 'light',
  center,
  zoom = 15,
  markers = [],
  user,
  showHalo = false,
  route,
  routeSchema,
  centerPin = false,
  fade = false,
  focus,
  fit,
  bottomInset = 0,
  onSelect,
  children,
}) {
  const mod = useYmaps();
  const ready = hasApiKey && mod;

  return (
    <div className="map" style={{ '--sheet-h': `${bottomInset}px` }}>
      {ready ? (
        <>
          <YandexLayer
            ymaps={mod}
            center={center ?? user?.coords ?? markers[0]?.coords}
            zoom={zoom}
            markers={markers}
            user={user}
            showHalo={showHalo}
            route={route}
            fit={fit}
            bottomInset={bottomInset}
            onSelect={onSelect}
          />
          {centerPin && (
            <>
              <span className="center-pin__shadow" />
              <span className="center-pin">
                <CenterPin />
              </span>
            </>
          )}
        </>
      ) : (
        <SchematicLayer
          theme={theme}
          markers={markers}
          user={user}
          showHalo={showHalo}
          routeSchema={routeSchema}
          centerPin={centerPin}
          focus={focus}
          bottomInset={bottomInset}
          onSelect={onSelect}
        />
      )}

      {fade && <div className="map__fade" />}
      <div className="map-overlay">{children}</div>
    </div>
  );
}

// Ступенчатая линия между двумя метками схемы — похожа на ход по улицам,
// в отличие от прямой «по воздуху».
export function schemaRoute(from, to) {
  const midY = Math.round((from.y + to.y) / 2);
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
}
