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

// Та же метка, но строкой HTML — для меток Яндекс.Карт 2.1,
// которые рисуются через templateLayoutFactory, а не через React.
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

export function pinHtml({ label, labelTone, delay = 0, ...pin }) {
  const labelHtml = label
    ? `<div class="pin-label ymx-pin__label${labelTone === 'dark' ? ' pin-label--dark' : ''}">${label}</div>`
    : '';
  const muted = pin.tone === 'muted' ? ' ymx-pin--muted' : '';
  return (
    `<div class="ymx-pin pin-drop${muted}" style="animation-delay:${delay}ms">` +
    `${labelHtml}${pinSvgHtml(pin)}</div>`
  );
}

export function userDotHtml({ halo = false, label } = {}) {
  const haloHtml = halo ? '<span class="user-halo ymx-user__halo"></span>' : '';
  const labelHtml = label
    ? `<span class="pin-label pin-label--accent ymx-user__label">${label}</span>`
    : '';
  return `<div class="ymx-user">${haloHtml}<span class="user-dot ymx-user__dot"></span>${labelHtml}</div>`;
}
