// Переходы между экранами и модальными шторками.
//
// Уходящий экран держим смонтированным на время анимации, но рендерим
// оба слоя ОДНИМ массивом с ключами: так React сопоставляет слой по ключу
// и сохраняет его состояние. Иначе уходящий экран пересоздавался бы —
// а вместе с ним и карта Яндекса, что дорого и заметно мигает.

import { useEffect, useRef, useState } from 'react';

const SCREEN_MS = 320;
const SHEET_MS = 300;

export function ScreenStack({ screenKey, direction = 'push', children }) {
  const [key, setKey] = useState(screenKey);
  const [prev, setPrev] = useState(null);
  const lastNode = useRef(children);

  if (key !== screenKey) {
    setPrev({ key, node: lastNode.current });
    setKey(screenKey);
  }

  useEffect(() => {
    lastNode.current = children;
  });

  useEffect(() => {
    if (!prev) return undefined;
    const timer = setTimeout(() => setPrev(null), SCREEN_MS);
    return () => clearTimeout(timer);
  }, [prev]);

  const layers = [];
  if (prev) {
    layers.push({
      key: prev.key,
      node: prev.node,
      className: `stack__layer stack__layer--leaving stack__layer--${direction}-out`,
    });
  }
  layers.push({
    key,
    node: children,
    className: `stack__layer${prev ? ` stack__layer--${direction}-in` : ''}`,
  });

  return (
    <div className="stack">
      {layers.map((layer) => (
        <div key={layer.key} className={layer.className}>
          {layer.node}
        </div>
      ))}
    </div>
  );
}

// Шторка поверх экрана: при закрытии живёт ещё один такт, чтобы успеть уехать вниз.
export function Overlay({ active, children }) {
  const [shown, setShown] = useState(Boolean(active));
  const last = useRef(children);
  if (active) last.current = children;

  useEffect(() => {
    if (active) {
      setShown(true);
      return undefined;
    }
    if (!shown) return undefined;
    const timer = setTimeout(() => setShown(false), SHEET_MS);
    return () => clearTimeout(timer);
  }, [active, shown]);

  if (!shown) return null;
  return <div className={`overlay${active ? '' : ' overlay--leaving'}`}>{last.current}</div>;
}
