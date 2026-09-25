import Icon from '../components/Icon.jsx';
import { Button, Scrim, Sheet } from '../components/ui.jsx';
import { INTERESTS, TIME_OPTIONS } from '../data/places.js';
import { formatBudget, plural } from '../lib/format.js';

export default function EditSheet({
  minutes, interests, results, onPickTime, onCustom, onToggleInterest, onApply, onReset, onClose,
}) {
  const fits = results.filter((p) => p.eval.status !== 'no').length;

  return (
    <>
      <Scrim onClick={onClose} />

      <Sheet height={580} onDismiss={onClose}>
        <div className="row">
          <h2 className="title-m grow" style={{ fontSize: 21 }}>Изменить подбор</h2>
          <button
            type="button"
            className="params__edit"
            style={{ borderRadius: '50%', width: 32, height: 32, background: 'var(--surface-muted)', color: 'var(--text-2)' }}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="section-label mt-22">Свободное время</div>
        <div className="chip-row mt-12" style={{ gap: 9 }}>
          {TIME_OPTIONS.map((option) => {
            const active = option.minutes === minutes;
            return (
              <button
                key={option.minutes}
                type="button"
                className={`chip${active ? ' chip--on' : ''}`}
                style={{ height: 44, borderRadius: 14 }}
                aria-pressed={active}
                onClick={() => onPickTime(option.minutes)}
              >
                {active && <Icon name="check" size={14} />}
                {option.label}
              </button>
            );
          })}
          <button type="button" className="chip chip--dashed" style={{ height: 44, borderRadius: 14 }} onClick={onCustom}>
            Другое
          </button>
        </div>

        <div className="section-label mt-24">Интересы</div>
        <div className="chip-row mt-12" style={{ gap: 9 }}>
          {INTERESTS.map((interest) => {
            const active = interests.includes(interest.id);
            return (
              <button
                key={interest.id}
                type="button"
                className={`chip${active ? ' chip--on' : ''}`}
                style={{ height: 42, borderRadius: 14, padding: '0 14px', fontSize: 14.5 }}
                aria-pressed={active}
                onClick={() => onToggleInterest(interest.id)}
              >
                {interest.label}
              </button>
            );
          })}
        </div>

        <div className="spacer" />

        <Button onClick={onApply}>
          {fits ? `Показать ${plural(fits, 'место', 'места', 'мест')}` : `Ничего не успеть за ${formatBudget(minutes)}`}
        </Button>
        <Button variant="ghost" className="btn--quiet" onClick={onReset}>Сбросить всё</Button>
      </Sheet>
    </>
  );
}
