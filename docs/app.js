/* Каталог берём из витрины с QR-кодами: один источник данных, тот сайт не меняется. */
const load = fetch(CATALOG + 'data.json', {cache: 'no-cache'}).then(r => r.json());
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = (v, d = 2) => Number(v).toLocaleString('ru-RU', {maximumFractionDigits: d});
const m2 = v => v > 0 ? nf(v) + ' м²' : '—';
const img = (t, i, thumb) => `${CATALOG}img/${t.art}/${t.photos[i]}${thumb ? '_t' : ''}.jpg`;

/** Из строки упаковки «1 уп-2шт-1,44м2-27 кг» достаём м² и вес одной упаковки. */
function packInfo(t) {
  const p = (t.packing || '').replace(',', '.');
  const sqm = +(p.match(/([\d.]+)\s*м2/i)?.[1]) || (t.format.includes('120') ? 1.44 : 1.8);
  const kg = +(p.match(/([\d.]+)\s*кг/i)?.[1]) || 0;
  return {sqm, kg};
}

/* ---------- заказ в localStorage ---------- */
const CART = 'almaly_dealer_cart';
const getCart = () => { try { return JSON.parse(localStorage.getItem(CART)) || []; } catch { return []; } };
const setCart = c => { localStorage.setItem(CART, JSON.stringify(c)); updateCount(); };
function updateCount() {
  const n = getCart().length, el = $('#cart-count');
  if (el) el.textContent = n;
}
const toast = t => {
  const el = $('#toast'); if (!el) return;
  el.textContent = t; el.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', 3000);
};

/* ---------- каталог ---------- */
async function renderCatalog() {
  updateCount();
  const {tiles} = await load;
  const [q, fmt, srf, grid, count] = ['q','fmt','srf','grid','count'].map(id => document.getElementById(id));
  const formats = [...new Set(tiles.map(t => t.format))].sort();
  fmt.innerHTML = ['Все форматы', ...formats].map((v, i) =>
    `<button class="chip" aria-pressed="${i === 0}" data-v="${i ? v : ''}">${v}</button>`).join('');
  [...new Set(tiles.map(t => t.surface))].sort().forEach(v => srf.add(new Option(v, v)));

  const draw = () => {
    const s = q.value.trim().toLowerCase();
    const f = fmt.querySelector('[aria-pressed=true]').dataset.v;
    const list = tiles.filter(t => (!f || t.format === f) && (!srf.value || t.surface === srf.value) &&
      (!s || (t.name + ' ' + t.art).toLowerCase().includes(s)));
    grid.innerHTML = list.map(t => `
      <a class="card" href="tile.html?a=${t.art}">
        <div class="ph">${t.is_new ? '<span class="badge-new">Новинка</span>' : ''}
          ${t.photos.length ? `<img src="${img(t, 0, true)}" alt="${esc(t.name)}" loading="lazy">` : 'фото скоро'}</div>
        <div class="b">
          <h3>${esc(t.name)}</h3>
          <div class="art">${t.art}</div>
          <div class="meta"><span class="tag">${t.format}</span><span class="tag">${esc(t.surface)}</span></div>
          <div class="stock">
            <span>Москва <b class="${t.stock.msk > 0 ? 'ok' : 'off'}">${m2(t.stock.msk)}</b></span>
            <span>Тверь <b class="${t.stock.tver > 0 ? 'ok' : 'off'}">${m2(t.stock.tver)}</b></span>
          </div>
        </div>
      </a>`).join('') || '<p class="meta">Ничего не найдено.</p>';
    count.textContent = `${list.length} из ${tiles.length}`;
  };
  fmt.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    fmt.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === b));
    draw();
  });
  [q, srf].forEach(el => el.addEventListener('input', draw));
  draw();
  $('#s-models').textContent = tiles.length;
  $('#s-new').textContent = tiles.filter(t => t.is_new).length;
  $('#stat').textContent = `${tiles.length} моделей в наличии и под заказ`;
}

/* ---------- карточка плитки ---------- */
async function renderTile() {
  updateCount();
  const {tiles} = await load;
  const t = tiles.find(x => x.art === new URLSearchParams(location.search).get('a'));
  const box = $('#tile');
  if (!t) { box.innerHTML = '<p class="back">Модель не найдена. <a href="index.html">В каталог</a></p>'; return; }
  document.title = `${t.name} ${t.art} — заказ`;
  const {sqm, kg} = packInfo(t);

  box.innerHTML = `
    <a class="back" href="index.html">← Все модели</a>
    <div class="tile">
      <div>
        ${t.photos.length ? `
          <div class="main-ph"><img id="big" src="${img(t, 0)}" alt="${esc(t.name)}"></div>
          <div class="thumbs">${t.photos.map((p, i) =>
            `<img src="${img(t, i, true)}" alt="Фото ${i + 1}" data-i="${i}" aria-current="${i === 0}">`).join('')}</div>`
          : '<div class="main-ph"><div class="ph" style="aspect-ratio:4/3">фото скоро</div></div>'}
      </div>
      <div class="side">
        <h1>${esc(t.name)}${t.is_new ? ' <span class="tag new">Новинка</span>' : ''}</h1>
        <div class="art">${t.art}</div>

        <p class="h2">Характеристики</p>
        <table class="spec">
          <tr><th>Формат</th><td>${t.format} см</td></tr>
          <tr><th>Поверхность</th><td>${esc(t.surface)}</td></tr>
          <tr><th>В упаковке</th><td>${nf(sqm)} м²${kg ? ` · ${nf(kg, 1)} кг` : ''}</td></tr>
          <tr><th>Паллета</th><td>${esc(t.pallet)}</td></tr>
        </table>

        <p class="h2">Остатки</p>
        <table class="spec">
          <tr><th>Склад Москва</th><td>${m2(t.stock.msk)}</td></tr>
          <tr><th>Склад Тверь</th><td>${m2(t.stock.tver)}</td></tr>
        </table>

        <div class="add">
          <p class="h3">Добавить в заказ</p>
          <div class="row">
            <div class="field"><label>Упаковок</label>
              <input id="packs" type="number" min="1" step="1" value="10"></div>
            <div class="field"><label>Склад</label>
              <select id="wh">
                <option value="Москва" ${t.stock.msk <= 0 ? 'disabled' : ''}>Москва${t.stock.msk > 0 ? '' : ' — нет'}</option>
                <option value="Тверь" ${t.stock.tver <= 0 ? 'disabled' : ''}>Тверь${t.stock.tver > 0 ? '' : ' — нет'}</option>
                <option value="Под заказ">Под заказ</option>
              </select></div>
          </div>
          <p class="calc" id="calc"></p>
          <button class="btn primary" id="add" style="margin-top:12px;width:100%;justify-content:center">
            Добавить в заказ</button>
        </div>
      </div>
    </div>`;

  const thumbs = box.querySelector('.thumbs');
  thumbs?.addEventListener('click', e => {
    const th = e.target.closest('img[data-i]'); if (!th) return;
    $('#big').src = img(t, +th.dataset.i);
    thumbs.querySelectorAll('img').forEach(i => i.setAttribute('aria-current', i === th));
  });

  const wh = $('#wh');
  wh.value = t.stock.msk > 0 ? 'Москва' : t.stock.tver > 0 ? 'Тверь' : 'Под заказ';
  const calc = () => {
    const packs = Math.max(1, +$('#packs').value || 1);
    const avail = wh.value === 'Москва' ? t.stock.msk : wh.value === 'Тверь' ? t.stock.tver : Infinity;
    const need = packs * sqm;
    $('#calc').innerHTML = `Итого: <b>${nf(need)} м²</b>${kg ? ` · ${nf(packs * kg, 0)} кг` : ''}` +
      (need > avail ? ` · <span style="color:#e0a1a1">на складе ${m2(avail)} — оформим под заказ</span>` : '');
  };
  ['input', 'change'].forEach(ev => { $('#packs').addEventListener(ev, calc); wh.addEventListener(ev, calc); });
  calc();

  $('#add').addEventListener('click', () => {
    const packs = Math.max(1, +$('#packs').value || 1);
    const cart = getCart();
    const same = cart.find(i => i.art === t.art && i.wh === wh.value);
    if (same) same.packs += packs;
    else cart.push({art: t.art, name: t.name, format: t.format, surface: t.surface,
                    sqm, kg, packs, wh: wh.value});
    setCart(cart);
    toast(`${t.name} — добавлено в заказ (${packs} уп.)`);
  });
}

/* ---------- бланк заказа ---------- */
const F = ['customer','person','phone','city','date','ship','delivery','address','payment','note'];
const formData = () => Object.fromEntries(F.map(k => [k, $('#f-' + k).value.trim()]));
const orderNo = () => {
  let n = localStorage.getItem('almaly_order_no');
  if (!n) { n = new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' +
    Math.random().toString().slice(2, 5); localStorage.setItem('almaly_order_no', n); }
  return n;
};

function totals(cart) {
  return cart.reduce((a, i) => ({sqm: a.sqm + i.packs * i.sqm, kg: a.kg + i.packs * (i.kg || 0),
    packs: a.packs + i.packs}), {sqm: 0, kg: 0, packs: 0});
}

function renderItems() {
  const cart = getCart(), box = $('#items');
  if (!cart.length) {
    box.innerHTML = `<p class="empty">Заказ пуст. <a href="index.html" style="color:var(--accent)">Выбрать плитку в каталоге →</a></p>`;
    return renderSheet();
  }
  const tt = totals(cart);
  box.innerHTML = `<table class="items">
    <thead><tr><th></th><th>Наименование</th><th>Артикул</th><th>Формат</th>
      <th>Упаковок</th><th>м²</th><th>Склад</th><th></th></tr></thead>
    <tbody>${cart.map((i, n) => `<tr>
      <td><img class="thumb" src="${CATALOG}img/${i.art}/01.jpg" onerror="this.style.visibility='hidden'" alt=""></td>
      <td><b>${esc(i.name)}</b><div class="meta">${esc(i.surface)}</div></td>
      <td class="art">${i.art}</td>
      <td>${i.format}</td>
      <td><input class="qty" type="number" min="1" step="1" value="${i.packs}" data-n="${n}" data-k="packs"></td>
      <td>${nf(i.packs * i.sqm)}</td>
      <td><select data-n="${n}" data-k="wh">
        ${['Москва','Тверь','Под заказ'].map(w => `<option ${w === i.wh ? 'selected' : ''}>${w}</option>`).join('')}
      </select></td>
      <td><button class="rm" data-rm="${n}" title="Убрать">✕</button></td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="4">Итого</td><td>${tt.packs} уп.</td>
      <td>${nf(tt.sqm)} м²</td><td colspan="2">${tt.kg ? nf(tt.kg, 0) + ' кг' : ''}</td></tr></tfoot>
  </table>`;
  renderSheet();
  renderSummary();
}

function renderSummary() {
  const box = document.getElementById('summary');
  if (!box) return;
  const t = totals(getCart());
  box.innerHTML = !t.packs ? '' : `<div class="summary">
    <div><b>${getCart().length}</b><span>позиций</span></div>
    <div><b>${t.packs}</b><span>упаковок</span></div>
    <div><b>${nf(t.sqm)}</b><span>м² всего</span></div>
    ${t.kg ? `<div><b>${nf(t.kg, 0)}</b><span>кг ориентировочно</span></div>` : ''}
  </div>`;
}

function renderSheet() {
  const cart = getCart(), d = formData(), tt = totals(cart);
  const dateTxt = d.date ? new Date(d.date).toLocaleDateString('ru-RU') : '—';
  $('#sheet').innerHTML = !cart.length ? '' : `
  <div class="sheet" id="print-sheet">
    <div class="top">
      <div class="mark"><svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="14" fill="#111"/><path d="M50 20 66 50 50 80 34 50z" fill="#c9a227"/></svg>
        <div>
        <h1>Бланк заказа</h1>
        <div class="company">${COMPANY.name} · ${COMPANY.tagline}<br>
          ${COMPANY.phone} · ${COMPANY.email}</div>
      </div></div>
      <div class="no">заказ<b>№ ${orderNo()}</b>от ${dateTxt}</div>
    </div>
    <div class="pairs">
      <div class="pair"><span>Заказчик</span>${esc(d.customer) || '—'}</div>
      <div class="pair"><span>Контактное лицо</span>${esc(d.person) || '—'}</div>
      <div class="pair"><span>Телефон</span>${esc(d.phone) || '—'}</div>
      <div class="pair"><span>Город / адрес</span>${esc(d.city) || '—'}</div>
      <div class="pair"><span>Способ доставки</span>${esc(d.delivery)}</div>
      <div class="pair"><span>ТК / адрес доставки</span>${esc(d.address) || '—'}</div>
      <div class="pair"><span>Способ оплаты</span>${esc(d.payment)}</div>
      <div class="pair"><span>Дата отгрузки</span>${d.ship ? new Date(d.ship).toLocaleDateString('ru-RU') : '—'}</div>
    </div>
    <table>
      <thead><tr><th>№</th><th>Наименование</th><th>Артикул</th><th>Формат</th><th>Поверхность</th>
        <th class="num">Упак.</th><th class="num">м²</th><th class="num">Вес, кг</th><th>Склад</th></tr></thead>
      <tbody>${cart.map((i, n) => `<tr>
        <td>${n + 1}</td><td>${esc(i.name)}</td><td>${i.art}</td><td>${i.format}</td><td>${esc(i.surface)}</td>
        <td class="num">${i.packs}</td><td class="num">${nf(i.packs * i.sqm)}</td>
        <td class="num">${i.kg ? nf(i.packs * i.kg, 0) : '—'}</td><td>${esc(i.wh)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="5">Итого</td><td class="num">${tt.packs}</td>
        <td class="num">${nf(tt.sqm)}</td><td class="num">${tt.kg ? nf(tt.kg, 0) : '—'}</td><td></td></tr></tfoot>
    </table>
    ${d.note ? `<div class="company"><b>Комментарий:</b> ${esc(d.note)}</div>` : ''}
    <div class="signs"><div>Заказчик / подпись</div><div>Менеджер поставщика / подпись</div></div>
    <div class="foot">Цены и сроки подтверждает менеджер после проверки остатков.
      Бланк сформирован на ${COMPANY.site}</div>
  </div>`;
}

const orderText = () => {
  const cart = getCart(), d = formData(), tt = totals(cart);
  return [`Заказ № ${orderNo()} от ${d.date ? new Date(d.date).toLocaleDateString('ru-RU') : ''}`,
    `Заказчик: ${d.customer}${d.person ? ', ' + d.person : ''}${d.phone ? ', ' + d.phone : ''}`,
    d.city && `Город: ${d.city}`,
    '', ...cart.map((i, n) => `${n + 1}. ${i.name} (${i.art}) ${i.format} — ${i.packs} уп. / ${nf(i.packs * i.sqm)} м², склад: ${i.wh}`),
    '', `Итого: ${tt.packs} уп. / ${nf(tt.sqm)} м²${tt.kg ? ' / ' + nf(tt.kg, 0) + ' кг' : ''}`,
    `Доставка: ${d.delivery}${d.address ? ' — ' + d.address : ''}`,
    `Оплата: ${d.payment}`, d.ship && `Отгрузка: ${new Date(d.ship).toLocaleDateString('ru-RU')}`,
    d.note && `Комментарий: ${d.note}`,
  ].filter(Boolean).join('\n');
};

/** Ссылка на заявку для менеджера: все данные внутри адреса, сервер не нужен. */
const orderLink = () => {
  const payload = {no: orderNo(), ...formData(), items: getCart()};
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return location.origin + location.pathname.replace(/order\.html$/, 'manager.html') + '#' + b64;
};

function validate() {
  let ok = true;
  for (const k of ['customer', 'person', 'phone']) {
    const el = $('#f-' + k);
    el.classList.toggle('err', !el.value.trim());
    if (!el.value.trim()) ok = false;
  }
  if (!ok) toast('Заполните заказчика, контактное лицо и телефон');
  if (!getCart().length) { toast('Заказ пуст — выберите плитку в каталоге'); ok = false; }
  return ok;
}

function renderOrder() {
  updateCount();
  $('#f-date').value = new Date().toISOString().slice(0, 10);
  F.forEach(k => {
    const saved = localStorage.getItem('almaly_f_' + k);
    if (saved && !$('#f-' + k).value) $('#f-' + k).value = saved;
    $('#f-' + k).addEventListener('input', e => {
      localStorage.setItem('almaly_f_' + k, e.target.value); renderSheet();
    });
  });
  renderItems();

  $('#items').addEventListener('input', e => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const cart = getCart(), i = cart[+el.dataset.n];
    i[el.dataset.k] = el.dataset.k === 'packs' ? Math.max(1, +el.value || 1) : el.value;
    setCart(cart); renderItems();
  });
  $('#items').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    const cart = getCart(); cart.splice(+b.dataset.rm, 1); setCart(cart); renderItems();
  });

  $('#print').addEventListener('click', () => validate() && print());
  $('#wa').addEventListener('click', () => {
    if (!validate()) return;
    open(`https://wa.me/${COMPANY.whatsapp}?text=` +
      encodeURIComponent(orderText() + '\n\nЗаявка для менеджера: ' + orderLink()), '_blank');
  });
  $('#mail').addEventListener('click', () => {
    if (!validate()) return;
    location.href = `mailto:${COMPANY.email}?subject=` +
      encodeURIComponent(`Заказ № ${orderNo()} — ${formData().customer}`) +
      '&body=' + encodeURIComponent(orderText() + '\n\nЗаявка для менеджера: ' + orderLink());
  });
  $('#copy').addEventListener('click', async () => {
    if (!validate()) return;
    await navigator.clipboard.writeText(orderText() + '\n\nЗаявка для менеджера: ' + orderLink());
    toast('Текст заявки скопирован');
  });
  $('#clear').addEventListener('click', () => {
    if (!confirm('Очистить заказ?')) return;
    localStorage.removeItem(CART); localStorage.removeItem('almaly_order_no');
    renderItems(); toast('Заказ очищен');
  });
}
