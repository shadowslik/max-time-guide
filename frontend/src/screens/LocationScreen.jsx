import { useEffect, useState } from 'react';

import Icon from '../components/Icon.jsx';
import MapCanvas from '../components/MapCanvas.jsx';
import { Button, Sheet, Steps } from '../components/ui.jsx';
import { CITY } from '../data/places.js';

const SHEET = 392;

export default function LocationScreen({ theme, start, onConfirm, onAddress, onHistory }) {
  const [coords, setCoords] = useState(start ?? CITY.start);

  // Адрес выбирают на отдельном экране — возвращаясь, переносим карту туда.
  useEffect(() => {
    if (start) setCoords(start);
  }, [start]);

  return (
    <div className="screen screen--map">
      <MapCanvas
        theme={theme}
        center={coords}
        zoom={15}
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
                {CITY.name}
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

          <Button className="mt-10" onClick={() => onConfirm(coords)}>Я здесь</Button>
          <Button variant="secondary" onClick={onAddress}>
            <Icon name="search" size={19} />
            Ввести адрес
          </Button>
        </Sheet>
      </MapCanvas>
    </div>
  );
}
