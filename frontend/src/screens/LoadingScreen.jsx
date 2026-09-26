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
        <div className="loader">
          <span className="loader__ring" />
          <Icon name="explore" size={56} />
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
