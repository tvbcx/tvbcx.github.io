/* showmarking.js — single source of truth for the "Add to Watchlist"
   and "Mark As" controls that sit beneath a show's genre tags on
   postershow.html (index.html). Loaded on that page via:
     <script src="/showmarking.js?v=1"></script>

   TO CHANGE THE BUTTON TEXT OR THE MARK AS OPTIONS:
   Edit the config values below. That's it — nothing else in this file
   or in index.html needs to change for content edits.

   Nobody is signed in yet anywhere on the site, so every action here
   (Add to Watchlist, Did Not Finish, Watched, Add to List, and letting
   go of the star rating) just shows the same "Sign in or Sign up to
   continue" toast instead of actually saving anything. */

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
  if (!actionsBox) return; // this page has no Add to Watchlist / Mark As block

  const watchlistBtn = document.getElementById('watchlist-btn');
  const markasBtnLabel = document.getElementById('markas-btn-label');
  const markasToggle = document.getElementById('markas-toggle');
  const markasOptionsWrap = document.getElementById('markas-options');
  const starsTrack = document.getElementById('markas-stars-track');
  const starsFg = document.getElementById('markas-stars-fg');

  // ---- Fill in labels / options from the config above ----
  if (watchlistBtn) watchlistBtn.textContent = WATCHLIST_BTN_LABEL;
  if (markasBtnLabel) markasBtnLabel.textContent = MARKAS_BTN_LABEL;

  if (markasOptionsWrap) {
    markasOptionsWrap.innerHTML = MARKAS_OPTIONS.map((opt) =>
      `<button type="button" class="markas-option" data-action="${opt.id}">${opt.label}</button>`
    ).join('');
  }

  // ---- "Sign in or Sign up to continue" toast ----
  let toastEl = null;
  let toastTimer = null;

  function showAuthPrompt() {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'watchlist-toast';
      toastEl.textContent = AUTH_PROMPT_MESSAGE;
      document.body.appendChild(toastEl);
    }
    // Restart the fade-in even if a toast is already showing.
    toastEl.classList.remove('-visible');
    void toastEl.offsetWidth; // force reflow so the transition replays
    toastEl.classList.add('-visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('-visible');
    }, TOAST_VISIBLE_MS);
  }

  function closeMarkAs() {
    if (markasToggle) markasToggle.checked = false;
  }

  // ---- Add to Watchlist ----
  if (watchlistBtn) {
    watchlistBtn.addEventListener('click', () => {
      showAuthPrompt();
    });
  }

  // ---- Did Not Finish / Watched / Add to List ----
  if (markasOptionsWrap) {
    markasOptionsWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.markas-option');
      if (!btn) return;
      closeMarkAs();
      showAuthPrompt();
    });
  }

  // ---- Star rating: press-and-drag left/right fills the row
  // continuously, letting go reports the rating (here: shows the
  // sign-in prompt) and closes the Mark As box. ----
  if (starsTrack && starsFg) {
    let dragging = false;

    function percentFromEvent(e) {
      const rect = starsTrack.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = (x / rect.width) * 100;
      return Math.max(0, Math.min(100, pct));
    }

    function setFill(pct) {
      starsFg.style.width = pct + '%';
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

    starsTrack.addEventListener('pointerup', finishDrag);
    starsTrack.addEventListener('pointercancel', finishDrag);
  }

  // ---- Close the Mark As box on scroll, same reasoning as auth.js:
  // clicking/tapping outside it already closes it for free via the
  // .markas-backdrop <label>, this just adds the one thing CSS can't
  // do on its own — reacting to scroll. ----
  window.addEventListener('scroll', () => {
    if (markasToggle && markasToggle.checked) markasToggle.checked = false;
  }, { passive: true });
});
