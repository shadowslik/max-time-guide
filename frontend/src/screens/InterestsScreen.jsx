import Icon from '../components/Icon.jsx';
import { Button, Screen, SectionLabel, Steps, TopBar } from '../components/ui.jsx';
import { INTERESTS } from '../data/places.js';
import { formatBudget, interestsLabel } from '../lib/format.js';

export default function InterestsScreen({ minutes, selected, onToggle, onAny, onSubmit, onBack }) {
  const anyMode = selected.length === 0;

  return (
    <Screen>
      <TopBar onBack={onBack} right={<Steps current={3} />} />

      <h1 className="title-xl mt-14 rise">Что тебе интересно?</h1>
      <p className="lead rise" style={{ animationDelay: '50ms' }}>Выбери сколько угодно. Чем точнее — тем меньше лишнего в результатах.</p>

      <div className="chip-row mt-22 rise" style={{ animationDelay: '100ms' }}>
        {INTERESTS.map((interest) => {
          const active = selected.includes(interest.id);
          return (
            <button
              key={interest.id}
              type="button"
              className={`chip${active ? ' chip--on' : ''}`}
              aria-pressed={active}
              onClick={() => onToggle(interest.id)}
            >
              <Icon name={interest.icon} size={19} />
              {interest.label}
            </button>
          );
        })}
      </div>

      <div className="mt-20" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="divider grow" />
        <SectionLabel style={{ textTransform: 'none' }}>или</SectionLabel>
        <span className="divider grow" />
      </div>

      <button
        type="button"
        className={`chip${anyMode ? ' chip--on' : ''} mt-16`}
        style={{ height: 62, width: '100%', gap: 12 }}
        aria-pressed={anyMode}
        onClick={onAny}
      >
        <span style={{ color: anyMode ? 'inherit' : 'var(--accent-text)', flexShrink: 0, display: 'flex' }}>
          <Icon name="sparkle" size={22} />
        </span>
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600 }}>
            Неважно, просто покажи интересное
          </span>
          <span style={{ display: 'block', fontSize: 12.5, marginTop: 2, color: 'var(--text-2)' }}>
            подберём по рейтингу и времени
          </span>
        </span>
      </button>

      <div className="spacer" />

      <Button onClick={onSubmit}>
        Показать варианты
        <span
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 22, height: 22, padding: '0 6px', boxSizing: 'border-box',
            borderRadius: 11, background: 'rgba(255,255,255,0.24)', fontSize: 13, fontWeight: 700,
          }}
        >
          {selected.length || '∞'}
        </span>
      </Button>
      <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>
        {formatBudget(minutes)} · {interestsLabel(selected, INTERESTS)}
      </p>
    </Screen>
  );
}
