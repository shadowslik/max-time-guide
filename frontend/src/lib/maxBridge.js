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

// initData может лежать не только в объекте SDK, но и в URL запуска мини-аппа
// (MAX/Telegram кладут его в hash или query). Проверяем все известные ключи.
function initDataFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const parts = [window.location.hash.slice(1), window.location.search.slice(1)];
    for (const raw of parts) {
      if (!raw) continue;
      const p = new URLSearchParams(raw);
      for (const key of ['initData', 'tgWebAppData', 'webAppData', 'web_app_data', 'max_web_app_data']) {
        const v = p.get(key);
        if (v) return v;
      }
    }
  } catch {
    /* нет доступа к URL — не страшно */
  }
  return '';
}

// initData — строка авторизации MAX (для запросов к бэкенду). Вне MAX пусто.
export function getInitData() {
  const api = bridge();
  try {
    if (api?.initData) return api.initData;
    if (window.Telegram?.WebApp?.initData) return window.Telegram.WebApp.initData;
  } catch {
    /* продолжаем к URL */
  }
  return initDataFromUrl();
}

function userFromInitData(initData) {
  try {
    const raw = new URLSearchParams(initData).get('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Данные пользователя MAX: имя и аватар. Разные версии кладут их по-разному,
// поэтому проверяем объект SDK, Telegram-совместимый мост и саму initData.
export function getUser() {
  const api = bridge();
  let u = null;
  try {
    u =
      api?.initDataUnsafe?.user ||
      api?.user ||
      window.Telegram?.WebApp?.initDataUnsafe?.user ||
      (typeof window !== 'undefined' ? window.maxUser : null);
  } catch {
    /* пробуем из initData ниже */
  }
  if (!u) u = userFromInitData(getInitData());
  if (!u) return null;
  const name = u.first_name || u.name || u.username || u.displayName || null;
  const avatar = u.photo_url || u.avatar_url || u.avatar || u.photo || null;
  return { name, avatar };
}

// Временная диагностика: что реально доступно в webview MAX (глобалы, initData).
// По ней подхватим правильные поля пользователя. Убрать после настройки.
export function debugInfo() {
  const out = {};
  try {
    out.href = window.location.href;
    out.globals = Object.keys(window).filter((k) => /web|max|tg|telegram|bridge|app|vk/i.test(k)).slice(0, 40);
    for (const g of ['WebApp', 'max', 'maxApp', 'Max', 'MAX', 'Telegram', 'vkBridge', 'bridge']) {
      const o = window[g];
      if (o && typeof o === 'object') {
        out[g] = Object.keys(o).slice(0, 40);
        if (o.initDataUnsafe && typeof o.initDataUnsafe === 'object') {
          out[g + '.initDataUnsafe'] = Object.keys(o.initDataUnsafe);
        }
      }
    }
    out.initData = String(getInitData()).slice(0, 160);
    out.user = getUser();
  } catch (e) {
    out.error = String(e);
  }
  return out;
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
