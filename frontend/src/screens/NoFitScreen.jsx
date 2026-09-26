import Icon from '../components/Icon.jsx';
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

      {/* Схема «радиус, в который упираешься»: кружок — докуда успеваешь,
          метка снаружи — ближайшее место. Обе иконки из Material Symbols. */}
      <div className="reach mt-14">
        <div className="reach__circle">
          <span className="reach__dot" />
          <span className="reach__caption">всё, что успеешь за {minutes} мин</span>
        </div>
        <span className="reach__link" />
        <div className="reach__far">
          <Icon name="pin" size={40} />
          <span className="reach__caption">
            {nearest?.walkTo ?? 0} мин
            <br />
            пешком
          </span>
        </div>
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
