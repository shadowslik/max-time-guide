import Icon from '../components/Icon.jsx';
import TimeBudgetBar from '../components/TimeBudgetBar.jsx';
import { Button, Screen, Steps, TopBar } from '../components/ui.jsx';
import { TIME_OPTIONS } from '../data/places.js';

export default function TimeScreen({ minutes, onPick, onNext, onCustom, onBack }) {
  return (
    <Screen>
      <TopBar onBack={onBack} right={<Steps current={2} />} />

      <h1 className="title-xl mt-14 rise">Сколько у тебя свободного времени?</h1>
      <p className="lead rise" style={{ animationDelay: '50ms' }}>Покажем только то, что ты реально успеешь дойти, посмотреть и вернуться.</p>

      <div className="tiles mt-22 rise" style={{ animationDelay: '100ms' }}>
        {TIME_OPTIONS.map((option) => {
          const active = option.minutes === minutes;
          return (
            <button
              key={option.minutes}
              type="button"
              className={`tile${active ? ' tile--on' : ''}`}
              aria-pressed={active}
              onClick={() => onPick(option.minutes)}
            >
              <span className="tile__value">{option.label}</span>
              <span className="tile__hint">{option.hint}</span>
              {active && (
                <span className="tile__check">
                  <Icon name="check" size={13} />
                </span>
              )}
            </button>
          );
        })}

        <button type="button" className="tile tile--dashed" onClick={onCustom}>
          <span className="tile__value">Другое</span>
          <span className="tile__hint">укажу точно</span>
        </button>
      </div>

      <div className="hint mt-20 rise" style={{ animationDelay: '160ms' }}>
        <div className="hint__row">
          <span className="hint__icon">
            <Icon name="route" size={20} />
          </span>
          <p className="hint__text">Не переживай — мы учтём время на дорогу туда и обратно.</p>
        </div>
        <div className="mt-14">
          <TimeBudgetBar budget={120} walkTo={12} visit={60} walkBack={13} height={10} legend="labels" />
        </div>
      </div>

      <div className="spacer" />

      <Button onClick={onNext}>Дальше</Button>
    </Screen>
  );
}
