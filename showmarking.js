const WATCHLIST_BTN_LABEL = 'Add to Watchlist';
const MARKAS_BTN_LABEL = 'Mark As';
const AUTH_PROMPT_MESSAGE = 'Sign in or Sign up to continue';

const MARKAS_OPTIONS = [
  { id: 'dnf', label: 'Did Not Finish' },
  { id: 'watched', label: 'Watched' },
  { id: 'addlist', label: 'Add to List' },
];

const STAR_COUNT = 5;
const TOAST_VISIBLE_MS = 2200;

document.addEventListener('DOMContentLoaded', () => {
  const actionsBox = document.querySelector('.show-actions');
  if (!actionsBox) return;

  const watchlistBtn    = document.getElementById('watchlist-btn');
  const markasBtnLabel  = document.getElementById('markas-btn-label');
  const markasToggle    = document.getElementById('markas-toggle');
  const markasOptionsWrap = document.getElementById('markas-options');
  const starsTrack      = document.getElementById('markas-stars-track');
  const starsFg         = document.getElementById('markas-stars-fg');

  if (watchlistBtn)    watchlistBtn.textContent   = WATCHLIST_BTN_LABEL;
  if (markasBtnLabel)  markasBtnLabel.textContent  = MARKAS_BTN_LABEL;

  if (markasOptionsWrap) {
    markasOptionsWrap.innerHTML = MARKAS_OPTIONS.map((opt) =>
      `<button type="button" class="markas-option" data-action="${opt.id}">${opt.label}</button>`
    ).join('');
  }

  let toastEl    = null;
  let toastTimer = null;

  function showAuthPrompt() {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'watchlist-toast';
      toastEl.textContent = AUTH_PROMPT_MESSAGE;
      document.body.appendChild(toastEl);
    }
    toastEl.classList.remove('-visible');
    void toastEl.offsetWidth;
    toastEl.classList.add('-visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('-visible');
    }, TOAST_VISIBLE_MS);
  }

  function closeMarkAs() {
    if (markasToggle) markasToggle.checked = false;
  }

  // Reset stars to empty every time the popover opens
  if (markasToggle && starsFg) {
    markasToggle.addEventListener('change', () => {
      if (markasToggle.checked) {
        starsFg.style.width = '0%';
      }
    });
  }

  if (watchlistBtn) {
    watchlistBtn.addEventListener('click', () => {
      showAuthPrompt();
    });
  }

  if (markasOptionsWrap) {
    markasOptionsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.markas-option');
      if (!btn) return;
      closeMarkAs();
      showAuthPrompt();
    });
  }

  if (starsTrack && starsFg) {
    let dragging = false;

    function percentFromEvent(e) {
      const rect = starsTrack.getBoundingClientRect();
      const x    = e.clientX - rect.left;
      const pct  = (x / rect.width) * 100;
      return Math.max(0, Math.min(100, pct));
    }

    // Build the 10 valid snap percentages (½ and whole for each of 5 stars).
    //
    // Why not just multiples of 10%?
    // Each star "slot" = glyph width + letter-spacing.
    // The letter-spacing sits AFTER the glyph, so the visual midpoint of a
    // glyph is NOT at 10% of the total track — it's closer to 8%.
    // We read the rendered letter-spacing from the computed style so this
    // works correctly on both mobile (font 26px / ls 6px) and desktop
    // (font 32px / ls 8px) without hard-coding anything.
    //
    //  slot    = totalWidth / 5
    //  glyph   = slot - letterSpacing          (≈ font-size)
    //  half-i  = (i * slot + glyph * 0.5) / totalWidth * 100
    //  full-i  = (i + 1) / 5 * 100            (end of slot looks same as end of glyph)
    function buildSnapPoints() {
      const rect         = starsTrack.getBoundingClientRect();
      const totalWidth   = rect.width;
      if (totalWidth === 0) return [];

      const computed      = window.getComputedStyle(starsTrack);
      const letterSpacing = parseFloat(computed.letterSpacing) || 0;
      const slotWidth     = totalWidth / STAR_COUNT;
      const glyphWidth    = slotWidth - letterSpacing;

      const pts = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const starStart = i * slotWidth;
        pts.push((starStart + glyphWidth * 0.5) / totalWidth * 100); // half star
        pts.push((i + 1) * slotWidth / totalWidth * 100);            // full star
      }
      return pts;
    }

    function snapToHalfStar(pct) {
      const pts = buildSnapPoints();
      if (!pts.length) return Math.round(pct / 10) * 10; // fallback

      // Snap to 0 (no fill) if cursor is before the midpoint of the first snap
      if (pct < pts[0] / 2) return 0;

      let nearest = pts[0];
      let minDist = Math.abs(pct - pts[0]);
      for (let i = 1; i < pts.length; i++) {
        const dist = Math.abs(pct - pts[i]);
        if (dist < minDist) { minDist = dist; nearest = pts[i]; }
      }
      return nearest;
    }

    function setFill(pct) {
      starsFg.style.width = snapToHalfStar(pct) + '%';
    }

    starsTrack.addEventListener('pointerdown', (e) => {
      dragging = true;
      starsTrack.setPointerCapture(e.pointerId);
      setFill(percentFromEvent(e));
    });

    starsTrack.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      setFill(percentFromEvent(e));
    });

    function finishDrag(e) {
      if (!dragging) return;
      dragging = false;
      closeMarkAs();
      showAuthPrompt();
    }

    starsTrack.addEventListener('pointerup',     finishDrag);
    starsTrack.addEventListener('pointercancel', finishDrag);
  }

  window.addEventListener('scroll', () => {
    if (markasToggle && markasToggle.checked) markasToggle.checked = false;
  }, { passive: true });
});
