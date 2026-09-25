import Icon from '../components/Icon.jsx';
import PlaceArt from '../components/PlaceArt.jsx';
import TimeBudgetBar from '../components/TimeBudgetBar.jsx';
import { Badge, Button, Sheet } from '../components/ui.jsx';
import { INTERESTS } from '../data/places.js';
import { formatBudget, interestsLabel } from '../lib/format.js';

export default function PlaceScreen({ place, minutes, chain, onBack, onRoute, onChain }) {
  const { eval: plan } = place;
  const buffer = Math.max(0, minutes - plan.road - plan.visit);
  const canChain = Boolean(chain) && buffer >= 25;

  const rows = [
    { color: 'var(--bar-road)', name: 'Дойти туда', value: `${place.walkTo} мин` },
    { color: 'var(--accent)', name: 'Посмотреть на месте', value: `~${plan.visit} мин` },
    { color: 'var(--bar-road)', name: 'Вернуться обратно', value: `${place.walkBack} мин` },
    { color: 'var(--bar-buffer)', name: 'Запас на всякий случай', value: `${buffer} мин`, muted: true },
  ];

  return (
    <div className="screen screen--map">
      <div className="hero">
        <PlaceArt />
      </div>

      <button type="button" className="icon-button icon-button--float" style={{ position: 'absolute', left: 16, top: 16, zIndex: 2 }} aria-label="Назад к карте" onClick={onBack}>
        <Icon name="chevronLeft" size={22} />
      </button>
      
      <Sheet fill className="sheet--flat" style={{ top: 262 }}>
        <div className="row">
          <h1 className="title-l grow">{place.name}</h1>
          <Badge tone={plan.status === 'fits' ? 'ok' : plan.status === 'tight' ? 'warn' : 'muted'}>
            {plan.status === 'fits' ? 'Успеваешь' : plan.status === 'tight' ? 'Впритык' : 'Не успеешь'}
          </Badge>
        </div>
        <div style={{ marginTop: 6, fontSize: 14, color: 'var(--text-2)' }}>
          {interestsLabel(place.interests, INTERESTS)}
        </div>

        <div className="info-grid mt-18 rise" style={{ animationDelay: '60ms' }}>
          <div className="info-card">
            <span className="info-card__icon"><Icon name="banknote" size={18} /></span>
            <span className="info-card__value">{place.price}</span>
            <span className="info-card__label">{place.priceNote}</span>
          </div>
          <div className="info-card">
            <span className="info-card__icon" style={{ color: 'var(--ok-text)' }}><Icon name="clock" size={18} /></span>
            <span className="info-card__value">Открыто</span>
            <span className="info-card__label">сегодня {place.hours}</span>
          </div>
          <div className="info-card">
            <span className="info-card__icon"><Icon name="walk" size={18} /></span>
            <span className="info-card__value">{place.distance}</span>
            <span className="info-card__label">пешком от тебя</span>
          </div>
        </div>

        <div className="section-label mt-20">Как уложишься в {formatBudget(minutes)}</div>

        <div className="mt-12">
          <TimeBudgetBar budget={minutes} walkTo={place.walkTo} visit={plan.visit} walkBack={place.walkBack} height={14} legend={false} />
        </div>

        <div className="breakdown mt-14 rise" style={{ animationDelay: '120ms' }}>
          {rows.map((row) => (
            <div className="breakdown__row" key={row.name}>
              <span className="breakdown__swatch" style={{ background: row.color }} />
              <span className="breakdown__name" style={row.muted ? { color: 'var(--text-2)' } : undefined}>{row.name}</span>
              <span className="breakdown__value num" style={row.muted ? { color: 'var(--text-2)' } : undefined}>{row.value}</span>
            </div>
          ))}
        </div>

        {canChain && (
          <button type="button" className="nudge mt-14" onClick={onChain}>
            <span className="nudge__icon"><Icon name="route" size={20} /></span>
            <span className="nudge__text">
              Остаётся {buffer} минут — успеешь заглянуть ещё в одно место
            </span>
            <span className="nudge__icon"><Icon name="chevronRight" size={18} /></span>
          </button>
        )}

        <div className="spacer" style={{ minHeight: 20 }} />

        <Button onClick={onRoute}>Построить маршрут</Button>
      </Sheet>
    </div>
  );
}
