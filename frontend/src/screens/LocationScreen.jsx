import MapCanvas from '../components/MapCanvas.jsx';
import Icon from '../components/Icon.jsx';
import { Button, Sheet, Steps } from '../components/ui.jsx';
import { CITY } from '../data/places.js';

export default function LocationScreen({ theme, onConfirm, onPick, onHistory }) {
  return (
    <div className="screen screen--map">
      <MapCanvas
        theme={theme}
        center={CITY.user.coords}
        zoom={CITY.zoom}
        user={{ ...CITY.user, label: 'Ты здесь' }}
        showHalo
        fade
        bottomInset={400}
      >
        <div className="chip-float" style={{ position: 'absolute', left: 16, top: 16 }}>
          <Steps current={1} />
        </div>

        <button
          type="button"
          className="icon-button icon-button--float"
          style={{ position: 'absolute', right: 16, top: 10 }}
          onClick={onHistory}
          aria-label="Мои маршруты"
        >
          <Icon name="history" size={21} />
        </button>

        <Sheet height={400}>
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
                {CITY.name}, {CITY.district}
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--text-2)' }}>
                Определили по сообщению в чате
              </p>
            </div>
          </div>

          <div className="divider" style={{ margin: '20px 0' }} />

          <div style={{ fontSize: 17, fontWeight: 650 }}>Всё верно?</div>
          <p className="lead" style={{ marginTop: 7, fontSize: 15 }}>
            Если точка указана неверно, подбор промахнётся на 10–15 минут пешком — а это половина твоего запаса.
          </p>

          <div className="spacer" />

          <Button onClick={onConfirm}>Да, продолжить</Button>
          <Button variant="secondary" onClick={onPick} style={{ height: 54, fontSize: 17 }}>
            Нет, укажу на карте
          </Button>
        </Sheet>
      </MapCanvas>
    </div>
  );
}
