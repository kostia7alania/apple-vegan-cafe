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
  'home.getDirections': { en: 'Get directions', th: 'นำทาง', ru: 'Как добраться' },
  'home.featured': { en: 'Popular dishes', th: 'เมนูแนะนำ', ru: 'Популярные блюда' },
  // {days} and {open} are replaced at render time from locations.json
  'home.openChip': {
    en: 'Open {days} from {open}',
    th: 'เปิด {days} ตั้งแต่ {open} น.',
    ru: 'Открыто {days} с {open}',
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
  'tag.vegan': { en: 'vegan', th: 'วีแกน', ru: 'веган' },
  'tag.jay': { en: 'jay', th: 'อาหารเจ', ru: 'джей' },
  'tag.jain-friendly': { en: 'jain-friendly', th: 'เหมาะกับแขกเชน', ru: 'джайн-френдли' },
  'tag.gluten-free': { en: 'gluten-free', th: 'ไร้กลูเตน', ru: 'без глютена' },
  'tag.raw': { en: 'raw', th: 'โรว์ฟู้ด', ru: 'raw' },
  'tag.nut-free': { en: 'nut-free', th: 'ไม่มีถั่ว', ru: 'без орехов' },
  'actions.quick': { en: 'Quick actions', th: 'เมนูลัด', ru: 'Быстрые действия' },
  'actions.call': { en: 'Call', th: 'โทร', ru: 'Звонок' },
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
    en: 'Late-night delivery: we often keep Grab orders on around the clock — the app shows our live status.',
    th: 'ส่งดึก: ใน Grab เรามักเปิดรับออเดอร์เกือบตลอดเวลา สถานะจริงดูในแอปได้เลยค่ะ',
    ru: 'Ночная доставка: заказы в Grab мы часто принимаем почти круглосуточно — актуальный статус виден в приложении.',
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
  'hours.delivery': {
    en: '🌙 Delivery (Grab)',
    th: '🌙 ส่งอาหาร (Grab)',
    ru: '🌙 Доставка (Grab)',
  },
  'hours.deliveryValue': {
    en: 'usually around the clock*',
    th: 'เกือบตลอดเวลา*',
    ru: 'почти круглосуточно*',
  },
} satisfies Record<string, Record<Locale, string>>;

export type UiKey = keyof typeof strings;

export function t(locale: Locale, key: UiKey): string {
  return strings[key][locale];
}
