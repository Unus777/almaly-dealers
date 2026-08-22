/* Каталог портала — собственный: свои карточки, свои фотографии. */
const load = fetch('data.json', {cache: 'no-cache'}).then(r => r.json());
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = (v, d = 2) => Number(v).toLocaleString('ru-RU', {maximumFractionDigits: d});
const m2 = v => v > 0 ? nf(v) + ' м²' : '—';
const img = (t, i, thumb) => `img/${t.art}/${t.photos[i]}${thumb ? '_t' : ''}.jpg`;

/** Из строки упаковки «1 уп-2шт-1,44м2-27 кг» достаём м² и вес одной упаковки. */
function packInfo(t) {
  const p = (t.packing || '').replace(',', '.');
  const sqm = +(p.match(/([\d.]+)\s*м2/i)?.[1]) || (String(t.format).includes('120') ? 1.44 : 1.8);
  const kg = +(p.match(/([\d.]+)\s*кг/i)?.[1]) || 0;
  return {sqm, kg};
}
/** Дилер вводит метры — считаем целые упаковки с округлением вверх. */
const packsFor = (need, sqm) => Math.max(1, Math.ceil(need / sqm));

/* ---------- заказ ---------- */
const CART = 'almaly_dealer_cart';
const getCart = () => { try { return JSON.parse(localStorage.getItem(CART)) || []; } catch { return []; } };
const setCart = c => { localStorage.setItem(CART, JSON.stringify(c)); updateCount(); };
const totals = cart => cart.reduce((a, i) => ({
  packs: a.packs + i.packs, sqm: a.sqm + i.packs * i.sqm, kg: a.kg + i.packs * (i.kg || 0)
}), {packs: 0, sqm: 0, kg: 0});

function updateCount() {
  const n = getCart().length, el = $('#cart-count');
  if (el) { el.textContent = n; el.closest('.navlink')?.classList.toggle('filled', n > 0); }
}
const toast = t => {
  const el = $('#toast'); if (!el) return;
  el.textContent = t; el.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => el.style.display = 'none', 3200);
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

/* ---------- страница модели: ввод в м² ---------- */
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
          <div class="main-ph" id="big-wrap"><img id="big" src="${img(t, 0)}" alt="${esc(t.name)}"></div>
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
          <p class="h3">Добавить в заявку</p>
          <div class="row">
            <div class="field"><label>Нужно квадратных метров</label>
              <input id="need" type="number" min="0.1" step="0.1" value="${(sqm * 10).toFixed(2)}" inputmode="decimal"></div>
            <div class="field"><label>Склад отгрузки</label>
              <select id="wh">
                <option value="Москва">Москва</option>
                <option value="Тверь">Тверь</option>
                <option value="Под заказ">Под заказ</option>
              </select></div>
          </div>
          <div class="calc" id="calc"></div>
          <button class="btn primary wide" id="add">Добавить в заявку</button>
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
    const need = Math.max(0.1, +String($('#need').value).replace(',', '.') || 0.1);
    const packs = packsFor(need, sqm), real = packs * sqm;
    const avail = wh.value === 'Москва' ? t.stock.msk : wh.value === 'Тверь' ? t.stock.tver : Infinity;
    $('#calc').innerHTML = `
      <div class="calc-row"><span>Упаковок к отгрузке</span><b>${packs}</b></div>
      <div class="calc-row"><span>Фактически по упаковкам</span><b>${nf(real)} м²</b></div>
      ${kg ? `<div class="calc-row"><span>Ориентировочный вес</span><b>${nf(packs * kg, 0)} кг</b></div>` : ''}
      ${real > avail ? `<div class="calc-note">На складе ${m2(avail)} — недостающее оформим под заказ.</div>` : ''}`;
  };
  ['input', 'change'].forEach(ev => { $('#need').addEventListener(ev, calc); wh.addEventListener(ev, calc); });
  calc();

  $('#add').addEventListener('click', () => {
    const need = Math.max(0.1, +String($('#need').value).replace(',', '.') || 0.1);
    const packs = packsFor(need, sqm);
    const cart = getCart();
    const same = cart.find(i => i.art === t.art && i.wh === wh.value);
    if (same) { same.packs += packs; same.need = +(same.need + need).toFixed(2); }
    else cart.push({art: t.art, name: t.name, format: t.format, surface: t.surface,
                    photo: t.photos.length ? img(t, 0, true) : '',
                    sqm, kg, need: +need.toFixed(2), packs, wh: wh.value});
    setCart(cart);
    toast(`${t.name}: ${packs} уп. (${nf(packs * sqm)} м²) в заявке`);
  });
}
