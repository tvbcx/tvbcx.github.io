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

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LABELS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

document.addEventListener('DOMContentLoaded', () => {
  const actionsBox = document.querySelector('.show-actions');
  if (!actionsBox) return;

  const watchlistBtn      = document.getElementById('watchlist-btn');
  const markasBtnLabel    = document.getElementById('markas-btn-label');
  const markasToggle      = document.getElementById('markas-toggle');
  const markasOptionsWrap = document.getElementById('markas-options');
  const starsTrack        = document.getElementById('markas-stars-track');
  const starsFg           = document.getElementById('markas-stars-fg');

  if (watchlistBtn)   watchlistBtn.textContent  = WATCHLIST_BTN_LABEL;
  if (markasBtnLabel) markasBtnLabel.textContent = MARKAS_BTN_LABEL;

  if (markasOptionsWrap) {
    markasOptionsWrap.innerHTML = MARKAS_OPTIONS.map((opt) =>
      `<button type="button" class="markas-option" data-action="${opt.id}">${opt.label}</button>`
    ).join('');
  }

  const watchedMarkasBtn = markasOptionsWrap
    ? markasOptionsWrap.querySelector('[data-action="watched"]')
    : null;

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
      if (btn.dataset.action === 'watched') {
        openWatchedPopover();
      } else {
        showAuthPrompt();
      }
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
        pts.push((starStart + glyphWidth * 0.5) / totalWidth * 100);
        pts.push((i + 1) * slotWidth / totalWidth * 100);
      }
      return pts;
    }

    function snapToHalfStar(pct) {
      const pts = buildSnapPoints();
      if (!pts.length) return Math.round(pct / 10) * 10;

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

  const watchdateToggle  = document.getElementById('watchdate-toggle');
  const wdPopover         = document.getElementById('watchdate-popover');
  const wdShowNameEl      = document.getElementById('wd-show-name');
  const wdCalendarsWrap   = document.getElementById('wd-calendars');
  const wdCalendars       = {
    start: document.getElementById('wd-calendar-start'),
    end:   document.getElementById('wd-calendar-end'),
  };
  const wdFields = {
    start: document.getElementById('wd-field-start'),
    end:   document.getElementById('wd-field-end'),
  };
  const wdValues = {
    start: document.getElementById('wd-value-start'),
    end:   document.getElementById('wd-value-end'),
  };
  const wdQuickBtn  = document.getElementById('wd-quick-btn');
  const wdCancelBtn = document.getElementById('wd-cancel-btn');
  const wdSaveBtn   = document.getElementById('wd-save-btn');

  if (!watchdateToggle || !wdPopover || !wdCalendars.start || !wdCalendars.end) {
    return;
  }

  function todayMidnight() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const WD_TODAY = todayMidnight();

  const wd = {
    start: { date: null, view: new Date(WD_TODAY), level: 'days' },
    end:   { date: null, view: new Date(WD_TODAY), level: 'days' },
  };

  let wdActiveField = 'start';

  function wdFloorDate() {
    const meta = window.tvboxShowMeta;
    if (meta && meta.firstAirDate) {
      const parsed = new Date(meta.firstAirDate + 'T00:00:00');
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date(1900, 0, 1);
  }

  function wdMinDateFor(field) {
    const floor = wdFloorDate();
    if (field === 'end' && wd.start.date) {
      return wd.start.date > floor ? wd.start.date : floor;
    }
    return floor;
  }

  function wdMaxDateFor(field) {
    if (field === 'start' && wd.end.date) {
      return wd.end.date < WD_TODAY ? wd.end.date : WD_TODAY;
    }
    return WD_TODAY;
  }

  function sameDay(a, b) {
    return !!a && !!b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
  }

  function formatDate(d) {
    return MONTH_LABELS_SHORT[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function wdNavIcon(dir) {
    const path = dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6';
    return '<svg viewBox="0 0 24 24"><path d="' + path +
      '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function wdNavBtn(dir, disabled) {
    return '<button type="button" class="wd-cal-nav" data-nav="' + dir + '"' +
      (disabled ? ' disabled' : '') + '>' + wdNavIcon(dir) + '</button>';
  }

  function renderWdCalendar(field) {
    const container = wdCalendars[field];
    const state = wd[field];
    if (!container) return;

    let html = '<div class="wd-cal-head">';

    if (state.level === 'days') {
      const min = wdMinDateFor(field);
      const max = wdMaxDateFor(field);
      const viewYM = new Date(state.view.getFullYear(), state.view.getMonth(), 1);
      const prevMonthLastDay = new Date(viewYM.getFullYear(), viewYM.getMonth(), 0);
      const nextMonthFirstDay = new Date(viewYM.getFullYear(), viewYM.getMonth() + 1, 1);
      const prevDisabled = prevMonthLastDay < min;
      const nextDisabled = nextMonthFirstDay > max;

      html += wdNavBtn('prev', prevDisabled);
      html += '<button type="button" class="wd-cal-label" data-level-up>' +
        MONTH_LABELS_LONG[viewYM.getMonth()] + ' ' + viewYM.getFullYear() + '</button>';
      html += wdNavBtn('next', nextDisabled);
      html += '</div>';

      html += '<div class="wd-weekdays">' +
        WEEKDAY_LABELS.map((w) => '<span>' + w + '</span>').join('') + '</div>';

      html += '<div class="wd-days">';
      const firstWeekday = viewYM.getDay();
      for (let i = 0; i < firstWeekday; i++) {
        html += '<span class="wd-day -empty"></span>';
      }
      const daysInMonth = new Date(viewYM.getFullYear(), viewYM.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(viewYM.getFullYear(), viewYM.getMonth(), day);
        const disabled = d < min || d > max;
        const isToday = sameDay(d, WD_TODAY);
        const isSelected = sameDay(d, state.date);
        let inRange = false;
        if (wd.start.date && wd.end.date) {
          inRange = d > wd.start.date && d < wd.end.date;
        }
        const cls = ['wd-day'];
        if (disabled) cls.push('-disabled');
        if (isToday) cls.push('-today');
        if (isSelected) cls.push('-selected');
        if (inRange) cls.push('-inrange');
        html += '<button type="button" class="' + cls.join(' ') + '"' +
          (disabled ? ' disabled' : '') + ' data-day="' + d.getTime() + '">' + day + '</button>';
      }
      html += '</div>';

    } else if (state.level === 'months') {
      const min = wdMinDateFor(field);
      const max = wdMaxDateFor(field);
      const year = state.view.getFullYear();
      const prevDisabled = year <= min.getFullYear();
      const nextDisabled = year >= max.getFullYear();

      html += wdNavBtn('prev', prevDisabled);
      html += '<button type="button" class="wd-cal-label" data-level-up>' + year + '</button>';
      html += wdNavBtn('next', nextDisabled);
      html += '</div>';

      html += '<div class="wd-months">';
      for (let m = 0; m < 12; m++) {
        const monthStart = new Date(year, m, 1);
        const monthEnd = new Date(year, m + 1, 0);
        const disabled = monthEnd < min || monthStart > max;
        html += '<button type="button" class="wd-cell' + (disabled ? ' -disabled' : '') + '"' +
          (disabled ? ' disabled' : '') + ' data-month="' + m + '">' + MONTH_LABELS_SHORT[m] + '</button>';
      }
      html += '</div>';

    } else {
      const min = wdMinDateFor(field);
      const max = wdMaxDateFor(field);
      const pageStart = Math.floor(state.view.getFullYear() / 12) * 12;
      const prevDisabled = pageStart <= min.getFullYear();
      const nextDisabled = pageStart + 12 > max.getFullYear();

      html += wdNavBtn('prev', prevDisabled);
      html += '<span class="wd-cal-label">' + pageStart + ' – ' + (pageStart + 11) + '</span>';
      html += wdNavBtn('next', nextDisabled);
      html += '</div>';

      html += '<div class="wd-years">';
      for (let y = pageStart; y < pageStart + 12; y++) {
        const disabled = y < min.getFullYear() || y > max.getFullYear();
        html += '<button type="button" class="wd-cell' + (disabled ? ' -disabled' : '') + '"' +
          (disabled ? ' disabled' : '') + ' data-year="' + y + '">' + y + '</button>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function wdNavigate(field, dir) {
    const state = wd[field];
    if (state.level === 'days') {
      state.view = new Date(state.view.getFullYear(), state.view.getMonth() + dir, 1);
    } else if (state.level === 'months') {
      state.view = new Date(state.view.getFullYear() + dir, state.view.getMonth(), 1);
    } else {
      state.view = new Date(state.view.getFullYear() + dir * 12, state.view.getMonth(), 1);
    }
    renderWdCalendar(field);
  }

  function isWdDesktop() {
    return window.matchMedia('(min-width: 641px)').matches;
  }

  function setWdActiveField(field) {
    wdActiveField = field;
    Object.keys(wdFields).forEach((f) => {
      wdFields[f].classList.toggle('-active', f === field);
      wdCalendars[f].classList.toggle('-inactive', f !== field);
    });
  }

  function wdSelectDate(field, date) {
    wd[field].date = date;
    wd[field].view = new Date(date.getFullYear(), date.getMonth(), 1);
    wdValues[field].textContent = formatDate(date);

    if (field === 'start' && wd.end.date && wd.end.date < date) {
      wd.end.date = null;
      wdValues.end.textContent = 'Select date';
    }
    if (field === 'end' && wd.start.date && wd.start.date > date) {
      wd.start.date = null;
      wdValues.start.textContent = 'Select date';
    }

    renderWdCalendar('start');
    renderWdCalendar('end');

    if (field === 'start' && !isWdDesktop()) {
      setWdActiveField('end');
    }
  }

  Object.keys(wdCalendars).forEach((field) => {
    const el = wdCalendars[field];
    el.addEventListener('click', (e) => {
      const dayBtn      = e.target.closest('[data-day]');
      const monthBtn     = e.target.closest('[data-month]');
      const yearBtn       = e.target.closest('[data-year]');
      const navBtn         = e.target.closest('[data-nav]');
      const levelUpBtn      = e.target.closest('[data-level-up]');

      if (dayBtn) {
        wdSelectDate(field, new Date(parseInt(dayBtn.getAttribute('data-day'), 10)));
      } else if (monthBtn) {
        const m = parseInt(monthBtn.getAttribute('data-month'), 10);
        wd[field].view = new Date(wd[field].view.getFullYear(), m, 1);
        wd[field].level = 'days';
        renderWdCalendar(field);
      } else if (yearBtn) {
        const y = parseInt(yearBtn.getAttribute('data-year'), 10);
        wd[field].view = new Date(y, wd[field].view.getMonth(), 1);
        wd[field].level = 'months';
        renderWdCalendar(field);
      } else if (navBtn && !navBtn.disabled) {
        wdNavigate(field, navBtn.getAttribute('data-nav') === 'next' ? 1 : -1);
      } else if (levelUpBtn) {
        wd[field].level = wd[field].level === 'days' ? 'months' : 'years';
        renderWdCalendar(field);
      }
    });
  });

  wdFields.start.addEventListener('click', () => setWdActiveField('start'));
  wdFields.end.addEventListener('click', () => setWdActiveField('end'));

  if (wdQuickBtn) {
    wdQuickBtn.addEventListener('click', () => {
      wd.start.date = null;
      wd.end.date = null;
      wdValues.start.textContent = 'Select date';
      wdValues.end.textContent = 'Select date';

      if (watchedMarkasBtn) watchedMarkasBtn.classList.add('-selected');
      closeWatchedPopover();
      showAuthPrompt();
    });
  }

  function openWatchedPopover() {
    const titleEl = document.getElementById('show-title');
    if (wdShowNameEl) {
      wdShowNameEl.textContent =
        (titleEl && titleEl.textContent) ||
        (window.tvboxShowMeta && window.tvboxShowMeta.name) ||
        'this show';
    }
    setWdActiveField('start');
    renderWdCalendar('start');
    renderWdCalendar('end');
    watchdateToggle.checked = true;
  }

  function closeWatchedPopover() {
    watchdateToggle.checked = false;
  }

  if (wdCancelBtn) {
    wdCancelBtn.addEventListener('click', () => {
      closeWatchedPopover();
    });
  }

  if (wdSaveBtn) {
    wdSaveBtn.addEventListener('click', () => {
      if (watchedMarkasBtn) watchedMarkasBtn.classList.add('-selected');
      closeWatchedPopover();
      showAuthPrompt();
    });
  }

  window.addEventListener('resize', () => {
    setWdActiveField(wdActiveField);
  });

  renderWdCalendar('start');
  renderWdCalendar('end');

  window.addEventListener('scroll', () => {
    if (markasToggle && markasToggle.checked) markasToggle.checked = false;
    if (watchdateToggle && watchdateToggle.checked) watchdateToggle.checked = false;
  }, { passive: true });
});