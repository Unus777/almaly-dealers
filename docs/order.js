/* Оформление заявки: позиции в м², данные дилера, отправка и упаковочный лист. */
const F = ['customer','inn','person','phone','email','city','delivery','address','payment','ship','note'];
const formData = () => Object.fromEntries(F.map(k => [k, ($('#f-' + k)?.value || '').trim()]));
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('ru-RU') : '—';
/** Местная дата в виде ГГГГ-ММ-ДД: toISOString даёт UTC и под утро «отматывает» сутки. */
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const newNo = () => 'АК-' + today().slice(2).replace(/-/g, '') + '-' +
  Math.random().toString(36).slice(2, 5).toUpperCase();
function orderNo() {
  let n = localStorage.getItem('almaly_order_no');
  if (!n) { n = newNo(); localStorage.setItem('almaly_order_no', n); }
  return n;
}

/* ---------- позиции ---------- */
function renderItems() {
  const cart = getCart(), box = $('#items');
  if (!cart.length) {
    box.innerHTML = `<div class="empty"><p>В заявке пока нет позиций.</p>
      <a class="btn primary" href="index.html">Выбрать плитку в каталоге</a></div>`;
    $('#summary').innerHTML = ''; renderSheet(); return;
  }
  const t = totals(cart);
  box.innerHTML = `<table class="items">
    <thead><tr><th></th><th>Модель</th><th>Формат</th><th>Нужно, м²</th><th>Упаковок</th>
      <th>К отгрузке, м²</th><th>Склад</th><th></th></tr></thead>
    <tbody>${cart.map((i, n) => `<tr>
      <td data-l="">${i.photo ? `<img class="thumb" src="${i.photo}" alt="">` : '<span class="thumb noimg"></span>'}</td>
      <td data-l="Модель"><b>${esc(i.name)}</b><div class="art">${i.art}</div></td>
      <td data-l="Формат">${i.format}</td>
      <td data-l="Нужно, м²"><input class="qty" type="number" min="0.1" step="0.1" value="${i.need}"
        data-n="${n}" data-k="need" inputmode="decimal"></td>
      <td data-l="Упаковок"><b>${i.packs}</b></td>
      <td data-l="К отгрузке">${nf(i.packs * i.sqm)} м²</td>
      <td data-l="Склад"><select data-n="${n}" data-k="wh">
        ${['Москва','Тверь','Под заказ'].map(w => `<option ${w === i.wh ? 'selected' : ''}>${w}</option>`).join('')}
      </select></td>
      <td data-l=""><button class="rm" data-rm="${n}" title="Убрать позицию">✕</button></td></tr>`).join('')}
    </tbody></table>`;
  $('#summary').innerHTML = `<div class="summary">
    <div><b>${cart.length}</b><span>позиций</span></div>
    <div><b>${t.packs}</b><span>упаковок</span></div>
    <div><b>${nf(t.sqm)}</b><span>м² к отгрузке</span></div>
    ${t.kg ? `<div><b>${nf(t.kg, 0)}</b><span>кг ориентировочно</span></div>` : ''}
  </div>`;
  renderSheet();
}

/* ---------- упаковочный лист ---------- */
function sheetHtml(o) {
  const t = totals(o.items || []);
  return `<div class="sheet">
    <div class="top">
      <div class="mark">
        <svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="14" fill="#111"/>
          <path d="M50 20 66 50 50 80 34 50z" fill="#c9a227"/></svg>
        <div><h1>Заявка на отгрузку</h1>
          <div class="company">${COMPANY.name} · ${COMPANY.tagline}
            ${HAS_CONTACTS() ? `<br>${COMPANY.phone} · ${COMPANY.email}` : ''}</div>
        </div>
      </div>
      <div class="no">заявка<b>№ ${esc(o.no)}</b>от ${fmtDate(o.date)}</div>
    </div>
    <div class="pairs">
      <div class="pair"><span>Заказчик</span>${esc(o.customer) || '—'}</div>
      <div class="pair"><span>ИНН</span>${esc(o.inn) || '—'}</div>
      <div class="pair"><span>Контактное лицо</span>${esc(o.person) || '—'}</div>
      <div class="pair"><span>Телефон</span>${esc(o.phone) || '—'}</div>
      <div class="pair"><span>Почта</span>${esc(o.email) || '—'}</div>
      <div class="pair"><span>Город / адрес</span>${esc(o.city) || '—'}</div>
      <div class="pair"><span>Способ доставки</span>${esc(o.delivery)}</div>
      <div class="pair"><span>ТК / адрес доставки</span>${esc(o.address) || '—'}</div>
      <div class="pair"><span>Способ оплаты</span>${esc(o.payment)}</div>
      <div class="pair"><span>Желаемая отгрузка</span>${fmtDate(o.ship)}</div>
    </div>
    <table>
      <thead><tr><th>№</th><th>Модель</th><th>Артикул</th><th>Формат</th><th>Поверхность</th>
        <th class="num">Упак.</th><th class="num">м²</th><th class="num">Вес, кг</th><th>Склад</th></tr></thead>
      <tbody>${(o.items || []).map((i, n) => `<tr>
        <td>${n + 1}</td><td>${esc(i.name)}</td><td>${i.art}</td><td>${i.format}</td><td>${esc(i.surface)}</td>
        <td class="num">${i.packs}</td><td class="num">${nf(i.packs * i.sqm)}</td>
        <td class="num">${i.kg ? nf(i.packs * i.kg, 0) : '—'}</td><td>${esc(i.wh)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">Итого</td><td class="num">${t.packs}</td><td class="num">${nf(t.sqm)}</td>
        <td class="num">${t.kg ? nf(t.kg, 0) : '—'}</td><td></td></tr></tfoot>
    </table>
    ${o.note ? `<div class="company"><b>Комментарий:</b> ${esc(o.note)}</div>` : ''}
    <div class="signs"><div>Заказчик / подпись</div><div>Менеджер поставщика / подпись</div></div>
    <div class="foot">Количество округлено до целых упаковок. Цены и сроки подтверждает менеджер
      после проверки остатков. Документ сформирован на ${COMPANY.site}</div>
  </div>`;
}

const currentOrder = () => ({no: orderNo(), ...formData(), items: getCart(),
  date: $('#f-date')?.value || today()});

const renderSheet = () => $('#sheet').innerHTML = getCart().length ? sheetHtml(currentOrder()) : '';

const orderText = o => {
  const t = totals(o.items);
  return [`Заявка № ${o.no} от ${fmtDate(o.date)}`,
    `Заказчик: ${o.customer}${o.person ? ', ' + o.person : ''}${o.phone ? ', ' + o.phone : ''}`,
    o.city && `Город: ${o.city}`, '',
    ...o.items.map((i, n) => `${n + 1}. ${i.name} (${i.art}) ${i.format} — ${i.packs} уп. / ${nf(i.packs * i.sqm)} м², ${i.wh}`),
    '', `Итого: ${t.packs} уп. / ${nf(t.sqm)} м²${t.kg ? ' / ' + nf(t.kg, 0) + ' кг' : ''}`,
    `Доставка: ${o.delivery}${o.address ? ' — ' + o.address : ''}`, `Оплата: ${o.payment}`,
    o.ship && `Отгрузка: ${fmtDate(o.ship)}`, o.note && `Комментарий: ${o.note}`,
  ].filter(Boolean).join('\n');
};

/* ---------- отправка ---------- */
function validate() {
  let ok = getCart().length > 0;
  if (!ok) toast('Заявка пуста — выберите плитку в каталоге');
  for (const k of ['customer', 'person', 'phone']) {
    const el = $('#f-' + k), empty = !el.value.trim();
    el.classList.toggle('err', empty);
    if (empty) ok = false;
  }
  if (ok) return true;
  const bad = $('.err'); if (bad) { bad.scrollIntoView({behavior: 'smooth', block: 'center'}); bad.focus(); }
  toast('Заполните заказчика, контактное лицо и телефон');
  return false;
}

/** Ссылка на заявку для панели продавца: все данные внутри адреса, сервер не нужен. */
const adminLink = o => location.origin + location.pathname.replace(/order\.html$/, 'admin.html') +
  '#o=' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));

async function submitOrder() {
  if (!validate()) return;
  const o = currentOrder();
  const btn = $('#send');
  if (!ORDERS_API) {          // приём заявок ещё не подключён — отдаём заявку ссылкой
    return done(o, 'Заявка сформирована. Отправьте её менеджеру кнопкой ниже.', adminLink(o));
  }
  btn.disabled = true; btn.textContent = 'Отправляю…';
  try {
    // даты отправляем с апострофом: иначе таблица считает их своими датами и сдвигает
    const payload = {...o, date: "'" + o.date, ship: o.ship ? "'" + o.ship : ''};
    const r = await fetch(ORDERS_API, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({action: 'create', order: payload})});
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'сервер отклонил заявку');
    done({...o, no: d.no || o.no}, 'Заявка принята. Менеджер свяжется с вами.');
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Отправить заявку';
    toast('Не удалось отправить: ' + e.message + '. Можно отправить в WhatsApp.');
  }
}

/** Экран «заявка отправлена»: номер, печать листа, новая заявка. */
function done(o, message, link) {
  localStorage.setItem('almaly_last_order', JSON.stringify(o));
  localStorage.removeItem(CART); localStorage.removeItem('almaly_order_no');
  updateCount();
  $('#flow').innerHTML = `
    <div class="done">
      <div class="done-mark">✓</div>
      <h2>Заявка № ${esc(o.no)} отправлена</h2>
      <p>${esc(message)} Сохраните упаковочный лист — он пригодится при отгрузке.</p>
      <div class="actions" style="justify-content:center">
        ${link && HAS_CONTACTS() ? '<button class="btn primary" id="send-wa">Отправить менеджеру в WhatsApp</button>' : ''}
        <button class="btn" onclick="print()">Скачать PDF · упаковочный лист</button>
        ${link ? '<button class="btn" id="copy-link">Скопировать ссылку</button>' : ''}
        <a class="btn" href="index.html">Новая заявка</a>
      </div>
    </div>`;
  $('#sheet').innerHTML = sheetHtml(o);
  $('#send-wa')?.addEventListener('click', () =>
    open(`https://wa.me/${COMPANY.whatsapp}?text=` +
      encodeURIComponent(orderText(o) + '\n\nЗаявка для панели продавца:\n' + link), '_blank'));
  $('#copy-link')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(link);
    toast('Ссылка скопирована — отправьте её менеджеру');
  });
  scrollTo({top: 0, behavior: 'smooth'});
}

/* ---------- страница ---------- */
function renderOrder() {
  updateCount();
  $('#f-date').value = today();
  F.forEach(k => {
    const el = $('#f-' + k); if (!el) return;
    const saved = localStorage.getItem('almaly_f_' + k);
    if (saved && !el.value) el.value = saved;
    el.addEventListener('input', e => {
      localStorage.setItem('almaly_f_' + k, e.target.value);
      e.target.classList.remove('err'); renderSheet();
    });
  });
  renderItems();

  $('#items').addEventListener('input', e => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const cart = getCart(), i = cart[+el.dataset.n];
    if (el.dataset.k === 'need') {
      i.need = Math.max(0.1, +String(el.value).replace(',', '.') || 0.1);
      i.packs = packsFor(i.need, i.sqm);
    } else i.wh = el.value;
    setCart(cart); renderItems();
  });
  $('#items').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const cart = getCart(); cart.splice(+b.dataset.rm, 1); setCart(cart); renderItems();
  });

  $('#send').addEventListener('click', submitOrder);
  $('#pdf').addEventListener('click', () => validate() && print());
  $('#wa')?.addEventListener('click', () => validate() &&
    open(`https://wa.me/${COMPANY.whatsapp}?text=` + encodeURIComponent(orderText(currentOrder())), '_blank'));
  $('#clear').addEventListener('click', () => {
    if (!confirm('Очистить заявку?')) return;
    localStorage.removeItem(CART); localStorage.removeItem('almaly_order_no');
    renderItems(); updateCount(); toast('Заявка очищена');
  });
  $('#send').textContent = 'Отправить заявку';
}
