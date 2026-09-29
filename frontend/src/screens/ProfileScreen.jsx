// Профиль: аватар и имя из MAX, статистика и просмотренные ранее маршруты (из БД).

import Icon from '../components/Icon.jsx';
import { Screen, SectionLabel, TopBar } from '../components/ui.jsx';
import { INTERESTS } from '../data/places.js';
import { formatDuration, interestsLabel, plural } from '../lib/format.js';

function Avatar({ src, name, size = 72 }) {
  const letter = (name || 'Г').trim().charAt(0).toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name || 'Профиль'}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <span
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--accent-soft)', color: 'var(--accent-text)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.42, fontWeight: 700,
      }}
    >
      {letter}
    </span>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="info-card" style={{ flex: 1 }}>
      <span className="info-card__value">{value}</span>
      <span className="info-card__label">{label}</span>
    </div>
  );
}

export default function ProfileScreen({ profile, user, onBack, onOpen }) {
  const name = profile?.displayName || user?.name || 'Гость';
  const avatar = profile?.avatar || user?.avatar || null;
  const stats = profile?.stats || { routes: 0, minutes: 0, places: 0, topInterest: null };
  const trips = profile?.trips || [];
  const topLabel = stats.topInterest ? interestsLabel([stats.topInterest], INTERESTS) : '—';

  return (
    <Screen variant="scroll">
      <TopBar onBack={onBack} />

      <div className="row mt-10" style={{ gap: 16, alignItems: 'center' }}>
        <Avatar src={avatar} name={name} />
        <div className="grow">
          <h1 className="title-l" style={{ margin: 0 }}>{name}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-2)' }}>
            {stats.routes > 0
              ? `${plural(stats.routes, 'маршрут', 'маршрута', 'маршрутов')} · ${formatDuration(stats.minutes)}`
              : 'Пока без маршрутов'}
          </p>
        </div>
      </div>

      <SectionLabel className="mt-24">Статистика</SectionLabel>
      <div className="info-grid mt-12">
        <StatCard value={stats.routes} label="маршрутов" />
        <StatCard value={stats.places} label="мест" />
        <StatCard value={topLabel} label="любимое" />
      </div>

      <SectionLabel className="mt-24">Ты смотрел</SectionLabel>
      {trips.length === 0 ? (
        <p className="lead" style={{ marginTop: 10 }}>
          Здесь появятся маршруты, которые ты открывал. Построй первый — и он сохранится.
        </p>
      ) : (
        <div className="list mt-6">
          {trips.map((trip, index) => (
            <div key={trip.id}>
              {index > 0 && <div className="list__sep" />}
              <button
                type="button"
                className="list__row"
                disabled={!trip.placeId}
                style={!trip.placeId ? { cursor: 'default' } : undefined}
                onClick={() => trip.placeId && onOpen?.(trip)}
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
      )}

      <div className="spacer" style={{ minHeight: 16 }} />
    </Screen>
  );
}
