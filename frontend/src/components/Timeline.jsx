// Вертикальный таймлайн маршрута: старт → пешком → место → … → возвращение.

import Icon from './Icon.jsx';
import MapPin from './MapPin.jsx';

function Mark({ item }) {
  if (item.type === 'start') return <span className="timeline__mark" />;
  // Финиш («На месте») — такой же пин, как остановки, чтобы всё смотрелось ровно.
  if (item.type === 'finish') {
    return <MapPin tone={item.tone === 'warn' ? 'warn' : 'ok'} size={18} />;
  }
  return <MapPin tone="ok" size={18} number={item.number} />;
}

export default function Timeline({ items }) {
  return (
    <div className="timeline">
      {items.map((item, index) =>
        item.type === 'leg' ? (
          <div className="timeline__leg" key={index}>
            {/* Рельс держит колонку, саму линию рисует .timeline::before —
                одной сплошной полосой, чтобы отрезки не разъезжались. */}
            <div className="timeline__rail" />
            <div className="timeline__legText">
              <Icon name="walk" size={16} />
              {item.text}
            </div>
          </div>
        ) : (
          <div className="timeline__stop" key={index}>
            <div className="timeline__rail" style={{ paddingTop: item.type === 'stop' ? 1 : 2 }}>
              <Mark item={item} />
            </div>
            {item.onOpen ? (
              <button
                type="button"
                className="grow"
                style={{ border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={item.onOpen}
              >
                <span className="grow">
                  <div className="timeline__title">{item.title}</div>
                  <div className={`timeline__sub${item.tone === 'ok' ? ' timeline__sub--ok' : ''}`}>{item.sub}</div>
                </span>
                <span style={{ flexShrink: 0, color: 'var(--chevron)', display: 'flex' }}>
                  <Icon name="chevronRight" size={16} />
                </span>
              </button>
            ) : (
              <div className="grow">
                <div className="timeline__title">{item.title}</div>
                <div className={`timeline__sub${item.tone === 'ok' ? ' timeline__sub--ok' : ''}`}>{item.sub}</div>
              </div>
            )}
            {item.onRemove && (
              <button
                type="button"
                className="icon-button"
                style={{ width: 32, height: 32, flexShrink: 0, alignSelf: 'center' }}
                aria-label="Убрать из маршрута"
                onClick={item.onRemove}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        ),
      )}
    </div>
  );
}
