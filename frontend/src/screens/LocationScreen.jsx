import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import MapCanvas from '../components/MapCanvas.jsx';
import { Button, Sheet, Steps } from '../components/ui.jsx';
import { CITY } from '../data/places.js';
import { hasGeocoder, reverseGeocode } from '../lib/geocoder.js';

// Без кнопки «Ввести адрес» шторке не нужна её высота.
const SHEET = hasGeocoder ? 392 : 328;

export default function LocationScreen({ theme, start, label, onConfirm, onAddress, onHistory }) {
  const [coords, setCoords] = useState(start ?? CITY.start);
  // Подпись места под центром карты — определяем по координатам (обратный геокод).
  const [here, setHere] = useState(null);

  // Адрес выбирают на отдельном экране — возвращаясь, переносим карту туда.
  useEffect(() => {
    if (start) setCoords(start);
  }, [start]);

  // Пока метка стоит ровно на выбранном адресе — показываем его улицу, а не
  // город. Стоит подвинуть карту — точка уже не та, берём подпись по координатам.
  const onPicked =
    label && start &&
    Math.abs(coords[0] - start[0]) < 1e-4 &&
    Math.abs(coords[1] - start[1]) < 1e-4;

  // Двигают карту — спрашиваем у бэка, что за место под меткой (с задержкой,
  // чтобы не дёргать на каждый сдвиг). Выбранный адрес перекрываем его подписью.
  useEffect(() => {
    if (onPicked) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await reverseGeocode(coords, controller.signal);
      if (found) setHere(found);
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [coords, onPicked]);

  const current = onPicked ? label : here;
  // Показываем и место, и город: «улица · город» либо «город · регион».
  const place = current
    ? [current.title, current.subtitle].filter(Boolean).join(' · ')
    : CITY.name;
  // Выбранный адрес показываем крупно (метка на доме), свободный поиск — обзорно.
  const zoom = label ? 17 : 15;

  return (
    <div className="screen screen--map">
      <MapCanvas
        theme={theme}
        center={coords}
        zoom={zoom}
        bottomInset={SHEET}
        centerPin
        recenterKey={start?.join()}
        onCenterChange={setCoords}
      >
        <div className="chip-float drop" style={{ position: 'absolute', left: 16, top: 16 }}>
          <Steps current={1} />
        </div>

        <button
          type="button"
          className="icon-button icon-button--float drop"
          style={{ position: 'absolute', right: 16, top: 10 }}
          onClick={onHistory}
          aria-label="Мои маршруты"
        >
          <Icon name="history" size={21} />
        </button>

        <Sheet height={SHEET}>
          <div className="row">
            <div
              style={{
                width: 48, height: 48, flexShrink: 0, borderRadius: 15,
                background: 'var(--accent-soft)', color: 'var(--accent-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="pin" size={24} />
            </div>
            <div className="grow">
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, lineHeight: 1.24, letterSpacing: '-0.2px' }}>
                Где ты сейчас?
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--text-2)' }}>
                {place}
              </p>
            </div>
          </div>

          <p className="lead" style={{ marginTop: 16, fontSize: 15 }}>
            Двигай карту, чтобы метка встала на твоё место. От неё посчитаем, куда ты успеешь дойти и вернуться.
          </p>

          <div className="spacer" />

          <div className="coords num">
            {coords[1].toFixed(4)}, {coords[0].toFixed(4)}
          </div>

          <Button className="mt-10" onClick={() => onConfirm(coords, current)}>Я здесь</Button>
          {/* Без ключа геокодера искать нечем — кнопку не показываем,
              чтобы она не вела на пустой экран. */}
          {hasGeocoder && (
            <Button variant="secondary" onClick={onAddress}>
              <Icon name="search" size={19} />
              Ввести адрес
            </Button>
          )}
        </Sheet>
      </MapCanvas>
    </div>
  );
}
