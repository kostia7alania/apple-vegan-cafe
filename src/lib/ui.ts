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
  'home.viewMenu': { en: 'View the menu', th: 'ดูเมนู', ru: 'Смотреть меню' },
  'home.getDirections': { en: 'Get directions', th: 'นำทาง', ru: 'Как добраться' },
  'home.featured': { en: 'Popular dishes', th: 'เมนูแนะนำ', ru: 'Популярные блюда' },
  'menu.title': { en: 'Our menu', th: 'เมนูของเรา', ru: 'Наше меню' },
  'menu.spicy': { en: 'spicy', th: 'เผ็ด', ru: 'острое' },
  'contact.hours': { en: 'Opening hours', th: 'เวลาเปิด-ปิด', ru: 'Часы работы' },
  'contact.address': { en: 'Address', th: 'ที่อยู่', ru: 'Адрес' },
  'contact.phone': { en: 'Phone', th: 'โทร', ru: 'Телефон' },
  'contact.closed': { en: 'Closed', th: 'ปิด', ru: 'Закрыто' },
  'contact.findUs': { en: 'Find us on the map', th: 'ดูแผนที่', ru: 'Мы на карте' },
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
} satisfies Record<string, Record<Locale, string>>;

export type UiKey = keyof typeof strings;

export function t(locale: Locale, key: UiKey): string {
  return strings[key][locale];
}
