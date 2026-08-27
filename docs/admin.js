/* Панель продавца: заявки из Google-таблицы (или из журнала браузера), статусы, печать, выгрузка. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = (v, d = 2) => Number(v).toLocaleString('ru-RU', {maximumFractionDigits: d});
const fmtDate = s => {
  if (!s) return '—';
  const m = String(s).match(/^'?(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : new Date(s).toLocaleDateString('ru-RU');
};
const fmtWhen = s => s ? new Date(s).toLocaleString('ru-RU', {day: '2-digit', month: '2-digit',
  hour: '2-digit', minute: '2-digit'}) : '—';
const STATUS = {new: 'Новая', work: 'В работе', done: 'Отгружена', cancel: 'Отменена'};
const totals = items => (items || []).reduce((a, i) => ({packs: a.packs + i.packs,
  sqm: a.sqm + i.packs * i.sqm, kg: a.kg + i.packs * (i.kg || 0)}), {packs: 0, sqm: 0, kg: 0});
const tel = s => String(s || '').replace(/[^+\d]/g, '');

const JOURNAL = 'almaly_admin_orders';
const LOCAL = !ORDERS_API;                 // без сервера — журнал живёт в браузере продавца
const SESSION = 'almaly_admin_session';
const FILTER = 'almaly_admin_filter';
let code = localStorage.getItem('almaly_admin_code') || '';
let user = null;
try { user = JSON.parse(localStorage.getItem(SESSION) || sessionStorage.getItem(SESSION) || 'null'); }
catch { user = null; }
let orders = [];

const readLocal = () => { try { return JSON.parse(localStorage.getItem(JOURNAL)) || []; } catch { return []; } };
const writeLocal = list => localStorage.setItem(JOURNAL, JSON.stringify(list));

const toast = (text, kind = '') => {
  const el = $('#toast');
  el.textContent = text; el.className = 'show ' + kind;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.className = '', 3600);
};
const gateError = text => {
  const box = $('#gate-error');
  box.hidden = !text;
  $('#gate-error-text').textContent = text || '';
};

/** Заявка приходит ссылкой из WhatsApp: admin.html#o=<данные> — принимаем её сразу. */
function takeFromLink() {
  const m = location.hash.match(/#o=(.+)$/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname);
  let o;
  try { o = JSON.parse(decodeURIComponent(escape(atob(m[1])))); }
  catch { toast('Ссылка на заявку повреждена — попросите отправить её ещё раз', 'err'); return null; }
  const list = readLocal();
  if (list.some(x => x.no === o.no)) { toast(`Заявка № ${o.no} уже в журнале`); return o.no; }
  list.unshift({...o, status: 'new', received: new Date().toISOString()});
  writeLocal(list);
  toast(`Новая заявка № ${o.no} — ${o.customer}`, 'ok');
  return o.no;
}

async function api(payload) {
  const r = await fetch(ORDERS_API, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'},
    body: JSON.stringify({...payload, code})});
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'ошибка сервера');
  return d;
}

/* ---------- отрисовка ---------- */
function kpis() {
  const by = s => orders.filter(o => o.status === s).length;
  const sqm = orders.filter(o => o.status !== 'cancel').reduce((a, o) => a + totals(o.items).sqm, 0);
  $('#kpis').innerHTML = `
    <div class="kpi accent"><b>${by('new')}</b><span>новых</span></div>
    <div class="kpi"><b>${by('work')}</b><span>в работе</span></div>
    <div class="kpi"><b>${by('done')}</b><span>отгружено</span></div>
    <div class="kpi"><b>${by('cancel')}</b><span>отменено</span></div>
    <div class="kpi"><b>${nf(sqm, 0)}</b><span>м² в заявках</span></div>`;
}

const orderHtml = o => {
  const t = totals(o.items);
  const phone = tel(o.phone);
  return `<article class="order st-${o.status}" data-no="${esc(o.no)}">
    <div class="o-hd">
      <div class="o-no">
        <b>№ ${esc(o.no)}</b>
        <span class="when">получена ${fmtWhen(o.received)}</span>
      </div>
      <div class="o-act">
        <span class="status s-${o.status}">${STATUS[o.status] || esc(o.status)}</span>
        <select data-act="status" aria-label="Статус заявки № ${esc(o.no)}">
          ${Object.entries(STATUS).map(([k, v]) =>
            `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <button class="btn sm" data-act="print" type="button">Лист</button>
        <button class="icon-btn danger" data-act="del" type="button"
          aria-label="Удалить заявку № ${esc(o.no)}" title="Удалить заявку">✕</button>
      </div>
    </div>

    <div class="o-body">
      <div class="o-cust">
        <b>${esc(o.customer)}</b>
        <div class="o-facts">
          ${o.inn ? `<div><span class="k">ИНН</span><span class="v">${esc(o.inn)}</span></div>` : ''}
          <div><span class="k">Контакт</span><span class="v">${esc(o.person) || '—'}</span></div>
          <div><span class="k">Телефон</span><span class="v">${esc(o.phone) || '—'}</span></div>
          ${o.email ? `<div><span class="k">Почта</span><span class="v">${esc(o.email)}</span></div>` : ''}
          ${o.city ? `<div><span class="k">Город</span><span class="v">${esc(o.city)}</span></div>` : ''}
          <div><span class="k">Доставка</span><span class="v">${esc(o.delivery)}${o.address ? ' — ' + esc(o.address) : ''}</span></div>
          <div><span class="k">Оплата</span><span class="v">${esc(o.payment)}</span></div>
          <div><span class="k">Отгрузка</span><span class="v">${fmtDate(o.ship)}</span></div>
        </div>
        <div class="o-contacts">
          ${phone ? `<a class="btn" href="tel:${phone}">Позвонить</a>
            <a class="btn" href="https://wa.me/${phone.replace(/\D/g, '')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${o.email ? `<a class="btn" href="mailto:${esc(o.email)}?subject=${encodeURIComponent('Заявка № ' + o.no)}">Почта</a>` : ''}
          <button class="btn" data-act="copy-no" type="button">Копировать №</button>
          <button class="btn" data-act="copy-items" type="button">Копировать состав</button>
        </div>
      </div>

      <div class="o-goods">
        <div class="h">Состав заявки</div>
        <div class="o-items">${(o.items || []).map(i => `<div class="o-item">
          <span class="nm"><b>${esc(i.name)}</b><span class="art">${i.art} · ${i.format} см</span></span>
          <span class="v">${i.packs} уп.</span>
          <span class="v">${nf(i.packs * i.sqm)} м²</span>
          <span class="wh">${esc(i.wh)}</span></div>`).join('')}</div>
        <div class="o-total"><span>Итого</span> ${t.packs} уп. · ${nf(t.sqm)} м²${t.kg ? ` · ${nf(t.kg, 0)} кг` : ''}</div>
        ${o.note ? `<div class="note o-note"><b>Комментарий:</b>&nbsp;${esc(o.note)}</div>` : ''}
      </div>
    </div>
  </article>`;
};

function draw() {
  const q = $('#q').value.trim().toLowerCase();
  const st = $('#st').querySelector('[aria-pressed=true]').dataset.v;
  try { localStorage.setItem(FILTER, JSON.stringify({q, st})); } catch {}
  const list = orders.filter(o => (!st || o.status === st) &&
    (!q || JSON.stringify(o).toLowerCase().includes(q)));
  $('#count').textContent = `${list.length} из ${orders.length}`;
  kpis();
  $('#orders').innerHTML = list.map(orderHtml).join('') || (orders.length
    ? `<div class="empty"><h3>Ничего не найдено</h3>
        <p>Измените поиск или выберите другой статус.</p>
        <button class="btn" type="button" id="reset-filter">Показать все заявки</button></div>`
    : `<div class="empty"><h3>Заявок пока нет</h3>
        <p>${LOCAL ? 'Откройте ссылку на заявку из WhatsApp или вставьте её в поле выше.'
                   : 'Новые заявки появятся здесь автоматически, как только дилер их отправит.'}</p></div>`);
}

/* ---------- печать ---------- */
function printOrder(o) {
  const t = totals(o.items);
  $('#sheet').innerHTML = `<div class="sheet">
    <div class="top">
      <div class="mark"><svg viewBox="0 0 104 104"><polygon points="52,4 73,25 25,73 4,52" fill="#d8202a"/>
        <polygon points="79,31 100,52 52,100 31,79" fill="#17191b"/></svg>
        <div><h1>Заявка на отгрузку</h1>
          <div class="company">${COMPANY.name} · ${COMPANY.tagline}
            ${HAS_CONTACTS() ? `<br>${COMPANY.phone} · ${COMPANY.email}` : ''}</div></div>
      </div>
      <div class="no">заявка<b>№ ${esc(o.no)}</b>от ${fmtWhen(o.received).split(',')[0]}</div>
    </div>
    <div class="pairs">
      <div class="pair"><span>Заказчик</span>${esc(o.customer)}</div>
      <div class="pair"><span>ИНН</span>${esc(o.inn) || '—'}</div>
      <div class="pair"><span>Контактное лицо</span>${esc(o.person)}</div>
      <div class="pair"><span>Телефон</span>${esc(o.phone)}</div>
      <div class="pair"><span>Почта</span>${esc(o.email) || '—'}</div>
      <div class="pair"><span>Город</span>${esc(o.city) || '—'}</div>
      <div class="pair"><span>Доставка</span>${esc(o.delivery)}</div>
      <div class="pair"><span>ТК / адрес</span>${esc(o.address) || '—'}</div>
      <div class="pair"><span>Оплата</span>${esc(o.payment)}</div>
      <div class="pair"><span>Отгрузка</span>${fmtDate(o.ship)}</div>
    </div>
    <table><thead><tr><th>№</th><th>Модель</th><th>Артикул</th><th>Формат</th>
      <th class="num">Упак.</th><th class="num">м²</th><th class="num">Вес, кг</th><th>Склад</th></tr></thead>
      <tbody>${(o.items || []).map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.name)}</td><td>${i.art}</td>
        <td>${i.format}</td><td class="num">${i.packs}</td><td class="num">${nf(i.packs * i.sqm)}</td>
        <td class="num">${i.kg ? nf(i.packs * i.kg, 0) : '—'}</td><td>${esc(i.wh)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">Итого</td><td class="num">${t.packs}</td><td class="num">${nf(t.sqm)}</td>
        <td class="num">${t.kg ? nf(t.kg, 0) : '—'}</td><td></td></tr></tfoot></table>
    ${o.note ? `<div class="company"><b>Комментарий:</b> ${esc(o.note)}</div>` : ''}
    <div class="signs"><div>Заказчик / подпись</div><div>Менеджер поставщика / подпись</div></div>
  </div>`;
  print();
}

const itemsText = o => [`Заявка № ${o.no} — ${o.customer}`,
  ...(o.items || []).map((i, n) => `${n + 1}. ${i.name} (${i.art}) ${i.format} — ${i.packs} уп. / ${nf(i.packs * i.sqm)} м², ${i.wh}`),
  `Итого: ${totals(o.items).packs} уп. / ${nf(totals(o.items).sqm)} м²`].join('\n');

async function copy(text, message) {
  try { await navigator.clipboard.writeText(text); toast(message, 'ok'); }
  catch { prompt('Скопируйте вручную:', text); }
}

function csv() {
  if (!orders.length) return toast('Выгружать нечего — заявок нет');
  const rows = [['№ заявки','Дата','Получена','Статус','Заказчик','ИНН','Контакт','Телефон','Почта','Город',
    'Доставка','Адрес/ТК','Оплата','Отгрузка','Модель','Артикул','Формат','Упаковок','м²','Склад','Комментарий']];
  orders.forEach(o => (o.items || []).forEach(i => rows.push([o.no, o.date, o.received, STATUS[o.status],
    o.customer, o.inn, o.person, o.phone, o.email, o.city, o.delivery, o.address, o.payment, o.ship,
    i.name, i.art, i.format, i.packs, (i.packs * i.sqm).toFixed(2), i.wh, o.note])));
  const text = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv'}));
  a.download = `Заявки дилеров ${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Файл CSV выгружен', 'ok');
}

/* ---------- загрузка ---------- */
const stamp = () => $('#upd').textContent = 'обновлено ' +
  new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});

async function refresh(quiet) {
  if (LOCAL) { orders = readLocal(); draw(); stamp(); if (!quiet) toast(`Заявок в журнале: ${orders.length}`); return; }
  const btn = $('#refresh');
  if (!quiet) { btn.disabled = true; btn.textContent = 'Обновляю…'; }
  try {
    const d = await api({action: 'list'});
    orders = d.orders || [];
    draw(); stamp();
    if (!quiet) toast(`Загружено заявок: ${orders.length}`, 'ok');
  } catch (e) {
    if (!quiet) toast(navigator.onLine ? 'Не удалось загрузить заявки: ' + e.message
                                       : 'Нет интернета — показан прошлый список', 'err');
    throw e;
  } finally { if (!quiet) { btn.disabled = false; btn.textContent = 'Обновить'; } }
}

/* ---------- вкладки и вход ---------- */
let panelReady = false;          // вход может сработать дважды — обработчики вешаем один раз

function initTabs() {
  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', x === b));
    $('#tab-orders').hidden = b.dataset.tab !== 'orders';
    $('#tab-editor').hidden = b.dataset.tab !== 'editor';
  }));
}

function showPanel() {
  $('#gate').hidden = true; $('#app').hidden = false;
  $('#who').textContent = user ? user.name : '';
  $('#clearjournal').hidden = !LOCAL;
  $('#paste-box').hidden = !LOCAL;
  const note = $('#mode-note');
  note.hidden = !LOCAL;
  if (LOCAL) note.querySelector('span').textContent =
    'Сервер приёма заявок не подключён: журнал хранится в этом браузере. ' +
    'Заявка попадает сюда, когда вы открываете ссылку из WhatsApp или вставляете её в поле ниже.';
  try {                                    // фильтр держится между обновлениями страницы
    const f = JSON.parse(localStorage.getItem(FILTER) || '{}');
    if (f.q) $('#q').value = f.q;
    if (f.st) $('#st').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.v === f.st));
  } catch {}
  if (!panelReady) {
    panelReady = true;
    initTabs();
    if (typeof initEditor === 'function') initEditor();
  }
}

async function enter() {
  if (LOCAL) { showPanel(); await refresh(true); return; }
  try {
    await refresh(true);
    localStorage.setItem('almaly_admin_code', code);
    showPanel();
    setInterval(() => refresh(true).catch(() => {}), 60000);   // тихое обновление раз в минуту
  } catch (e) {
    $('#gate').hidden = false; $('#app').hidden = true;
    gateError('Вход не выполнен: ' + e.message);
  }
}

$('#login-form').addEventListener('submit', e => {
  e.preventDefault();
  if (typeof ADMIN_USERS === 'undefined')
    return gateError('Страница загрузилась не полностью — обновите её (⌘⇧R или Ctrl+F5).');
  const login = $('#user').value.trim().toLowerCase(), pass = $('#pass').value;
  const found = ADMIN_USERS.find(u => u.login.toLowerCase() === login && u.password === pass);
  if (!found) {
    $('#pass').value = ''; $('#pass').classList.add('err'); $('#pass').focus();
    return gateError('Неверный логин или пароль. Проверьте раскладку и регистр.');
  }
  gateError('');
  user = {login: found.login, name: found.name};
  code = found.password;                      // для серверного режима код = пароль сотрудника
  ($('#remember').checked ? localStorage : sessionStorage).setItem(SESSION, JSON.stringify(user));
  enter();
});
$('#pass').addEventListener('input', e => { e.target.classList.remove('err'); gateError(''); });
$('#pw-eye').addEventListener('click', () => {
  const i = $('#pass'), show = i.type === 'password';
  i.type = show ? 'text' : 'password';
  $('#pw-eye').setAttribute('aria-pressed', show);
  $('#pw-eye').setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
});

/* меню с редкими и опасными действиями */
const menu = $('#menu'), menuBtn = $('#menu-btn');
const closeMenu = () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); };
menuBtn.addEventListener('click', e => {
  e.stopPropagation();
  menu.hidden = !menu.hidden;
  menuBtn.setAttribute('aria-expanded', String(!menu.hidden));
});
document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

$('#logout').addEventListener('click', () => {
  localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION);
  localStorage.removeItem('almaly_admin_code');
  location.reload();
});
$('#clearjournal').addEventListener('click', () => {
  closeMenu();
  if (!confirm('Удалить ВСЕ заявки из журнала этого браузера? Действие необратимо.')) return;
  if (!confirm('Точно удалить? Восстановить журнал будет нельзя.')) return;
  localStorage.removeItem(JOURNAL); orders = []; draw(); toast('Журнал очищен');
});
$('#csv').addEventListener('click', () => { closeMenu(); csv(); });

/* Заявку можно не открывать по ссылке, а вставить её сюда. */
$('#paste-btn').addEventListener('click', () => {
  const v = $('#paste').value.trim();
  const m = v.match(/#o=([A-Za-z0-9+/=]+)/);
  if (!m) return toast('Вставьте ссылку целиком — в ней должна быть часть #o=…', 'err');
  location.hash = '#o=' + m[1];
  const no = takeFromLink();
  $('#paste').value = '';
  orders = readLocal(); draw();
  if (no) scrollTo({top: 0, behavior: 'smooth'});
});
$('#refresh').addEventListener('click', () => refresh().catch(() => {}));
$('#q').addEventListener('input', draw);
$('#st').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $('#st').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
  draw();
});

$('#orders').addEventListener('click', async e => {
  if (e.target.id === 'reset-filter') {
    $('#q').value = '';
    $('#st').querySelectorAll('.chip').forEach((c, i) => c.setAttribute('aria-pressed', i === 0));
    return draw();
  }
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const card = b.closest('.order'), no = card.dataset.no;
  const o = orders.find(x => x.no === no);
  if (b.dataset.act === 'print') return printOrder(o);
  if (b.dataset.act === 'copy-no') return copy(no, `Номер заявки № ${no} скопирован`);
  if (b.dataset.act === 'copy-items') return copy(itemsText(o), 'Состав заявки скопирован');
  if (b.dataset.act === 'del') {
    if (!confirm(`Удалить заявку № ${no} (${o.customer})? Восстановить её будет нельзя.`)) return;
    card.classList.add('busy');
    try {
      if (LOCAL) { orders = orders.filter(x => x.no !== no); writeLocal(orders); draw(); }
      else { await api({action: 'delete', no}); await refresh(true); }
      toast(`Заявка № ${no} удалена`);
    } catch (err) { toast('Не удалось удалить: ' + err.message + '. Попробуйте ещё раз.', 'err'); }
    finally { card.classList.remove('busy'); }
  }
});

$('#orders').addEventListener('change', async e => {
  const sel = e.target.closest('[data-act=status]'); if (!sel) return;
  const card = sel.closest('.order'), no = card.dataset.no, value = sel.value;
  card.classList.add('busy');
  try {
    if (LOCAL) { orders.find(o => o.no === no).status = value; writeLocal(orders); draw(); }
    else { await api({action: 'status', no, status: value}); await refresh(true); }
    toast(`Заявка № ${no}: ${STATUS[value]}`, 'ok');
  } catch (err) {
    toast('Статус не изменился: ' + err.message, 'err');
    await refresh(true).catch(() => {});
  } finally { card.classList.remove('busy'); }
});

addEventListener('offline', () => toast('Соединение пропало — данные могут устареть', 'err'));

const incomingNo = LOCAL ? takeFromLink() : null;   // ссылка сохраняется в журнал сразу
if (user) enter();
else if (incomingNo) toast(`Заявка № ${incomingNo} сохранена — войдите, чтобы открыть её`);
