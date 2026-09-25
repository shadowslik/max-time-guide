// Демо-данные прототипа «Рядом».
// ВАЖНО: это тестовый, заранее подготовленный набор мест по центру Казани.
// В боевой версии данные приходят из внешнего источника (2ГИС/ОСМ/афиши) — см. README.
//
// У каждого места две системы координат:
//   coords — [долгота, широта] для Яндекс.Карт. Проставлены вручную по известным
//            точкам: геокодер — отдельный продукт Яндекса и в тариф ключа не входит,
//            поэтому уточнить их запросом нельзя. Погрешность — десятки метров;
//   pin    — точка острия метки на схематичной карте (viewBox 0 0 390 844),
//            она же используется, когда ключ к API карт не задан.

export const CITY = {
  name: 'Казань',
  district: 'район Кремля',
  address: 'ул. Кремлёвская, 2',
  area: 'Вахитовский район',
  user: { coords: [49.1086, 55.7951], pin: { x: 120, y: 430 } },
  zoom: 15,
};

export const INTERESTS = [
  { id: 'history', label: 'История', icon: 'museum' },
  { id: 'art', label: 'Искусство', icon: 'palette' },
  { id: 'arch', label: 'Архитектура', icon: 'building' },
  { id: 'walk', label: 'Прогулка', icon: 'walk' },
  { id: 'food', label: 'Еда', icon: 'food' },
  { id: 'photo', label: 'Красивые места', icon: 'camera' },
  { id: 'culture', label: 'Культура', icon: 'masks' },
];

// walkTo/walkBack — минуты пешком; idealVisit — комфортное время на месте;
// minVisit — минимально осмысленное время на месте (для режима «впритык»).
export const PLACES = [
  {
    id: 'kremlin',
    short: 'Кремль',
    name: 'Казанский кремль',
    interests: ['history', 'arch'],
    price: '0–500 ₽',
    priceNote: 'вход на территорию бесплатно',
    hours: 'до 22:00',
    distance: '1,1 км',
    walkTo: 12, walkBack: 13, idealVisit: 60, minVisit: 35,
    coords: [49.1056, 55.7985], pin: { x: 206, y: 302 },
    blurb: 'Белокаменная крепость ЮНЕСКО с мечетью Кул-Шариф и Благовещенским собором.',
    highlights: ['Объект ЮНЕСКО', 'Смотровые площадки', 'Кул-Шариф'],
  },
  {
    id: 'naberezhnaya',
    short: 'Набережная',
    name: 'Кремлёвская набережная',
    interests: ['walk', 'photo'],
    price: 'бесплатно',
    priceNote: 'вход свободный',
    hours: 'круглосуточно',
    distance: '0,9 км',
    walkTo: 10, walkBack: 10, idealVisit: 45, minVisit: 20,
    coords: [49.1035, 55.8025], pin: { x: 101, y: 216 },
    blurb: 'Прогулочная набережная вдоль Казанки с видом на Кремль и центр «Казан».',
    highlights: ['Виды на Кремль', 'Кафе у воды', 'Прокат'],
  },
  {
    id: 'bauman',
    short: 'Баумана',
    name: 'Улица Баумана',
    interests: ['walk', 'photo', 'food'],
    price: 'бесплатно',
    priceNote: 'вход свободный',
    hours: 'круглосуточно',
    distance: '0,7 км',
    walkTo: 8, walkBack: 8, idealVisit: 45, minVisit: 20,
    coords: [49.1215, 55.7898], pin: { x: 58, y: 342 },
    blurb: 'Пешеходная «казанский Арбат»: кафе, уличные музыканты, сувениры.',
    highlights: ['Пешеходная', 'Кафе и сувениры', 'Колокольня'],
  },
  {
    id: 'kulsharif',
    short: 'Кул-Шариф',
    name: 'Мечеть Кул-Шариф',
    interests: ['arch', 'culture'],
    price: 'бесплатно',
    priceNote: 'вход свободный',
    hours: 'до 18:00',
    distance: '1,3 км',
    walkTo: 14, walkBack: 14, idealVisit: 35, minVisit: 20,
    coords: [49.1052, 55.7981], pin: { x: 167, y: 386 },
    blurb: 'Главная мечеть Татарстана — символ города, внутри музей ислама.',
    highlights: ['Символ Казани', 'Музей ислама', 'Вход свободный'],
  },
  {
    id: 'museum',
    short: 'Нацмузей',
    name: 'Национальный музей РТ',
    interests: ['history', 'art'],
    price: '0–400 ₽',
    priceNote: 'по Пушкинской карте',
    hours: 'до 18:00',
    distance: '1,4 км',
    walkTo: 15, walkBack: 15, idealVisit: 55, minVisit: 30,
    coords: [49.1086, 55.7966], pin: { x: 306, y: 268 },
    blurb: 'Крупнейший музей республики: от древности до современного искусства.',
    highlights: ['Крупная экспозиция', 'Пушкинская карта', 'Гардероб'],
  },
  {
    id: 'chakchak',
    short: 'Музей чак-чака',
    name: 'Музей чак-чака',
    interests: ['food', 'culture'],
    price: '400–600 ₽',
    priceNote: 'с дегустацией',
    hours: 'до 19:00',
    distance: '1,7 км',
    walkTo: 18, walkBack: 18, idealVisit: 40, minVisit: 30,
    coords: [49.114, 55.7807], pin: { x: 328, y: 429 },
    blurb: 'Дегустация татарских сладостей и чаепитие в старинном доме Старо-Татарской слободы.',
    highlights: ['Дегустация', 'Чаепитие', 'По записи'],
  },
  {
    id: 'kazan',
    short: '«Казан»',
    name: 'Центр семьи «Казан»',
    interests: ['arch', 'photo'],
    price: '0–200 ₽',
    priceNote: 'смотровая платная',
    hours: 'до 22:00',
    distance: '2,3 км',
    walkTo: 25, walkBack: 25, idealVisit: 30, minVisit: 20,
    coords: [49.1063, 55.8146], pin: { x: 266, y: 475 },
    blurb: 'ЗАГС в форме казана со смотровой площадкой и панорамой Казанки.',
    highlights: ['Смотровая', 'Панорама', 'Фотоспот'],
  },
  {
    id: 'temple',
    short: 'Храм всех религий',
    name: 'Храм всех религий',
    interests: ['arch', 'photo'],
    price: '0–300 ₽',
    priceNote: 'экскурсия отдельно',
    hours: 'до 20:00',
    distance: '4,1 км',
    walkTo: 45, walkBack: 45, idealVisit: 40, minVisit: 30,
    coords: [48.967, 55.7392], pin: { x: 352, y: 560 },
    blurb: 'Необычный архитектурный комплекс с куполами и башнями разных конфессий.',
    highlights: ['Уникальная архитектура', 'Далеко от центра', 'Фотоспот'],
  },
];

// Демо-история поездок: то, что в чат-боте открывается по команде «Мои маршруты».
export const HISTORY = [
  {
    id: 'h1', city: 'Казань', place: 'Казанский кремль', placeId: 'kremlin',
    date: '22 сентября', minutes: 85, walkTo: 12, visit: 60, walkBack: 13,
    interests: ['history', 'arch'],
  },
  { id: 'h2', city: 'Казань', place: 'Кремлёвская набережная', placeId: 'naberezhnaya', date: '22 сентября', minutes: 40 },
  { id: 'h3', city: 'Нижний Новгород', place: 'Чкаловская лестница', date: '8 сентября', minutes: 55 },
  { id: 'h4', city: 'Екатеринбург', place: 'Храм-на-Крови', date: '14 августа', minutes: 70 },
  { id: 'h5', city: 'Самара', place: 'Набережная Волги', date: '2 августа', minutes: 90 },
];

export const TIME_OPTIONS = [
  { minutes: 30, label: '30 мин', hint: 'только совсем рядом' },
  { minutes: 60, label: '1 час', hint: 'одно место без спешки' },
  { minutes: 90, label: '1,5 часа', hint: 'можно уйти подальше' },
  { minutes: 120, label: '2 часа', hint: 'обычно 2 места' },
  { minutes: 180, label: '3 часа', hint: 'хватит на цепочку' },
];

export const CUSTOM_TIME = { min: 15, max: 240, step: 5 };
