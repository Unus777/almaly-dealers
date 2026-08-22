/** Перетаскивание фото мышью и пальцем.
 *  enableDnd(container, onDrop) — container с секциями [data-art] и карточками .shot[data-f].
 *  onDrop(art, ["01.jpg", ...]) вызывается только если порядок реально изменился. */
function enableDnd(container, onDrop) {
  let drag = null;

  const shotsOf = row => [...row.querySelectorAll('.shot')];
  const orderOf = row => shotsOf(row).map(s => s.dataset.f);

  container.addEventListener('pointerdown', e => {
    if (e.button > 0 || e.target.closest('button, label, input, a')) return;
    const shot = e.target.closest('.shot');
    if (!shot) return;
    drag = {shot, row: shot.parentElement, x: e.clientX, y: e.clientY,
            before: orderOf(shot.parentElement), moved: false};
    shot.setPointerCapture(e.pointerId);
  });

  container.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.shot.classList.add('dragging'); }
    e.preventDefault();
    drag.shot.style.transform = `translate(${dx}px, ${dy}px)`;

    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.shot');
    if (!under || under === drag.shot || under.parentElement !== drag.row) return;
    const after = under.compareDocumentPosition(drag.shot) & Node.DOCUMENT_POSITION_PRECEDING;
    drag.row.insertBefore(drag.shot, after ? under.nextSibling : under);
    drag.x = e.clientX; drag.y = e.clientY;
    drag.shot.style.transform = '';
  });

  const finish = () => {
    if (!drag) return;
    const {shot, row, before, moved} = drag;
    drag = null;
    shot.classList.remove('dragging');
    shot.style.transform = '';
    const after = orderOf(row);
    if (moved && after.join() !== before.join())
      onDrop(row.closest('[data-art]').dataset.art, after);
  };
  container.addEventListener('pointerup', finish);
  container.addEventListener('pointercancel', finish);
}
