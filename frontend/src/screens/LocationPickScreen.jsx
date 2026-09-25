import MapCanvas from '../components/MapCanvas.jsx';
import Icon from '../components/Icon.jsx';
import { Button, Sheet } from '../components/ui.jsx';
import { CITY } from '../data/places.js';

export default function LocationPickScreen({ theme, onConfirm, onBack }) {
  return (
    <div className="screen screen--map">
      <MapCanvas theme={theme} center={CITY.user.coords} zoom={16} centerPin bottomInset={272}>
        <div style={{ position: 'absolute', left: 16, right: 16, top: 16, display: 'flex', gap: 10 }}>
          <button type="button" className="icon-button icon-button--float" aria-label="Назад" onClick={onBack} style={{ flexShrink: 0 }}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <label className="search grow">
            <Icon name="search" size={19} />
            <input className="search__input" type="text" placeholder="Поиск адреса или места" />
          </label>
        </div>

        <div className="pin-label pin-label--dark" style={{ left: '50%', top: 'calc(50% - 58px)' }}>
          Двигай карту, чтобы уточнить
        </div>

        <button
          type="button"
          className="icon-button icon-button--float"
          style={{ position: 'absolute', right: 16, bottom: 'calc(min(272px, 82dvh) + 16px)', borderRadius: 14, color: 'var(--blue-text)' }}
          aria-label="Показать моё местоположение"
        >
          <Icon name="locate" size={22} />
        </button>

        <Sheet height={272}>
          <div className="section-label">Точка старта</div>
          <div className="mt-8" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.2px' }}>
            {CITY.address}
          </div>
          <div style={{ marginTop: 3, fontSize: 14, color: 'var(--text-2)' }}>
            {CITY.name}, {CITY.area}
          </div>

          <div className="spacer" />

          <Button onClick={onConfirm}>Подтвердить это место</Button>
          <Button variant="ghost" onClick={onBack}>Вернуться к месту из чата</Button>
        </Sheet>
      </MapCanvas>
    </div>
  );
}
