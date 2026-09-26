// Шторка снизу, которую можно тянуть.
//
// Высоту не анимируем — это перекомпоновка на каждый кадр. Вместо этого
// шторка всегда высотой с самую большую точку притяжения, а двигаем её
// через translateY: перенос на композитор, 60 кадров даже на слабом телефоне.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DISMISS_GAP = 64; // насколько ниже нижнего снапа нужно утянуть, чтобы закрыть
const FLING = 0.5; // px/ms — с этой скорости считаем жест броском, а не перетаскиванием

// Высота окна на первом кадре бывает нулевой (webview ещё не разложил
// страницу). Считать от неё один раз нельзя — шторка схлопнется в ноль
// и уже не починится, потому что пересчитывать будет нечему.
function useViewportHeight() {
  const [value, setValue] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight || 800,
  );

  useEffect(() => {
    const update = () => setValue(window.innerHeight || 800);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return value;
}

export default function Sheet({ height, snap, onDismiss, fill, children, className = '', style }) {
  const viewport = useViewportHeight();

  const points = useMemo(() => {
    // Нижняя граница страхует от нулевого окна, верхняя не даёт шторке
    // закрыть экран целиком.
    const limit = Math.max(320, viewport * 0.88);
    const raw = snap ?? (height ? [height] : [360]);
    return [...new Set(raw.map((v) => Math.round(Math.min(v, limit))))].sort((a, b) => a - b);
  }, [snap, height, viewport]);

  const max = points[points.length - 1];
  const stops = useMemo(() => points.map((p) => max - p).sort((a, b) => a - b), [points, max]);
  const draggable = points.length > 1 || Boolean(onDismiss);

  const [offset, setOffset] = useState(() => max - points[0]);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef(null);
  const wrapRef = useRef(null);

  // Карта должна знать, сколько её закрыто шторкой: по этой величине
  // отодвигается обязательный копирайт OSM. Пишем напрямую в CSS-переменную,
  // без состояния — значение меняется на каждом кадре перетаскивания.
  useEffect(() => {
    const host = wrapRef.current?.closest('.map');
    if (!host) return undefined;
    host.style.setProperty('--sheet-h', `${Math.max(0, max - offset)}px`);
    host.classList.toggle('map--sheet-dragging', dragging);
    return () => {
      host.style.removeProperty('--sheet-h');
      host.classList.remove('map--sheet-dragging');
    };
  }, [offset, max, dragging]);

  // Снапы могли пересчитаться (поворот экрана, другой набор точек) — подтягиваем позицию.
  useEffect(() => {
    setOffset((current) => (stops.includes(current) ? current : stops[stops.length - 1]));
  }, [stops]);

  const onPointerDown = useCallback(
    (event) => {
      if (!draggable || event.button > 0) return;
      // Не перехватываем нажатия на элементы управления и на прокручиваемое содержимое.
      if (event.target.closest('button, a, input, select, textarea, [data-no-drag]')) return;

      // Захват указателя даёт события даже когда палец ушёл за пределы шторки.
      // Он может бросить исключение (указатель уже не активен) — жест от этого
      // ломаться не должен, поэтому просто продолжаем без захвата.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* продолжаем без захвата */
      }
      gesture.current = { y: event.clientY, offset, lastY: event.clientY, lastT: event.timeStamp, v: 0 };
      setDragging(true);
    },
    [draggable, offset],
  );

  const onPointerMove = useCallback(
    (event) => {
      const g = gesture.current;
      if (!g) return;
      const dt = event.timeStamp - g.lastT;
      if (dt > 0) g.v = (event.clientY - g.lastY) / dt;
      g.lastY = event.clientY;
      g.lastT = event.timeStamp;

      const floor = onDismiss ? max : stops[stops.length - 1];
      // За пределами диапазона тянем с сопротивлением — жест остаётся живым, но не улетает.
      let next = g.offset + (event.clientY - g.y);
      if (next < 0) next /= 3;
      if (next > floor) next = floor + (next - floor) / 3;
      setOffset(next);
    },
    [max, stops, onDismiss],
  );

  const onPointerUp = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    setDragging(false);

    const flung = Math.abs(g.v) > FLING;
    if (onDismiss && ((flung && g.v > 0) || offset > stops[stops.length - 1] + DISMISS_GAP)) {
      onDismiss();
      return;
    }
    // Бросок смещает цель по направлению движения, обычное перетаскивание — нет.
    const target = offset + (flung ? g.v * 140 : 0);
    const nearest = stops.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best), stops[0]);
    setOffset(nearest);
  }, [offset, stops, onDismiss]);

  const handlers = draggable && !fill
    ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
    : null;

  if (fill) {
    return (
      <div className="sheet-wrap" ref={wrapRef} style={style}>
        <div className={`sheet sheet--fill ${className}`.trim()}>
          <span className="grabber" />
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`sheet-wrap${draggable ? ' sheet-wrap--draggable' : ''}${dragging ? ' sheet-wrap--dragging' : ''}`}
      style={{ transform: `translate3d(0, ${offset}px, 0)`, ...style }}
      {...handlers}
    >
      <div className={`sheet ${className}`.trim()} style={{ height: max }}>
        <span className="grabber" />
        {children}
      </div>
    </div>
  );
}
