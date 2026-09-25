import { useEffect, useState } from 'react';

import Icon, { CheckDot, Spinner } from '../components/Icon.jsx';
import { Screen } from '../components/ui.jsx';
import { CITY, INTERESTS } from '../data/places.js';
import { formatBudget, interestsLabel } from '../lib/format.js';

const STEP_MS = 480;

export default function LoadingScreen({ theme, minutes, interests, found, fits, onDone }) {
  const [step, setStep] = useState(0);

  const steps = [
    { label: 'Определяем расстояние', meta: `${found} мест` },
    { label: 'Проверяем твоё время', meta: `${minutes} мин` },
    { label: 'Считаем маршрут туда и обратно' },
    { label: 'Проверяем условия посещения' },
    { label: 'Сравниваем варианты' },
  ];

  useEffect(() => {
    if (step >= steps.length) {
      const done = setTimeout(onDone, STEP_MS);
      return () => clearTimeout(done);
    }
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [step, steps.length, onDone]);

  const accent = theme === 'dark' ? 'var(--accent-text)' : 'var(--accent)';
  const progress = Math.round(((step + 1) / (steps.length + 1)) * 100);

  return (
    <Screen className="screen--loading" style={{ alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60 }}>
        <div style={{ position: 'relative', width: 132, height: 132 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-soft)' }} />
          <svg width="132" height="132" viewBox="0 0 132 132" fill="none" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
            <circle cx="66" cy="66" r="60" stroke="var(--bar-buffer)" strokeWidth="5" />
            <g className="spin" style={{ transformOrigin: '66px 66px' }}>
              <path d="M66 6a60 60 0 0 1 52 30" stroke={accent} strokeWidth="5" strokeLinecap="round" />
            </g>
            <path d="M40 92c14 2 18-10 30-12s16-14 24-16" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
            <circle cx="40" cy="92" r="5.5" fill={accent} />
            <path d="M94 50c5.4 0 9.8 4.4 9.8 9.8 0 6.6-8.2 14.3-9.3 15.2a.8.8 0 0 1-1.1 0c-1.1-.9-9.3-8.6-9.3-15.2 0-5.4 4.4-9.8 9.9-9.8Z" fill={accent} />
            <circle cx="94" cy="59.8" r="3.7" fill="var(--accent-soft)" />
          </svg>
        </div>

        <h1 className="title-l mt-26" style={{ fontSize: 26 }}>Подбираем места…</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14.5, color: 'var(--text-2)', textAlign: 'center' }}>
          {CITY.name}, {CITY.district} · {formatBudget(minutes)}
          <br />
          {interestsLabel(interests, INTERESTS)}
        </p>
      </div>

      <div className="steps-card mt-24" style={{ width: '100%' }}>
        {steps.map((item, index) => (
          <div key={item.label} className="rise" style={{ animationDelay: `${index * 60}ms` }}>
            {index > 0 && <div className="steps-card__sep" />}
            <div className="steps-card__row">
              {index < step ? <CheckDot /> : index === step ? <Spinner /> : <CheckDot done={false} />}
              <span className={`steps-card__label${index === step ? ' steps-card__label--now' : index > step ? ' steps-card__label--todo' : ''}`}>
                {item.label}
              </span>
              {index === step ? (
                <span className="steps-card__meta steps-card__meta--now">сейчас</span>
              ) : index < step && item.meta ? (
                <span className="steps-card__meta num">{item.meta}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="spacer" />

      <div style={{ width: '100%' }}>
        <div className="progress">
          <div className="progress__fill" style={{ width: `${progress}%` }} />
        </div>
        <p style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 13.5, color: 'var(--text-2)' }}>
          Нашли <strong style={{ color: 'var(--text)' }}>{found} мест</strong> рядом — {fits} подходят под твоё время
        </p>
      </div>
    </Screen>
  );
}
