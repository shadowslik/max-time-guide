// Вертикальный таймлайн маршрута: старт → пешком → место → … → возвращение.

import Icon from './Icon.jsx';
import MapPin from './MapPin.jsx';

function Mark({ item }) {
  if (item.type === 'start') return <span className="timeline__mark" />;
  if (item.type === 'finish') {
    return (
      <span className="timeline__mark timeline__mark--finish">
        <Icon name="check" size={10} />
      </span>
    );
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
            <div className="grow">
              <div className="timeline__title">{item.title}</div>
              <div className={`timeline__sub${item.tone === 'ok' ? ' timeline__sub--ok' : ''}`}>{item.sub}</div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
