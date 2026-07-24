import type { Locale } from './i18n';

/**
 * Static interface strings. Content (dishes, articles, pages) lives in
 * src/content and is edited via the CMS; these are developer-owned labels.
 */
const strings = {
  'nav.home': { en: 'Home', th: 'หน้าแรก', ru: 'Главная' },
  'nav.menu': { en: 'Menu', th: 'เมนู', ru: 'Меню' },
  'nav.about': { en: 'About us', th: 'เกี่ยวกับเรา', ru: 'О нас' },
  'nav.contact': { en: 'Contact & location', th: 'ติดต่อและแผนที่', ru: 'Контакты и адрес' },
  'nav.blog': { en: 'Blog', th: 'บทความ', ru: 'Блог' },
  'nav.faq': { en: 'FAQ', th: 'คำถามที่พบบ่อย', ru: 'Вопросы и ответы' },
  'home.viewMenu': { en: 'View the menu', th: 'ดูเมนู', ru: 'Смотреть меню' },
  'home.orderGrab': { en: 'Order on GrabFood', th: 'สั่งผ่าน GrabFood', ru: 'Заказать в GrabFood' },
  'home.getDirections': { en: 'Get directions', th: 'นำทาง', ru: 'Как добраться' },
  'home.featured': { en: 'Popular dishes', th: 'เมนูแนะนำ', ru: 'Популярные блюда' },
  'home.menuCount': { en: '{count} dishes', th: '{count} เมนู', ru: '{count} блюдо' },
  'home.menuCountNote': {
    en: 'Thai, Western, drinks',
    th: 'ไทย ตะวันตก เครื่องดื่ม',
    ru: 'тайское, европейское, напитки',
  },
  'home.openDailyNote': {
    en: 'Dine-in + GrabFood',
    th: 'นั่งทานที่ร้าน + GrabFood',
    ru: 'Зал + GrabFood',
  },
  'home.openDailyHint': {
    en: 'Dine-in hours, 24/7 delivery',
    th: 'เวลานั่งทานและเดลิเวอรี 24 ชม.',
    ru: 'часы зала и доставка 24/7',
  },
  'home.happyCowNote': {
    en: 'Found by vegan travelers',
    th: 'นักเดินทางวีแกนหาเจอ',
    ru: 'находят vegan-туристы',
  },
  // {open} and {close} are replaced at render time from locations.json
  'home.openChip': {
    en: 'Dine-in {open}–{close} · delivery 24/7',
    th: 'นั่งทาน {open}–{close} · เดลิเวอรี 24 ชม.',
    ru: 'Зал {open}–{close} · доставка 24/7',
  },
  'home.seeInMenu': { en: 'See in menu', th: 'ดูในเมนู', ru: 'Найти в меню' },
  'home.findUs': { en: 'Find us', th: 'มาหาเราได้ที่นี่', ru: 'Как нас найти' },
  'trust.jay': { en: '100% vegan', th: 'อาหารเจ 100%', ru: '100% веган' },
  'trust.family': { en: 'Family-run', th: 'ร้านครอบครัว', ru: 'Семейное кафе' },
  'trust.happycow': { en: '5.0★ on HappyCow', th: '5.0★ ใน HappyCow', ru: '5.0★ на HappyCow' },
  'trust.honest': {
    en: 'No fish sauce, no egg, no dairy',
    th: 'ไม่ใส่น้ำปลา ไข่ นม',
    ru: 'Без рыбного соуса, яиц и молока',
  },
  'menu.title': { en: 'Our menu', th: 'เมนูของเรา', ru: 'Наше меню' },
  'menu.spicy': { en: 'spicy', th: 'เผ็ด', ru: 'острое' },
  'menu.categoriesNav': { en: 'Menu categories', th: 'หมวดเมนู', ru: 'Разделы меню' },
  'menu.contains': { en: 'Contains', th: 'มีส่วนผสม', ru: 'Содержит' },
  'menu.backToTop': { en: 'Back to top', th: 'กลับขึ้นบน', ru: 'Наверх' },
  'menu.orderGrab': {
    en: 'Order delivery on GrabFood',
    th: 'สั่งเดลิเวอรีผ่าน GrabFood',
    ru: 'Заказать доставку в GrabFood',
  },
  'menu.orderClosing': {
    en: 'Hungry already? The whole menu is on GrabFood too.',
    th: 'หิวแล้วใช่ไหม เมนูทั้งหมดสั่งผ่าน GrabFood ได้เลย',
    ru: 'Уже проголодались? Всё это меню есть и в GrabFood.',
  },
  'tag.vegan': { en: 'vegan', th: 'วีแกน', ru: 'веган' },
  'tag.jay': { en: 'jay', th: 'อาหารเจ', ru: 'джей' },
  'tag.jain-friendly': { en: 'jain-friendly', th: 'เหมาะกับแขกเชน', ru: 'джайн-френдли' },
  'tag.gluten-free': { en: 'gluten-free', th: 'ไร้กลูเตน', ru: 'без глютена' },
  'tag.raw': { en: 'raw', th: 'โรว์ฟู้ด', ru: 'raw' },
  'tag.nut-free': { en: 'nut-free', th: 'ไม่มีถั่ว', ru: 'без орехов' },
  'actions.quick': { en: 'Quick actions', th: 'เมนูลัด', ru: 'Быстрые действия' },
  'actions.call': { en: 'Call', th: 'โทร', ru: 'Звонок' },
  'actions.order': { en: 'Order', th: 'สั่ง', ru: 'Заказ' },
  'actions.map': { en: 'Map', th: 'แผนที่', ru: 'Карта' },
  'contact.callUs': { en: 'Call us', th: 'โทรหาเรา', ru: 'Позвоните нам' },
  'a11y.skipToContent': {
    en: 'Skip to content',
    th: 'ข้ามไปยังเนื้อหา',
    ru: 'Перейти к содержимому',
  },
  'notFound.text': {
    en: 'This page wandered off — maybe to the kitchen. The menu is ready, though.',
    th: 'ไม่พบหน้านี้ แต่เมนูของเรายังอยู่นะ',
    ru: 'Эта страница куда-то ушла. Зато меню на месте.',
  },
  'contact.hours': { en: 'Opening hours', th: 'เวลาเปิด-ปิด', ru: 'Часы работы' },
  'contact.address': { en: 'Address', th: 'ที่อยู่', ru: 'Адрес' },
  'contact.phone': { en: 'Phone', th: 'โทร', ru: 'Телефон' },
  'contact.closed': { en: 'Closed', th: 'ปิด', ru: 'Закрыто' },
  'contact.findUs': { en: 'Find us on the map', th: 'ดูแผนที่', ru: 'Мы на карте' },
  'contact.nightOrders': {
    en: 'Planning to visit? Use dine-in hours. Delivery runs 24/7 through GrabFood.',
    th: 'จะมาที่ร้านให้ดูเวลานั่งทาน เดลิเวอรีเปิด 24 ชม. ผ่าน GrabFood',
    ru: 'В кафе ориентируйтесь на часы зала. Доставка через GrabFood работает 24/7.',
  },
  'blog.readMore': { en: 'Read more', th: 'อ่านต่อ', ru: 'Читать далее' },
  'footer.reviews': { en: 'Leave us a review', th: 'รีวิวร้านเรา', ru: 'Оставить отзыв' },
  'lang.switch': { en: 'Language', th: 'ภาษา', ru: 'Язык' },
  'notFound.title': { en: 'Page not found', th: 'ไม่พบหน้านี้', ru: 'Страница не найдена' },
  'notFound.back': { en: 'Back to the home page', th: 'กลับหน้าแรก', ru: 'Вернуться на главную' },
  'days.mon': { en: 'Mon', th: 'จ.', ru: 'Пн' },
  'days.tue': { en: 'Tue', th: 'อ.', ru: 'Вт' },
  'days.wed': { en: 'Wed', th: 'พ.', ru: 'Ср' },
  'days.thu': { en: 'Thu', th: 'พฤ.', ru: 'Чт' },
  'days.fri': { en: 'Fri', th: 'ศ.', ru: 'Пт' },
  'days.sat': { en: 'Sat', th: 'ส.', ru: 'Сб' },
  'days.sun': { en: 'Sun', th: 'อา.', ru: 'Вс' },
  'days.daily': { en: 'Every day', th: 'ทุกวัน', ru: 'Ежедневно' },
  'hours.cafe': {
    en: 'Cafe',
    th: 'หน้าร้าน',
    ru: 'Кафе',
  },
  'hours.delivery': {
    en: 'Delivery',
    th: 'เดลิเวอรี',
    ru: 'Доставка',
  },
  'hours.deliveryValue': {
    en: '24/7 through GrabFood',
    th: '24 ชม. ผ่าน GrabFood',
    ru: '24/7 через GrabFood',
  },
  'hours.deliveryLive': {
    en: '24/7 through GrabFood',
    th: '24 ชม. ผ่าน GrabFood',
    ru: '24/7 через GrabFood',
  },
} satisfies Record<string, Record<Locale, string>>;

export type UiKey = keyof typeof strings;

export function t(locale: Locale, key: UiKey): string {
  return strings[key][locale];
}
