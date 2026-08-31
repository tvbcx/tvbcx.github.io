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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MIN_WATCHDATES_YEAR = 1950;

document.addEventListener('DOMContentLoaded', () => {
  const actionsBox = document.querySelector('.show-actions');
  if (!actionsBox) return;

  const watchlistBtn    = document.getElementById('watchlist-btn');
  const markasBtnLabel  = document.getElementById('markas-btn-label');
  const markasToggle    = document.getElementById('markas-toggle');
  const markasOptionsWrap = document.getElementById('markas-options');
  const starsTrack      = document.getElementById('markas-stars-track');
  const starsFg         = document.getElementById('markas-stars-fg');

  // ---- "Mark As > Watched" date-range popover ----
  const watchdatesToggle   = document.getElementById('watchdates-toggle');
  const chipStart          = document.getElementById('chip-start');
  const chipEnd            = document.getElementById('chip-end');
  const chipStartValue     = document.getElementById('chip-start-value');
  const chipEndValue       = document.getElementById('chip-end-value');
  const stillWatchingBox   = document.getElementById('watchdates-still-watching');
  const prevBtn            = document.getElementById('watchdates-prev');
  const nextBtn            = document.getElementById('watchdates-next');
  const monthSelect        = document.getElementById('watchdates-month-select');
  const yearSelect         = document.getElementById('watchdates-year-select');
  const cal1Label          = document.getElementById('watchdates-cal-1-label');
  const cal2Label          = document.getElementById('watchdates-cal-2-label');
  const days1Wrap          = document.getElementById('watchdates-days-1');
  const days2Wrap          = document.getElementById('watchdates-days-2');
  const watchdatesSaveBtn  = document.getElementById('watchdates-save');
  const watchdatesCancelBtn = document.getElementById('watchdates-cancel');

  const hasWatchDatesUI = watchdatesToggle && chipStart && chipEnd && days1Wrap && days2Wrap;

  if (hasWatchDatesUI) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let baseMonth = today.getMonth();
    let baseYear  = today.getFullYear();
    let startDate = null;
    let endDate   = null;
    let activeField = 'start';
    let stillWatching = false;
    let watchDatesConfirmed = false;

    MONTH_NAMES.forEach((name, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = name;
      monthSelect.appendChild(opt);
    });
    for (let y = today.getFullYear(); y >= MIN_WATCHDATES_YEAR; y--) {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = String(y);
      yearSelect.appendChild(opt);
    }

    function isSameDay(a, b) {
      return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
    }

    function formatDate(d) {
      return MONTH_NAMES[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function setActiveField(field) {
      activeField = field;
      chipStart.classList.toggle('-active', field === 'start');
      chipEnd.classList.toggle('-active', field === 'end');
    }

    function updateChips() {
      if (startDate) {
        chipStartValue.textContent = formatDate(startDate);
        chipStart.classList.add('-filled');
      } else {
        chipStartValue.textContent = 'Select date';
        chipStart.classList.remove('-filled');
      }

      if (stillWatching) {
        chipEndValue.textContent = 'Still watching';
        chipEnd.classList.add('-filled');
      } else if (endDate) {
        chipEndValue.textContent = formatDate(endDate);
        chipEnd.classList.add('-filled');
      } else {
        chipEndValue.textContent = 'Select date';
        chipEnd.classList.remove('-filled');
      }

      chipEnd.classList.toggle('-disabled', stillWatching);
    }

    function updateSaveState() {
      watchdatesSaveBtn.disabled = !(startDate && (stillWatching || endDate));
    }

    function buildMonthGrid(container, year, month) {
      container.innerHTML = '';

      const firstOfMonth = new Date(year, month, 1);
      const startWeekday = firstOfMonth.getDay();
      const totalDays = new Date(year, month + 1, 0).getDate();
      const prevMonthTotalDays = new Date(year, month, 0).getDate();

      const cells = [];
      for (let i = startWeekday - 1; i >= 0; i--) {
        cells.push({ date: new Date(year, month - 1, prevMonthTotalDays - i), outside: true });
      }
      for (let d = 1; d <= totalDays; d++) {
        cells.push({ date: new Date(year, month, d), outside: false });
      }
      while (cells.length % 7 !== 0) {
        const last = cells[cells.length - 1].date;
        const next = new Date(last);
        next.setDate(next.getDate() + 1);
        cells.push({ date: next, outside: true });
      }

      cells.forEach((cell) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'watchdates-day';
        btn.textContent = String(cell.date.getDate());

        const isFuture = cell.date.getTime() > today.getTime();
        if (cell.outside) btn.classList.add('-outside');
        if (isFuture) btn.classList.add('-future');
        if (isSameDay(cell.date, today)) btn.classList.add('-today');

        if (startDate && isSameDay(cell.date, startDate)) {
          btn.classList.add(endDate ? '-range-start' : '-single');
        }
        if (endDate && isSameDay(cell.date, endDate)) {
          btn.classList.add('-range-end');
        }
        if (startDate && endDate && cell.date > startDate && cell.date < endDate) {
          btn.classList.add('-in-range');
        }

        if (!cell.outside && !isFuture) {
          btn.addEventListener('click', () => handleDayClick(cell.date));
        }

        container.appendChild(btn);
      });
    }

    function renderCalendars() {
      monthSelect.value = String(baseMonth);
      yearSelect.value = String(baseYear);

      const secondMonth = (baseMonth + 1) % 12;
      const secondYear  = baseMonth === 11 ? baseYear + 1 : baseYear;

      cal1Label.textContent = MONTH_NAMES[baseMonth] + ' ' + baseYear;
      cal2Label.textContent = MONTH_NAMES[secondMonth] + ' ' + secondYear;

      buildMonthGrid(days1Wrap, baseYear, baseMonth);
      buildMonthGrid(days2Wrap, secondYear, secondMonth);
    }

    function handleDayClick(date) {
      if (activeField === 'start') {
        startDate = date;
        if (endDate && endDate < startDate) endDate = null;
        if (!stillWatching) setActiveField('end');
      } else {
        if (startDate && date < startDate) {
          endDate = startDate;
          startDate = date;
        } else {
          endDate = date;
        }
      }
      updateChips();
      renderCalendars();
      updateSaveState();
    }

    function openWatchDates() {
      startDate = null;
      endDate = null;
      stillWatching = false;
      stillWatchingBox.checked = false;
      baseMonth = today.getMonth();
      baseYear = today.getFullYear();
      setActiveField('start');
      updateChips();
      renderCalendars();
      updateSaveState();
      watchdatesToggle.checked = true;
    }

    chipStart.addEventListener('click', () => setActiveField('start'));
    chipEnd.addEventListener('click', () => {
      if (!stillWatching) setActiveField('end');
    });

    stillWatchingBox.addEventListener('change', () => {
      stillWatching = stillWatchingBox.checked;
      if (stillWatching) {
        endDate = null;
        setActiveField('start');
      }
      updateChips();
      renderCalendars();
      updateSaveState();
    });

    prevBtn.addEventListener('click', () => {
      baseMonth--;
      if (baseMonth < 0) { baseMonth = 11; baseYear--; }
      renderCalendars();
    });

    nextBtn.addEventListener('click', () => {
      baseMonth++;
      if (baseMonth > 11) { baseMonth = 0; baseYear++; }
      renderCalendars();
    });

    monthSelect.addEventListener('change', () => {
      baseMonth = parseInt(monthSelect.value, 10);
      renderCalendars();
    });

    yearSelect.addEventListener('change', () => {
      baseYear = parseInt(yearSelect.value, 10);
      renderCalendars();
    });

    watchdatesCancelBtn.addEventListener('click', () => {
      watchdatesToggle.checked = false;
    });

    watchdatesSaveBtn.addEventListener('click', () => {
      if (watchdatesSaveBtn.disabled) return;
      watchDatesConfirmed = true;
      watchdatesToggle.checked = false;
      showAuthPrompt();
    });

    watchdatesToggle.addEventListener('change', () => {
      if (!watchdatesToggle.checked && !watchDatesConfirmed) {
        const watchedBtn = markasOptionsWrap && markasOptionsWrap.querySelector('[data-action="watched"]');
        if (watchedBtn) watchedBtn.classList.remove('-highlighted');
      }
      watchDatesConfirmed = false;
    });

    window.addEventListener('scroll', () => {
      if (watchdatesToggle.checked) watchdatesToggle.checked = false;
    }, { passive: true });

    actionsBox._openWatchDates = openWatchDates;
  }

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

      if (btn.dataset.action === 'watched' && actionsBox._openWatchDates) {
        markasOptionsWrap.querySelectorAll('.markas-option').forEach((el) => {
          el.classList.remove('-highlighted');
        });
        btn.classList.add('-highlighted');
        closeMarkAs();
        actionsBox._openWatchDates();
        return;
      }

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