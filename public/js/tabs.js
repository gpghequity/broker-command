(function () {
  document.querySelectorAll('.tabs').forEach(nav => {
    const buttons = nav.querySelectorAll('.tab-btn');
    const panels = nav.parentElement.querySelectorAll('.tab-panel');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        panels.forEach(p => p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
      });
    });
  });
})();
