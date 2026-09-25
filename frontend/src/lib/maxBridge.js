// Тонкая прослойка над окружением MAX: тема и платформа.
// Если мини-приложение открыто вне MAX (например, в браузере при разработке),
// всё аккуратно откатывается к системным настройкам.

function bridge() {
  if (typeof window === 'undefined') return null;
  return window.WebApp || window.max || window.maxApp || null;
}

export function detectColorScheme() {
  const scheme = bridge()?.colorScheme;
  if (scheme === 'light' || scheme === 'dark') return scheme;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function detectPlatform() {
  const platform = bridge()?.platform;
  if (platform === 'ios' || platform === 'android') return platform;
  if (typeof navigator === 'undefined') return 'ios';
  return /android/i.test(navigator.userAgent) ? 'android' : 'ios';
}

// Подписка на смену темы: и на события MAX, и на системную медиа-запрос.
export function onColorSchemeChange(handler) {
  const cleanups = [];
  const api = bridge();

  if (api?.onEvent && api?.offEvent) {
    const listener = () => handler(detectColorScheme());
    api.onEvent('themeChanged', listener);
    cleanups.push(() => api.offEvent('themeChanged', listener));
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => handler(detectColorScheme());
    mq.addEventListener('change', listener);
    cleanups.push(() => mq.removeEventListener('change', listener));
  }

  return () => cleanups.forEach((fn) => fn());
}

// Сообщаем MAX, что приложение готово и хочет занять весь экран.
export function notifyReady() {
  const api = bridge();
  try {
    api?.ready?.();
    api?.expand?.();
  } catch {
    /* вне MAX эти методы недоступны — это нормально */
  }
}

// Открыть маршрут во внешних картах: пробуем через MAX, иначе обычная ссылка.
export function openExternal(url) {
  const api = bridge();
  try {
    if (api?.openLink) {
      api.openLink(url);
      return;
    }
  } catch {
    /* падаем в обычное открытие вкладки */
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
