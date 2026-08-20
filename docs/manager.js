const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = (v, d = 2) => Number(v).toLocaleString('ru-RU', {maximumFractionDigits: d});
const KEY = 'almaly_manager_orders';
const STATUS = {new: 'Новая', work: 'В работе', done: 'Отгружена', cancel: 'Отменена'};

const all = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const save = list => localStorage.setItem(KEY, JSON.stringify(list));
const toast = t => { const el = $('#toast'); el.textContent = t; el.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', 3000); };
const totals = items => items.reduce((a, i) => ({packs: a.packs + i.packs, sqm: a.sqm + i.packs * i.sqm,
  kg: a.kg + i.packs * (i.kg || 0)}), {packs: 0, sqm: 0, kg: 0});
const fmtDate = s => s ? new Date(s).toLocaleDateString('ru-RU') : '—';

/* ---------- входящая заявка из ссылки ---------- */
function incoming() {
  const hash = location.hash.slice(1);
  if (!hash) return null;
  try { return JSON.parse(decodeURIComponent(escape(atob(hash)))); }
  catch { toast('Ссылка на заявку повреждена'); return null; }
}

function drawIncoming() {
  const o = incoming(), box = $('#incoming');
  if (!o) { box.innerHTML = ''; return; }
  const known = all().some(x => x.no === o.no);
  const t = totals(o.items || []);
  box.innerHTML = `<div class="incoming">
    <div class="order hd" style="background:none;border:0;padding:0;display:flex;gap:14px;flex-wrap:wrap;align-items:baseline">
      <b style="font-size:19px">Заявка № ${esc(o.no)}</b>
      <span class="when">${esc(o.customer)} · ${esc(o.phone)} · ${nf(t.sqm)} м²</span>
      <span class="right" style="margin-left:auto;display:flex;gap:8px">
        <button class="btn primary" id="accept" ${known ? 'disabled' : ''}>
          ${known ? 'Уже в журнале' : 'Принять в журнал'}</button>
        <button class="btn" id="dismiss">Скрыть</button>
      </span>
    </div></div>`;
  $('#accept')?.addEventListener('click', () => {
    const list = all();
    list.unshift({...o, status: 'new', received: new Date().toISOString()});
    save(list); location.hash = ''; drawIncoming(); draw(); toast('Заявка добавлена в журнал');
  });
  $('#dismiss').addEventListener('click', () => { location.hash = ''; drawIncoming(); });
}

/* ---------- журнал ---------- */
function draw() {
  const q = $('#q').value.trim().toLowerCase();
  const st = $('#st').querySelector('[aria-pressed=true]').dataset.v;
  const list = all().filter(o => (!st || o.status === st) &&
    (!q || JSON.stringify(o).toLowerCase().includes(q)));
  $('#count').textContent = `${list.length} из ${all().length}`;
  $('#orders').innerHTML = list.map(o => {
    const t = totals(o.items || []);
    return `<article class="order ${o.status === 'new' ? 'new' : ''}" data-no="${esc(o.no)}">
      <div class="hd">
        <b>№ ${esc(o.no)}</b>
        <span class="when">от ${fmtDate(o.date)} · получена ${fmtDate(o.received)}</span>
        <span class="right">
          <span class="status s-${o.status}">${STATUS[o.status]}</span>
          <select data-act="status">${Object.entries(STATUS).map(([k, v]) =>
            `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <button class="btn" data-act="print">Бланк</button>
          <button class="btn" data-act="del">Удалить</button>
        </span>
      </div>
      <div class="who">
        <span><b>${esc(o.customer)}</b></span>
        <span>${esc(o.person)} · ${esc(o.phone)}</span>
        ${o.city ? `<span>${esc(o.city)}</span>` : ''}
        <span>${esc(o.delivery)}${o.address ? ' — ' + esc(o.address) : ''}</span>
        <span>${esc(o.payment)}</span>
        ${o.ship ? `<span>отгрузка ${fmtDate(o.ship)}</span>` : ''}
      </div>
      <div class="lines"><table>${(o.items || []).map(i => `<tr>
        <td>${esc(i.name)} <span class="art">${i.art}</span></td>
        <td>${i.format}</td><td>${i.packs} уп.</td><td>${nf(i.packs * i.sqm)} м²</td>
        <td>${esc(i.wh)}</td></tr>`).join('')}
        <tr><td colspan="2"><b>Итого</b></td><td><b>${t.packs} уп.</b></td>
        <td><b>${nf(t.sqm)} м²</b></td><td>${t.kg ? nf(t.kg, 0) + ' кг' : ''}</td></tr></table>
        ${o.note ? `<p class="note">Комментарий: ${esc(o.note)}</p>` : ''}</div>
    </article>`;
  }).join('') || '<p class="empty">Заявок пока нет.</p>';
}

/* ---------- печатный бланк ---------- */
function printOrder(o) {
  const t = totals(o.items || []);
  $('#sheet').innerHTML = `<div class="sheet">
    <div class="top">
      <div><h1>Бланк заказа</h1>
        <div class="company">${COMPANY.name} · ${COMPANY.tagline}<br>${COMPANY.phone} · ${COMPANY.email}</div></div>
      <div class="no">заказ<b>№ ${esc(o.no)}</b>от ${fmtDate(o.date)}</div>
    </div>
    <div class="pairs">
      <div class="pair"><span>Заказчик</span>${esc(o.customer)}</div>
      <div class="pair"><span>Контактное лицо</span>${esc(o.person)}</div>
      <div class="pair"><span>Телефон</span>${esc(o.phone)}</div>
      <div class="pair"><span>Город / адрес</span>${esc(o.city) || '—'}</div>
      <div class="pair"><span>Способ доставки</span>${esc(o.delivery)}</div>
      <div class="pair"><span>ТК / адрес доставки</span>${esc(o.address) || '—'}</div>
      <div class="pair"><span>Способ оплаты</span>${esc(o.payment)}</div>
      <div class="pair"><span>Дата отгрузки</span>${fmtDate(o.ship)}</div>
    </div>
    <table><thead><tr><th>№</th><th>Наименование</th><th>Артикул</th><th>Формат</th>
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

/* ---------- выгрузка ---------- */
function csv() {
  const rows = [['№ заявки','Дата','Получена','Статус','Заказчик','Контакт','Телефон','Город',
    'Доставка','Адрес/ТК','Оплата','Наименование','Артикул','Формат','Упаковок','м²','Склад','Комментарий']];
  all().forEach(o => (o.items || []).forEach(i => rows.push([o.no, o.date, (o.received || '').slice(0, 10),
    STATUS[o.status], o.customer, o.person, o.phone, o.city, o.delivery, o.address, o.payment,
    i.name, i.art, i.format, i.packs, (i.packs * i.sqm).toFixed(2), i.wh, o.note])));
  const text = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv'}));
  a.download = `Заявки дилеров ${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

/* ---------- события ---------- */
$('#orders').addEventListener('change', e => {
  const sel = e.target.closest('[data-act=status]'); if (!sel) return;
  const no = sel.closest('.order').dataset.no, list = all();
  list.find(o => o.no === no).status = sel.value;
  save(list); draw();
});
$('#orders').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const no = b.closest('.order').dataset.no, list = all(), o = list.find(x => x.no === no);
  if (b.dataset.act === 'print') return printOrder(o);
  if (b.dataset.act === 'del' && confirm(`Удалить заявку № ${no} из журнала?`)) {
    save(list.filter(x => x.no !== no)); draw();
  }
});
$('#st').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  $('#st').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
  draw();
});
$('#q').addEventListener('input', draw);
$('#csv').addEventListener('click', csv);
addEventListener('hashchange', drawIncoming);

drawIncoming(); draw();
