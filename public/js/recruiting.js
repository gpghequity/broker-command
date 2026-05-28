(function () {
  // Add Prospect modal
  const addBtn = document.getElementById('open-add-prospect');
  const addModal = document.getElementById('add-prospect-modal');
  if (addBtn && addModal) {
    const open = () => { addModal.classList.add('is-open'); addModal.setAttribute('aria-hidden', 'false'); };
    const close = () => { addModal.classList.remove('is-open'); addModal.setAttribute('aria-hidden', 'true'); };
    addBtn.addEventListener('click', open);
    addModal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', close));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && addModal.classList.contains('is-open')) close(); });
  }

  // Prospect detail modal
  const detailModal = document.getElementById('prospect-modal');
  const nameEl = document.getElementById('prospect-modal-name');
  const detailEl = document.getElementById('prospect-detail');
  let currentProspect = null;

  function openProspect(p) {
    currentProspect = p;
    nameEl.textContent = p.name;
    detailEl.innerHTML = renderProspect(p);
    detailModal.classList.add('is-open');
    detailModal.setAttribute('aria-hidden', 'false');
  }
  function closeProspect() {
    detailModal.classList.remove('is-open');
    detailModal.setAttribute('aria-hidden', 'true');
    currentProspect = null;
  }

  function renderProspect(p) {
    const stageLabel = { sourced:'Sourced', contacted:'Contacted', conversation:'In Conversation', offer:'Offer Extended' }[p.stage] || p.stage;
    return `
      <div class="result-section">
        <div class="metric-row"><div class="metric-label">Current Brokerage</div><div class="metric-val">${escapeHtml(p.brokerage)}</div></div>
        <div class="metric-row"><div class="metric-label">License State</div><div class="metric-val">${escapeHtml(p.state)}</div></div>
        <div class="metric-row"><div class="metric-label">Estimated GCI</div><div class="metric-val">$${(p.gci/1000).toFixed(0)}K</div></div>
        <div class="metric-row"><div class="metric-label">Current Stage</div><div class="metric-val">${escapeHtml(stageLabel)}</div></div>
        <div class="metric-row"><div class="metric-label">Days in Stage</div><div class="metric-val">${p.days}</div></div>
        <div class="metric-row"><div class="metric-label">Last Touch</div><div class="metric-val">${escapeHtml(p.lastTouch)}</div></div>
        <div class="metric-row"><div class="metric-label">Source</div><div class="metric-val">${escapeHtml(p.source)}</div></div>
      </div>
      <h3 class="h3" style="margin-top:18px;">Communication Log</h3>
      <div class="sub" style="margin-bottom:10px;">v2 — integrates with Marketing Command.</div>
      <textarea placeholder="Notes about this prospect..." style="min-height:100px;"></textarea>
    `;
  }

  document.querySelectorAll('.prospect-card').forEach(card => {
    card.addEventListener('click', () => {
      try {
        const p = JSON.parse(card.dataset.prospect);
        openProspect(p);
      } catch {}
    });
  });

  if (detailModal) {
    detailModal.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeProspect));
    detailModal.querySelectorAll('[data-prospect-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!currentProspect) return;
        const action = btn.dataset.prospectAction;
        if (action === 'next' || action === 'prev') {
          const res = await fetch(`/recruiting/${currentProspect.id}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ direction: action })
          });
          const data = await res.json();
          if (data.ok) { location.reload(); }
        } else if (action === 'lose') {
          if (!confirm(`Mark ${currentProspect.name} as Lost?`)) return;
          await fetch(`/recruiting/${currentProspect.id}/lose`, { method: 'POST' });
          location.reload();
        } else if (action === 'convert') {
          const res = await fetch(`/recruiting/${currentProspect.id}/convert`, { method: 'POST' });
          const data = await res.json();
          alert(data.message || 'Handoff recorded.');
          location.reload();
        }
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
})();
