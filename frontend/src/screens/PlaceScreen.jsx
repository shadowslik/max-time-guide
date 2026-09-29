import Icon from '../components/Icon.jsx';
import PlaceArt from '../components/PlaceArt.jsx';
import TimeBudgetBar from '../components/TimeBudgetBar.jsx';
import { Badge, Button, Sheet } from '../components/ui.jsx';
import { INTERESTS } from '../data/places.js';
import { formatBudget, interestsLabel } from '../lib/format.js';

export default function PlaceScreen({ place, minutes, chain, inMyChain, onToggleMyChain, onBack, onRoute, onChain }) {
  const { eval: plan } = place;
  const buffer = Math.max(0, minutes - plan.road - plan.visit);
  const canChain = Boolean(chain) && buffer >= 25;
  // Рейтинг показываем, только если есть отзывы (иначе 2ГИС отдаёт «5.0» без оснований).
  const hasRating = Boolean(place.rating) && (place.reviewCount ?? 0) > 0;
  const hasHours = Boolean(place.hours);

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
        <div style={{ marginTop: 6, fontSize: 14, color: 'var(--text-2)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{interestsLabel(place.interests, INTERESTS)}</span>
          {hasRating && (
            <span style={{ color: 'var(--warn-text)', fontWeight: 650 }}>
              ★ {Number(place.rating).toFixed(1)}
              <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {place.reviewCount} отзывов</span>
            </span>
          )}
          {hasHours && (
            <span style={{ color: 'var(--ok-text)', fontWeight: 650 }}>
              Открыто<span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · сегодня {place.hours}</span>
            </span>
          )}
        </div>

        {place.blurb && (
          <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.45, color: 'var(--text-2)' }}>
            {place.blurb}
          </p>
        )}

        <div className="info-grid mt-18 rise" style={{ animationDelay: '60ms' }}>
          <div className="info-card">
            <span className="info-card__icon"><Icon name="banknote" size={18} /></span>
            <span className="info-card__value">{place.price}</span>
            <span className="info-card__label">{place.priceNote}</span>
          </div>
          {hasRating ? (
            <div className="info-card">
              <span className="info-card__icon" style={{ color: 'var(--warn-text)' }}>★</span>
              <span className="info-card__value">{Number(place.rating).toFixed(1)}</span>
              <span className="info-card__label">{place.reviewCount} отзывов</span>
            </div>
          ) : (
            <div className="info-card">
              <span className="info-card__icon" style={{ color: 'var(--ok-text)' }}><Icon name="clock" size={18} /></span>
              <span className="info-card__value">{hasHours ? 'Открыто' : 'Часы'}</span>
              <span className="info-card__label">{hasHours ? `сегодня ${place.hours}` : 'уточняйте'}</span>
            </div>
          )}
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

        <Button onClick={onRoute} style={{ height: 60, fontSize: 18 }}>Построить маршрут</Button>
        <Button variant="secondary" onClick={onToggleMyChain} style={{ height: 60, fontSize: 17 }}>
          <Icon name={inMyChain ? 'check' : 'route'} size={20} />
          {inMyChain ? 'В моём маршруте' : 'В мой маршрут'}
        </Button>
        {/* Запас прокрутки снизу, чтобы кнопки не липли к краю экрана. */}
        <div style={{ height: 28, flexShrink: 0 }} />
      </Sheet>
    </div>
  );
}
