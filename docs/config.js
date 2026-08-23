/* Контакты и реквизиты — попадают в бланк заказа и в сообщения менеджеру. */
const COMPANY = {
  name: 'ООО «Алмалы-Керамик»',
  tagline: 'Оптовые поставки керамогранита',
  phone: '+7 (000) 000-00-00',      // ← заменить на рабочий номер
  email: 'zakaz@almaly-keramik.ru', // ← заменить на рабочую почту
  whatsapp: '70000000000',          // ← WhatsApp менеджера, формат 7XXXXXXXXXX без плюса
  site: 'https://unus777.github.io/almaly-dealers/',
};

/* Пока телефон и почта не заменены на рабочие, кнопки связи и строка контактов скрываются:
   в бланке и на экране отправки не должно быть «+7 (000) 000-00-00». */
const HAS_CONTACTS = () => !/0{3}/.test(COMPANY.phone) && !COMPANY.email.startsWith('zakaz@almaly-keramik');

/* Репозиторий портала — в него редактор каталога сохраняет фотографии. */
const REPO = 'Unus777/almaly-dealers';

/* Приём заявок: веб-приложение Google Apps Script, заявки падают в Google-таблицу.
   Если адрес очистить, сайт вернётся в режим «заявка ссылкой в WhatsApp». */
const ORDERS_API = 'https://script.google.com/macros/s/AKfycbyyge4hKLR9K8nS1ajkHkkk2Ytahjzkv4scpKWTdy_ICEJxA8kbFVifXywbZWLJYw-3CQ/exec';

/* Доступ в панель продавца. Логины и пароли меняйте здесь.
   Это простая защита от посторонних глаз: страница статическая, и значения видно в исходном коде,
   поэтому не используйте пароли от почты, банка или Ozon. */
const ADMIN_USERS = [
  {login: 'admin', password: 'admin', name: 'Администратор'},
];
