import { useEffect, useRef, useState } from 'react';

import Icon from '../components/Icon.jsx';
import { Screen, SectionLabel, TopBar } from '../components/ui.jsx';
import { searchAddress } from '../lib/geocoder.js';

const DEBOUNCE_MS = 350;

export default function AddressScreen({ onPick, onBack }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  // Клавиатура должна открыться сразу: экран существует только ради ввода.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Запрос уходит не на каждую букву, и предыдущий отменяется —
  // иначе ответы приходят вразнобой и список скачет.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResults([]);
      setBusy(false);
      return undefined;
    }

    setBusy(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await searchAddress(text, controller.signal);
      if (!controller.signal.aborted) {
        setResults(found);
        setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const empty = query.trim().length >= 3 && !busy && results.length === 0;

  return (
    <Screen variant="scroll">
      <TopBar onBack={onBack} />

      <h1 className="title-xl mt-10">Введи адрес</h1>
      <p className="lead">Улицу, дом или название места — покажем на карте и посчитаем время оттуда.</p>

      <label className="field mt-20">
        <Icon name="search" size={20} className="field__icon" />
        <input
          ref={inputRef}
          className="field__input"
          type="text"
          value={query}
          placeholder="Например, Кремлёвская 2"
          autoComplete="off"
          spellCheck="false"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button type="button" className="field__clear" aria-label="Очистить" onClick={() => setQuery('')}>
            <Icon name="close" size={16} />
          </button>
        )}
      </label>

      {results.length > 0 && (
        <>
          <SectionLabel className="mt-22">Нашли</SectionLabel>
          <div className="list mt-4">
            {results.map((item, index) => (
              <div key={item.id ?? index}>
                {index > 0 && <div className="list__sep" />}
                <button type="button" className="list__row" onClick={() => onPick(item.coords)}>
                  <span className="list__icon">
                    <Icon name="pin" size={19} />
                  </span>
                  <span className="list__body">
                    <span className="list__title" style={{ display: 'block' }}>{item.title}</span>
                    {item.subtitle && (
                      <span className="list__sub" style={{ display: 'block' }}>{item.subtitle}</span>
                    )}
                  </span>
                  <span style={{ flexShrink: 0, color: 'var(--chevron)', display: 'flex' }}>
                    <Icon name="chevronRight" size={18} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {busy && <p className="hint-line mt-22">Ищем…</p>}
      {empty && <p className="hint-line mt-22">Ничего не нашлось. Попробуй короче — например, только улицу.</p>}
      {!query && <p className="hint-line mt-22">Начни вводить адрес — подсказки появятся сами.</p>}
    </Screen>
  );
}
