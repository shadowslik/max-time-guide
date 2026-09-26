// Карта на MapLibre GL. Тайлы — OpenStreetMap (ключ не нужен) либо MapTiler,
// если задан VITE_MAPTILER_KEY. Координаты везде [долгота, широта] — родной
// порядок MapLibre, разворачивать ничего не надо.

import { useEffect, useRef, useState } from 'react';
// maplibre-gl 6 отдаёт только именованные экспорты; Map переименован,
// чтобы не перекрывать глобальный Map.
import { Map as MapLibreMap, Marker, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { CenterPin, pinElement, userElement } from './MapPin.jsx';
import { hasVectorStyle, mapStyle } from '../lib/mapStyle.js';

const MAX_ZOOM = 16;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#5B47F5';
}

// Стиль загружается асинхронно, а слои можно добавлять только поверх готового.
function whenStyleReady(map, run) {
  if (map.isStyleLoaded()) {
    run();
    return undefined;
  }
  const handler = () => {
    if (!map.isStyleLoaded()) return;
    map.off('styledata', handler);
    run();
  };
  map.on('styledata', handler);
  return () => map.off('styledata', handler);
}

function drawRoute(map, line) {
  const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: line } };

  if (!map.getSource('route')) {
    map.addSource('route', { type: 'geojson', data });
    map.addLayer({
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-opacity': 0.9 },
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      // Короткий штрих с круглым концом читается как пунктир из точек.
      paint: { 'line-color': cssVar('--accent'), 'line-width': 3, 'line-dasharray': [0.1, 2.4] },
    });
  } else {
    map.getSource('route').setData(data);
    map.setPaintProperty('route-line', 'line-color', cssVar('--accent'));
  }
}

function clearRoute(map) {
  for (const id of ['route-line', 'route-casing']) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource('route')) map.removeSource('route');
}

export default function MapCanvas({
  theme = 'light',
  center,
  zoom = 15,
  markers = [],
  user,
  showHalo = false,
  route,
  fit,
  bottomInset = 0,
  centerPin = false,
  interactive = true,
  onSelect,
  onCenterChange,
  children,
}) {
  const nodeRef = useRef(null);
  const [map, setMap] = useState(null);
  const markerRefs = useRef([]);

  // Массивы приходят новые на каждый рендер — сравниваем по подписи,
  // иначе метки пересоздавались бы постоянно и анимация появления мигала.
  const markersKey = markers.map((m) => `${m.id}:${m.tone}:${m.size}:${m.number ?? ''}:${m.label ?? ''}`).join('|');
  const routeKey = route?.length ? `${route.length}:${route[0]}` : '';
  const fitKey = (fit ?? []).filter(Boolean).map((c) => c.join()).join('|');
  const latest = useRef({ markers, route, user, fit, center });
  latest.current = { markers, route, user, fit, center };

  useEffect(() => {
    const instance = new MapLibreMap({
      container: nodeRef.current,
      style: mapStyle(theme),
      center,
      zoom,
      attributionControl: { compact: true },
      dragRotate: false,
      // Без этого содержимое WebGL-холста не попадает в снимки экрана
      // (скриншоты, превью, отладка). Цена — небольшая, польза заметная.
      preserveDrawingBuffer: true,
      pitchWithRotate: false,
      interactive,
    });
    instance.touchZoomRotate.disableRotation();
    setMap(instance);

    // MapLibre запоминает размер контейнера в момент создания. Если стили
    // ещё не применились, холст остаётся обрезанным — следим за размером
    // и пересчитываем. Тот же обработчик ловит поворот экрана.
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(nodeRef.current);

    return () => {
      observer.disconnect();
      instance.remove();
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Тёмную схему умеет только векторный стиль. На растровом OSM тайлы
  // инвертируются CSS-фильтром — метки и подписи при этом не трогаются.
  useEffect(() => {
    if (!map || !hasVectorStyle) return;
    map.setStyle(mapStyle(theme));
  }, [map, theme]);

  useEffect(() => {
    if (!map || !onCenterChange) return undefined;
    const handler = () => onCenterChange(map.getCenter().toArray());
    map.on('moveend', handler);
    return () => map.off('moveend', handler);
  }, [map, onCenterChange]);

  // Метки: пересобираем целиком — их единицы, дешевле, чем сверять по одной.
  useEffect(() => {
    if (!map) return undefined;
    const state = latest.current;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];

    if (state.user) {
      markerRefs.current.push(
        new Marker({ element: userElement({ halo: showHalo, label: state.user.label }), anchor: 'center' })
          .setLngLat(state.user.coords)
          .addTo(map),
      );
    }

    state.markers.forEach((marker, index) => {
      const element = pinElement({
        ...marker,
        delay: index * 55,
        onClick: onSelect ? () => onSelect(marker.id) : undefined,
      });
      markerRefs.current.push(
        new Marker({ element, anchor: 'bottom' }).setLngLat(marker.coords).addTo(map),
      );
    });

    return () => {
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = [];
    };
  }, [map, markersKey, showHalo, onSelect]);

  // Линия маршрута. Слои живут поверх стиля, поэтому ждём его готовности
  // и перерисовываем после каждой смены темы.
  useEffect(() => {
    if (!map) return undefined;
    const line = latest.current.route;
    const off = whenStyleReady(map, () => {
      if (line?.length > 1) drawRoute(map, line);
      else clearRoute(map);
    });
    return off;
  }, [map, routeKey, theme]);

  // Кадрирование: вписываем значимые точки, приподнимая их над шторкой.
  useEffect(() => {
    if (!map) return;
    const state = latest.current;
    const padding = { top: 96, right: 48, bottom: bottomInset + 40, left: 48 };
    const points = (state.fit ?? [state.user?.coords, ...state.markers.filter((m) => m.tone !== 'muted').map((m) => m.coords)])
      .filter(Boolean);

    if (points.length > 1) {
      const bounds = points.reduce(
        (acc, coords) => acc.extend(coords),
        new LngLatBounds(points[0], points[0]),
      );
      map.fitBounds(bounds, { padding, maxZoom: MAX_ZOOM, duration: 650 });
    } else {
      map.easeTo({ center: state.center ?? points[0], zoom, padding, duration: 650 });
    }
  }, [map, markersKey, fitKey, bottomInset, zoom]);

  return (
    <div
      className={`map${hasVectorStyle ? '' : ' map--raster'}`}
      style={{ '--sheet-h': `${bottomInset}px` }}
    >
      <div className="map__canvas" ref={nodeRef} />

      {centerPin && (
        <>
          <span className="center-pin__shadow" />
          <span className="center-pin">
            <CenterPin />
          </span>
        </>
      )}

      <div className="map-overlay">{children}</div>
    </div>
  );
}
