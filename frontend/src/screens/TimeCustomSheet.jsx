import { useState } from 'react';

import Icon from '../components/Icon.jsx';
import { Button, Scrim, Sheet } from '../components/ui.jsx';
import { CUSTOM_TIME } from '../data/places.js';
import { addMinutes, clock, formatDuration } from '../lib/format.js';

export default function TimeCustomSheet({ minutes, startAt, onApply, onClose }) {
  const [value, setValue] = useState(minutes);
  const { min, max, step } = CUSTOM_TIME;
  const ratio = (value - min) / (max - min);
  const shift = (amount) => setValue((v) => Math.min(max, Math.max(min, v + amount)));

  return (
    <>
      <Scrim onClick={onClose} />

      <Sheet height={430} onDismiss={onClose}>
        <div className="row">
          <h2 className="title-s grow">Точное время</h2>
          <button type="button" className="params__edit" style={{ borderRadius: '50%', width: 32, height: 32, background: 'var(--surface-muted)', color: 'var(--text-2)' }} aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="readout mt-26">
          <div className="readout__value num">{formatDuration(value)}</div>
          <div className="readout__sub">
            сейчас {clock(startAt)} · вернёшься к {clock(addMinutes(startAt, value))}
          </div>
        </div>

        <div className="slider mt-26">
          <span className="slider__track" />
          <span className="slider__fill" style={{ width: `${ratio * 100}%` }} />
          <span className="slider__knob" style={{ left: `${ratio * 100}%` }} />
          <input
            className="slider__input"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label="Свободное время в минутах"
            onChange={(event) => setValue(Number(event.target.value))}
          />
        </div>
        <div className="mt-6" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
          <span>{min} мин</span>
          <span>{formatDuration(max)}</span>
        </div>

        <div className="stepper mt-20">
          <button type="button" className="stepper__btn" onClick={() => shift(-15)}>
            <Icon name="minus" size={16} />15 мин
          </button>
          <button type="button" className="stepper__btn" onClick={() => shift(15)}>
            <Icon name="plus" size={16} />15 мин
          </button>
        </div>

        <div className="spacer" />

        <Button onClick={() => onApply(value)}>Готово</Button>
      </Sheet>
    </>
  );
}
