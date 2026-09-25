// Примитивы интерфейса: экран, шторка, кнопки, бейджи, сегменты.

import Icon from './Icon.jsx';

export { default as Sheet } from './Sheet.jsx';

export function Screen({ children, className = '', variant, ...rest }) {
  const mod = variant ? ` screen--${variant}` : '';
  return (
    <div className={`screen${mod} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function TopBar({ onBack, backLabel = 'Назад', right, children }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button type="button" className="icon-button icon-button--flat" aria-label={backLabel} onClick={onBack}>
          <Icon name="chevronLeft" size={22} />
        </button>
      ) : (
        <span />
      )}
      {children}
      {right ?? <span />}
    </div>
  );
}

export function Steps({ current, total = 3 }) {
  return (
    <div className="steps">
      <div className="steps__dots">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`steps__dot${i + 1 === current ? ' steps__dot--on' : ''}`} />
        ))}
      </div>
      <span className="steps__label">
        Шаг {current} из {total}
      </span>
    </div>
  );
}

export function Button({ variant = 'primary', children, className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn--${variant} ${className}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export function Scrim({ onClick }) {
  return <div className="scrim" onClick={onClick} role="presentation" />;
}

export function SectionLabel({ children, className = '', ...rest }) {
  return (
    <div className={`section-label ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ tone = 'ok', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function Segmented({ value, items, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          className={`segmented__item${item.id === value ? ' segmented__item--on' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

