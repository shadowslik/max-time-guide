// Полоса бюджета времени — главная механика продукта.
// Один и тот же блок повторяется на выборе времени, в результатах,
// в карточке места и в маршруте: видно, что сервис считает дорогу.

const pct = (value, total) => `${Math.max(0, (value / total) * 100)}%`;

export default function TimeBudgetBar({
  budget,
  walkTo,
  visit,
  walkBack,
  height = 12,
  legend = 'values',
  visitLabel,
}) {
  const total = Math.max(budget, walkTo + visit + walkBack);
  const buffer = Math.max(0, total - walkTo - visit - walkBack);

  return (
    <>
      <div className="budget budget--animate" style={{ height }}>
        <div className="budget__seg budget__seg--road" style={{ width: pct(walkTo, total) }} />
        <div className="budget__seg budget__seg--visit" style={{ width: pct(visit, total) }} />
        <div className="budget__seg budget__seg--road" style={{ width: pct(walkBack, total) }} />
        <div className="budget__seg budget__seg--buffer" style={{ flexGrow: 1 }} />
      </div>

      {legend === 'labels' && (
        <div className="budget-legend">
          <span style={{ width: pct(walkTo, total) }}>туда</span>
          <span style={{ width: pct(visit, total) }}>на месте</span>
          <span style={{ width: pct(walkBack, total), textAlign: 'right' }}>обратно</span>
          <span style={{ flexGrow: 1, textAlign: 'right' }}>запас</span>
        </div>
      )}

      {legend === 'values' && (
        <div className="budget-legend">
          <span style={{ width: pct(walkTo, total) }}>{walkTo} мин</span>
          <span style={{ width: pct(visit, total), color: 'var(--text)' }}>
            {visitLabel ?? `~${visit} мин на месте`}
          </span>
          <span style={{ width: pct(walkBack, total), textAlign: 'right' }}>{walkBack} мин</span>
          <span style={{ flexGrow: 1, textAlign: 'right' }}>запас {buffer} мин</span>
        </div>
      )}
    </>
  );
}
