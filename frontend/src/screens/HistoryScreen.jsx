import Icon from '../components/Icon.jsx';
import TimeBudgetBar from '../components/TimeBudgetBar.jsx';
import { Screen, SectionLabel, TopBar } from '../components/ui.jsx';
import { INTERESTS } from '../data/places.js';
import { formatDuration, interestsLabel, plural } from '../lib/format.js';

export default function HistoryScreen({ history, onBack, onRepeat, onOpen }) {
  const [featured, ...earlier] = history;
  const cities = new Set(history.map((trip) => trip.city));
  const total = history.reduce((sum, trip) => sum + trip.minutes, 0);

  return (
    <Screen variant="scroll">
      <TopBar onBack={onBack} />

      <h1 className="title-xl mt-10">Мои маршруты</h1>
      <p style={{ margin: '8px 0 0', fontSize: 15, color: 'var(--text-2)' }}>
        {plural(history.length, 'поездка', 'поездки', 'поездок')} в {plural(cities.size, 'городе', 'городах', 'городах')} ·{' '}
        {formatDuration(total)} прогулок
      </p>

      {featured && (
        <>
          <SectionLabel className="mt-24">Последняя поездка</SectionLabel>

          <div className="card mt-12 rise">
            <div className="row">
              <span className="city-chip">
                <Icon name="pin" size={13} />
                {featured.city}
              </span>
              <span className="grow" />
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{featured.date}</span>
            </div>

            <h2 className="title-m mt-12">{featured.place}</h2>
            {featured.interests && (
              <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-2)' }}>
                {interestsLabel(featured.interests, INTERESTS)}
              </div>
            )}

            <div className="mt-14">
              <TimeBudgetBar
                budget={featured.minutes}
                walkTo={featured.walkTo ?? 0}
                visit={featured.visit ?? featured.minutes}
                walkBack={featured.walkBack ?? 0}
                height={10}
                legend={false}
              />
            </div>
            <div className="mt-8" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="grow" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                {featured.walkTo != null
                  ? `${featured.walkTo} мин · ~${featured.visit} мин на месте · ${featured.walkBack} мин`
                  : 'прогулка без остановок'}
              </span>
              <span className="num" style={{ fontSize: 14, fontWeight: 700 }}>{formatDuration(featured.minutes)}</span>
            </div>

            <button
              type="button"
              className="btn btn--primary mt-14"
              style={{ height: 48, borderRadius: 15, fontSize: 16 }}
              onClick={() => onRepeat(featured)}
            >
              <Icon name="repeat" size={18} />
              Повторить маршрут
            </button>
          </div>
        </>
      )}

      {earlier.length > 0 && (
        <>
          <SectionLabel className="mt-24">Раньше</SectionLabel>
          <div className="list mt-6 rise" style={{ animationDelay: '80ms' }}>
            {earlier.map((trip, index) => (
              <div key={trip.id}>
                {index > 0 && <div className="list__sep" />}
                {/* Повторить можно только то, что есть в данных текущего города. */}
                <button
                  type="button"
                  className="list__row"
                  disabled={!trip.placeId}
                  style={!trip.placeId ? { cursor: 'default' } : undefined}
                  onClick={() => trip.placeId && onOpen(trip)}
                >
                  <span className="list__icon">
                    <Icon name="pin" size={19} />
                  </span>
                  <span className="list__body">
                    <span className="list__title" style={{ display: 'block' }}>{trip.place}</span>
                    <span className="list__sub" style={{ display: 'block' }}>
                      {trip.city} · {trip.date} · {formatDuration(trip.minutes)}
                    </span>
                  </span>
                  {trip.placeId && (
                    <span style={{ flexShrink: 0, color: 'var(--chevron)', display: 'flex' }}>
                      <Icon name="chevronRight" size={18} />
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="spacer" style={{ minHeight: 16 }} />

      <p style={{ margin: '16px 0 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--text-3)' }}>
        Маршруты сохраняются сами. В чате MAX они открываются по команде «Мои маршруты».
      </p>
    </Screen>
  );
}
