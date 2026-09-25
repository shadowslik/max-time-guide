import TimeBudgetBar from '../components/TimeBudgetBar.jsx';
import { Button, Screen, SectionLabel, TopBar } from '../components/ui.jsx';
import { INTERESTS } from '../data/places.js';
import { BUFFER } from '../lib/planner.js';
import { formatBudget, interestsLabel, plural } from '../lib/format.js';

export default function NoFitScreen({ minutes, interests, nearest, suggestion, onAddTime, onEditInterests, onShowAnyway, onBack }) {
  const needed = nearest ? nearest.eval.road + nearest.minVisit + BUFFER : 0;

  return (
    <Screen>
      <TopBar onBack={onBack}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginRight: 'auto' }}>
          {formatBudget(minutes)} · {interestsLabel(interests, INTERESTS)}
        </span>
      </TopBar>

      <div className="mt-14" style={{ borderRadius: 22, background: 'var(--surface-3)', padding: '18px 0' }}>
        <svg viewBox="0 0 310 170" width="100%" height="170" fill="none" style={{ display: 'block' }} role="img" aria-label="Ближайшее место лежит за пределами доступного радиуса">
          <circle cx="108" cy="86" r="62" fill="var(--track)" stroke="var(--dashed)" strokeWidth="2" strokeDasharray="7 7" />
          <circle cx="108" cy="86" r="11" fill="var(--blue)" stroke="#FFFFFF" strokeWidth="3.5" />
          <path d="M124 82 232 66" stroke="var(--chevron)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.1 9" />
          <path d="M253 34c7.2 0 13.1 5.9 13.1 13.1 0 8.9-11.2 19.7-12.5 20.9a.9.9 0 0 1-1.2 0c-1.3-1.2-12.5-12-12.5-20.9C240 39.9 245.8 34 253 34Z" fill="var(--muted-pin)" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="253" cy="47" r="4.6" fill="#FFFFFF" />
          <text x="108" y="160" textAnchor="middle" fontFamily="-apple-system, system-ui, sans-serif" fontSize="13" fontWeight="600" fill="var(--text-2)">
            всё, что успеешь за {minutes} мин
          </text>
          <text x="253" y="88" textAnchor="middle" fontFamily="-apple-system, system-ui, sans-serif" fontSize="13" fontWeight="600" fill="var(--text-2)">
            {nearest?.walkTo ?? 0} мин
          </text>
          <text x="253" y="105" textAnchor="middle" fontFamily="-apple-system, system-ui, sans-serif" fontSize="13" fontWeight="600" fill="var(--text-2)">
            пешком
          </text>
        </svg>
      </div>

      <h1 className="title-xl mt-22" style={{ fontSize: 27 }}>
        За {formatBudget(minutes)} рядом ничего не успеть
      </h1>
      <p className="lead">
        Ближайшее подходящее место — {nearest?.walkTo ?? 0} минут пешком. Туда и обратно это уже{' '}
        {nearest ? nearest.eval.road : 0} минут, на само место не остаётся ничего.
      </p>

      {nearest && (
        <div className="card mt-20">
          <SectionLabel>Ближайшее, что реально успеть</SectionLabel>
          <div className="row mt-10">
            <div className="grow" style={{ fontSize: 17, fontWeight: 700 }}>{nearest.name}</div>
            <span className="badge badge--warn">нужно {needed} мин</span>
          </div>
          <div className="mt-12">
            <TimeBudgetBar budget={needed} walkTo={nearest.walkTo} visit={nearest.minVisit} walkBack={nearest.walkBack} height={10} legend={false} />
          </div>
          <div className="mt-8" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
            {nearest.walkTo} мин туда · ~{nearest.minVisit} мин на месте · {nearest.walkBack} мин обратно
          </div>
        </div>
      )}

      <div className="spacer" />

      <Button onClick={onAddTime}>
        Добавить 30 минут{suggestion ? ` — будет ${plural(suggestion, 'место', 'места', 'мест')}` : ''}
      </Button>
      <Button variant="secondary" onClick={onEditInterests}>Изменить интересы</Button>
      <Button variant="ghost" onClick={onShowAnyway}>Всё равно показать, что рядом</Button>
    </Screen>
  );
}
