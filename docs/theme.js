/* Переключатель темы. Выбор хранится в браузере посетителя, по умолчанию — как в системе.
   Раннее применение темы (до отрисовки) делает короткий скрипт в <head> каждой страницы. */
(() => {
  const KEY = 'almaly_theme';
  const root = document.documentElement;
  const system = () => matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const current = () => root.dataset.theme || system();

  function apply(theme, remember) {
    root.dataset.theme = theme;
    if (remember) { try { localStorage.setItem(KEY, theme); } catch {} }
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = theme === 'dark' ? '#141516' : '#f8f6f2';
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.setAttribute('aria-pressed', theme === 'dark');
      b.setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
      b.title = theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    });
  }

  apply(current(), false);

  // пока посетитель не выбрал тему сам, следуем за системной
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    if (!saved) apply(e.matches ? 'dark' : 'light', false);
  });

  addEventListener('click', e => {
    if (!e.target.closest('.theme-btn')) return;
    apply(current() === 'dark' ? 'light' : 'dark', true);
  });
})();
