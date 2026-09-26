// Метка на карте: капля с белой обводкой. Цвет кодирует, успеваешь ли ты в это место.

export const TONE = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  muted: 'var(--muted-pin)',
  accent: 'var(--accent)',
};

export const TEARDROP =
  'M14 .9C21.2.9 27.1 6.8 27.1 14c0 8.9-11.2 19.7-12.5 20.9a.9.9 0 0 1-1.2 0C12.1 33.7.9 22.9.9 14 .9 6.8 6.8.9 14 .9Z';

export default function MapPin({ tone = 'ok', size = 30, number, glyph, title }) {
  const height = Math.round((size * 36) / 28);
  return (
    <svg width={size} height={height} viewBox="0 0 28 36" fill="none" role="img" aria-label={title}>
      {title ? <title>{title}</title> : null}
      <path d={TEARDROP} fill={TONE[tone] ?? TONE.ok} stroke="#FFFFFF" strokeWidth="1.8" />
      {number != null ? (
        <text
          x="14"
          y="18.8"
          textAnchor="middle"
          fontFamily="-apple-system, system-ui, sans-serif"
          fontSize="14"
          fontWeight="700"
          fill="#FFFFFF"
        >
          {number}
        </text>
      ) : glyph === 'museum' ? (
        <path
          d="M9 18.5h10M10.5 18.5v-5.2M13 18.5v-5.2M15 18.5v-5.2M17.5 18.5v-5.2M9.2 13 14 9.3l4.8 3.7"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <circle cx="14" cy="14" r="4.6" fill="#FFFFFF" />
      )}
    </svg>
  );
}

// Крупная перетаскиваемая метка в центре экрана «указать место на карте».
export function CenterPin() {
  return (
    <svg width="40" height="50" viewBox="0 0 28 36" fill="none" aria-hidden="true">
      <path d={TEARDROP} fill="currentColor" />
      <circle cx="14" cy="14" r="5.4" fill="#FFFFFF" />
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
function pinSvgHtml({ tone = 'ok', size = 30, number, glyph }) {
  const height = Math.round((size * 36) / 28);
  const inner =
    number != null
      ? `<text x="14" y="18.8" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="14" font-weight="700" fill="#FFFFFF">${number}</text>`
      : glyph === 'museum'
        ? '<path d="M9 18.5h10M10.5 18.5v-5.2M13 18.5v-5.2M15 18.5v-5.2M17.5 18.5v-5.2M9.2 13 14 9.3l4.8 3.7" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>'
        : '<circle cx="14" cy="14" r="4.6" fill="#FFFFFF"></circle>';

  return (
    `<svg width="${size}" height="${height}" viewBox="0 0 28 36" fill="none">` +
    `<path d="${TEARDROP}" fill="${TONE[tone] ?? TONE.ok}" stroke="#FFFFFF" stroke-width="1.8"></path>` +
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
