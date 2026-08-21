/* Панель продавца: заявки из Google-таблицы, статусы, печать, выгрузка. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = (v, d = 2) => Number(v).toLocaleString('ru-RU', {maximumFractionDigits: d});
const fmtDate = s => s ? new Date(s).toLocaleDateString('ru-RU') : '—';
const fmtWhen = s => s ? new Date(s).toLocaleString('ru-RU', {day: '2-digit', month: '2-digit',
  hour: '2-digit', minute: '2-digit'}) : '—';
const STATUS = {new: 'Новая', work: 'В работе', done: 'Отгружена', cancel: 'Отменена'};
const totals = items => (items || []).reduce((a, i) => ({packs: a.packs + i.packs,
  sqm: a.sqm + i.packs * i.sqm, kg: a.kg + i.packs * (i.kg || 0)}), {packs: 0, sqm: 0, kg: 0});

const JOURNAL = 'almaly_admin_orders';
const LOCAL = !ORDERS_API;                 // без сервера — журнал живёт в браузере продавца
const SESSION = 'almaly_admin_session';
let code = localStorage.getItem('almaly_admin_code') || '';
let user = null;
try { user = JSON.parse(localStorage.getItem(SESSION) || sessionStorage.getItem(SESSION) || 'null'); }
catch { user = null; }
let orders = [];

const readLocal = () => { try { return JSON.parse(localStorage.getItem(JOURNAL)) || []; } catch { return []; } };
const writeLocal = list => localStorage.setItem(JOURNAL, JSON.stringify(list));

/** Заявка приходит ссылкой из WhatsApp: admin.html#o=<данные> — принимаем её сразу. */
function takeFromLink() {
  const m = location.hash.match(/#o=(.+)$/);
  if (!m) return null;
  history.replaceState(null, '', location.pathname);
  let o;
  try { o = JSON.parse(decodeURIComponent(escape(atob(m[1])))); }
  catch { toast('Ссылка на заявку повреждена'); return null; }
  const list = readLocal();
  if (list.some(x => x.no === o.no)) { toast(`Заявка № ${o.no} уже в журнале`); return o.no; }
  list.unshift({...o, status: 'new', received: new Date().toISOString()});
  writeLocal(list);
  toast(`Новая заявка № ${o.no} — ${o.customer}`);
  return o.no;
}

const toast = t => { const el = $('#toast'); el.textContent = t; el.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', 3500); };

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
    <div class="kpi accent"><b>${by('new')}</b><span>новых заявок</span></div>
    <div class="kpi"><b>${by('work')}</b><span>в работе</span></div>
    <div class="kpi"><b>${by('done')}</b><span>отгружено</span></div>
    <div class="kpi"><b>${nf(sqm, 0)}</b><span>м² в заявках</span></div>`;
}

function draw() {
  const q = $('#q').value.trim().toLowerCase();
  const st = $('#st').querySelector('[aria-pressed=true]').dataset.v;
  const list = orders.filter(o => (!st || o.status === st) &&
    (!q || JSON.stringify(o).toLowerCase().includes(q)));
  $('#count').textContent = `${list.length} из ${orders.length}`;
  kpis();
  $('#orders').innerHTML = list.map(o => {
    const t = totals(o.items);
    return `<article class="order ${o.status === 'new' ? 'is-new' : ''}" data-no="${esc(o.no)}">
      <div class="o-hd">
        <div>
          <b>№ ${esc(o.no)}</b>
          <span class="when">от ${fmtDate(o.date)} · получена ${fmtWhen(o.received)}</span>
        </div>
        <div class="o-act">
          <span class="status s-${o.status}">${STATUS[o.status] || o.status}</span>
          ${LOCAL ? '' : ''}
          <select data-act="status">${Object.entries(STATUS).map(([k, v]) =>
            `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <button class="btn" data-act="print">Лист</button>
          <button class="btn ghost" data-act="del" title="Убрать из журнала">✕</button>
        </div>
      </div>

      <div class="o-who">
        <div class="who-main">
          <b>${esc(o.customer)}</b>${o.inn ? `<span class="art">ИНН ${esc(o.inn)}</span>` : ''}
          <div>${esc(o.person)}</div>
        </div>
        <div class="who-contacts">
          <a class="btn" href="tel:${esc(o.phone).replace(/[^+\d]/g, '')}">${esc(o.phone)}</a>
          <a class="btn" href="https://wa.me/${esc(o.phone).replace(/\D/g, '')}" target="_blank">WhatsApp</a>
          ${o.email ? `<a class="btn" href="mailto:${esc(o.email)}">Почта</a>` : ''}
        </div>
      </div>

      <div class="o-terms">
        ${o.city ? `<span>${esc(o.city)}</span>` : ''}
        <span>${esc(o.delivery)}${o.address ? ' — ' + esc(o.address) : ''}</span>
        <span>${esc(o.payment)}</span>
        ${o.ship ? `<span>отгрузка ${fmtDate(o.ship)}</span>` : ''}
      </div>

      <table class="o-items">${(o.items || []).map(i => `<tr>
        <td><b>${esc(i.name)}</b> <span class="art">${i.art}</span></td>
        <td>${i.format}</td><td>${i.packs} уп.</td><td>${nf(i.packs * i.sqm)} м²</td>
        <td>${esc(i.wh)}</td></tr>`).join('')}
        <tr class="sum"><td>Итого</td><td></td><td>${t.packs} уп.</td><td>${nf(t.sqm)} м²</td>
          <td>${t.kg ? nf(t.kg, 0) + ' кг' : ''}</td></tr></table>
      ${o.note ? `<p class="o-note">Комментарий: ${esc(o.note)}</p>` : ''}
    </article>`;
  }).join('') || '<p class="empty">Заявок нет.</p>';
}

/* ---------- печать ---------- */
function printOrder(o) {
  const t = totals(o.items);
  $('#sheet').innerHTML = `<div class="sheet">
    <div class="top">
      <div class="mark"><svg viewBox="0 0 100 100"><rect width="100" height="100" rx="14" fill="#111"/>
        <path d="M50 20 66 50 50 80 34 50z" fill="#c9a227"/></svg>
        <div><h1>Заявка на отгрузку</h1>
          <div class="company">${COMPANY.name} · ${COMPANY.tagline}<br>${COMPANY.phone} · ${COMPANY.email}</div></div>
      </div>
      <div class="no">заявка<b>№ ${esc(o.no)}</b>от ${fmtDate(o.date)}</div>
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

function csv() {
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
}

/* ---------- загрузка ---------- */
async function refresh(quiet) {
  if (LOCAL) { orders = readLocal(); draw(); if (!quiet) toast(`Заявок в журнале: ${orders.length}`); return; }
  try {
    const d = await api({action: 'list'});
    orders = d.orders || [];
    draw();
    if (!quiet) toast(`Загружено заявок: ${orders.length}`);
  } catch (e) {
    if (!quiet) toast('Ошибка: ' + e.message);
    throw e;
  }
}

function showPanel() {
  $('#gate').hidden = true; $('#app').hidden = false;
  ['who', 'refresh', 'logout'].forEach(id => $('#' + id).hidden = false);
  $('#who').textContent = user ? user.name : '';
  $('#clearjournal').hidden = !LOCAL;
  $('#paste-box').hidden = !LOCAL;
  $('#mode-note').innerHTML = LOCAL
    ? 'Заявки попадают в журнал, когда вы открываете ссылку из WhatsApp или вставляете её сюда. ' +
      'Журнал хранится в этом браузере.'
    : 'Заявки приходят автоматически с сервера.';
}

async function enter() {
  if (LOCAL) {                       // журнал в браузере
    showPanel();
    await refresh(true);
    return;
  }
  try {
    await refresh(true);
    localStorage.setItem('almaly_admin_code', code);
    showPanel();
    setInterval(() => refresh(true).catch(() => {}), 60000);   // тихое обновление раз в минуту
  } catch (e) {
    $('#gate').hidden = false; $('#app').hidden = true;
    toast('Вход не выполнен: ' + e.message);
  }
}

$('#login-form').addEventListener('submit', e => {
  e.preventDefault();
  if (typeof ADMIN_USERS === 'undefined')
    return toast('Страница загрузилась не полностью — обновите её (⌘⇧R)');
  const login = $('#user').value.trim().toLowerCase(), pass = $('#pass').value;
  const found = ADMIN_USERS.find(u => u.login.toLowerCase() === login && u.password === pass);
  if (!found) { $('#pass').value = ''; $('#pass').classList.add('err'); return toast('Неверный логин или пароль'); }
  user = {login: found.login, name: found.name};
  code = found.password;                      // для серверного режима код = пароль сотрудника
  ($('#remember').checked ? localStorage : sessionStorage).setItem(SESSION, JSON.stringify(user));
  enter();
});
$('#pass').addEventListener('input', e => e.target.classList.remove('err'));
$('#logout').addEventListener('click', () => {
  localStorage.removeItem(SESSION); sessionStorage.removeItem(SESSION);
  localStorage.removeItem('almaly_admin_code');
  location.reload();
});
$('#clearjournal').addEventListener('click', () => {
  if (!confirm('Удалить все заявки из журнала этого браузера?')) return;
  localStorage.removeItem(JOURNAL); orders = []; draw(); toast('Журнал очищен');
});

/* Заявку можно не открывать по ссылке, а вставить её сюда. */
$('#paste-btn').addEventListener('click', () => {
  const v = $('#paste').value.trim();
  const m = v.match(/#o=([A-Za-z0-9+/=]+)/);
  if (!m) return toast('Вставьте ссылку целиком — она содержит #o=…');
  location.hash = '#o=' + m[1];
  const no = takeFromLink();
  $('#paste').value = '';
  orders = readLocal(); draw();
  if (no) scrollTo({top: 0, behavior: 'smooth'});
});
$('#refresh').addEventListener('click', () => refresh());
$('#q').addEventListener('input', draw);
$('#st').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $('#st').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
  draw();
});
$('#csv').addEventListener('click', csv);
$('#orders').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const no = b.closest('.order').dataset.no;
  if (b.dataset.act === 'print') return printOrder(orders.find(o => o.no === no));
  if (b.dataset.act === 'del') {
    if (!confirm(`Убрать заявку № ${no} из журнала?`)) return;
    orders = orders.filter(o => o.no !== no);
    if (LOCAL) writeLocal(orders);
    draw();
  }
});
$('#orders').addEventListener('change', async e => {
  const sel = e.target.closest('[data-act=status]'); if (!sel) return;
  const no = sel.closest('.order').dataset.no;
  try {
    if (!LOCAL) await api({action: 'status', no, status: sel.value});
    orders.find(o => o.no === no).status = sel.value;
    if (LOCAL) writeLocal(orders);
    draw(); toast(`Заявка № ${no}: ${STATUS[sel.value]}`);
  } catch (err) { toast('Не удалось изменить статус: ' + err.message); }
});

const incomingNo = LOCAL ? takeFromLink() : null;   // ссылка сохраняется в журнал сразу
if (user) enter();
else if (incomingNo) toast(`Заявка № ${incomingNo} сохранена — войдите, чтобы открыть её`);
