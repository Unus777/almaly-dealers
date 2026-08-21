/* Контакты и реквизиты — попадают в бланк заказа и в сообщения менеджеру. */
const COMPANY = {
  name: 'ООО «Алмалы-Керамик»',
  tagline: 'Оптовые поставки керамогранита',
  phone: '+7 (000) 000-00-00',      // ← заменить на рабочий номер
  email: 'zakaz@almaly-keramik.ru', // ← заменить на рабочую почту
  whatsapp: '70000000000',          // ← WhatsApp менеджера, формат 7XXXXXXXXXX без плюса
  site: 'https://unus777.github.io/almaly-dealers/',
};

/* Каталог берём из витрины с QR-кодами — один источник фото и остатков. */
const CATALOG = 'https://unus777.github.io/almaly-tiles/';

/* Приём заявок: адрес веб-приложения Google Apps Script (см. apps-script/README.md).
   Пока пусто — сайт работает без сервера: PDF, WhatsApp и почта. */
const ORDERS_API = '';
