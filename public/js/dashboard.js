(function () {
  const openBtn = document.getElementById('mc-notify-btn');
  const modal = document.getElementById('mc-modal');
  const form = document.getElementById('mc-notify-form');
  if (!openBtn || !modal || !form) return;

  const email = document.getElementById('mc-email');
  const success = document.getElementById('mc-success');
  const successEmail = document.getElementById('mc-success-email');

  function open() { modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false'); email.value = ''; success.hidden = true; setTimeout(() => email.focus(), 50); }
  function close() { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }

  openBtn.addEventListener('click', open);
  modal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const res = await fetch('/api/notify-marketing-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value })
    });
    const data = await res.json();
    if (data.ok) {
      successEmail.textContent = email.value;
      success.hidden = false;
      setTimeout(close, 2200);
    } else {
      alert(data.error || 'Something went wrong.');
    }
  });
})();
