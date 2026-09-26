// Метка на карте: капля с белой обводкой. Цвет кодирует, успеваешь ли ты в это место.

export const TONE = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  muted: 'var(--muted-pin)',
  accent: 'var(--accent)',
};

// Капля метки — Material Symbols «location_on» (заливка), та же сетка
// 0 -960 960 960, что и у остальных иконок. Остриё приходится на низ
// viewBox, поэтому метка ставится anchor: 'bottom' без поправок.
export const TEARDROP = 'M536.5-503.5Q560-527 560-560t-23.5-56.5Q513-640 480-640t-56.5 23.5Q400-593 400-560t23.5 56.5Q447-480 480-480t56.5-23.5ZM480-80Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z';

// Центр «шарика» внутри капли в координатах этой сетки.
const EYE = { cx: 480, cy: -560, r: 132 };

export default function MapPin({ tone = 'ok', size = 30, number, title }) {
  const height = Math.round(size * 1.2);
  return (
    <svg width={size} height={height} viewBox="0 -960 960 960" fill="none" role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <path d={TEARDROP} fill={TONE[tone] ?? TONE.ok} stroke="#FFFFFF" strokeWidth="46" paintOrder="stroke" />
      {number != null ? (
        <text
          x={EYE.cx}
          y={EYE.cy + 60}
          textAnchor="middle"
          fontFamily="-apple-system, system-ui, sans-serif"
          fontSize="200"
          fontWeight="700"
          fill="#FFFFFF"
        >
          {number}
        </text>
      ) : (
        <circle cx={EYE.cx} cy={EYE.cy} r={EYE.r} fill="#FFFFFF" />
      )}
    </svg>
  );
}

// Крупная перетаскиваемая метка в центре экрана «указать место на карте».
export function CenterPin() {
  return (
    <svg width="42" height="50" viewBox="0 -960 960 960" fill="none" aria-hidden="true">
      <path d={TEARDROP} fill="currentColor" stroke="#FFFFFF" strokeWidth="40" paintOrder="stroke" />
      <circle cx={EYE.cx} cy={EYE.cy} r={EYE.r} fill="#FFFFFF" />
    </svg>
  );
}

export function toneForStatus(status) {
  if (status === 'fits') return 'ok';
  if (status === 'tight') return 'warn';
  return 'muted';
}

// Та же метка, но узлом DOM — MapLibre размещает метки собственными
// элементами, а не React-деревом. Позиционирует их сам (anchor: 'bottom'),
// поэтому никаких transform внутри быть не должно.
function pinSvgHtml({ tone = 'ok', size = 30, number }) {
  const height = Math.round(size * 1.2);
  const inner =
    number != null
      ? `<text x="${EYE.cx}" y="${EYE.cy + 60}" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="200" font-weight="700" fill="#FFFFFF">${number}</text>`
      : `<circle cx="${EYE.cx}" cy="${EYE.cy}" r="${EYE.r}" fill="#FFFFFF"></circle>`;

  return (
    `<svg width="${size}" height="${height}" viewBox="0 -960 960 960" fill="none">` +
    `<path d="${TEARDROP}" fill="${TONE[tone] ?? TONE.ok}" stroke="#FFFFFF" stroke-width="46" paint-order="stroke"></path>` +
    `${inner}</svg>`
  );
}

export function pinElement({ label, labelTone, delay = 0, onClick, ...pin }) {
  const node = document.createElement('div');
  node.className = `map-pin pin-drop${pin.tone === 'muted' ? ' map-pin--muted' : ''}`;
  node.style.animationDelay = `${delay}ms`;
  node.innerHTML =
    (label ? `<span class="pin-label${labelTone === 'dark' ? ' pin-label--dark' : ''}">${label}</span>` : '') +
    pinSvgHtml(pin);

  if (onClick) {
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
    if (pin.title) node.setAttribute('aria-label', pin.title);
    node.addEventListener('click', onClick);
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick();
      }
    });
  }
  return node;
}

export function userElement({ halo = false, label } = {}) {
  const node = document.createElement('div');
  node.className = 'map-user';
  node.innerHTML =
    (halo ? '<span class="map-user__halo"></span>' : '') +
    '<span class="map-user__dot"></span>' +
    (label ? `<span class="pin-label pin-label--accent map-user__label">${label}</span>` : '');
  return node;
}
