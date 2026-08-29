(function () {
  // TMDB API key — this is a v3 "API Key" (not a Bearer token), fine for
  // client-side calls. Note: anyone can view this in your page source, so
  // don't reuse this key for anything sensitive if you ever make the site
  // public. For a purely personal site this is normal and how TMDB expects
  // the v3 key to be used.
  var TMDB_API_KEY = '6cb6e1dc603bc65ffb6198489d5bc5b7';
  var TMDB_BASE = 'https://api.themoviedb.org/3';
  var IMG_BASE = 'https://image.tmdb.org/t/p/w154';

  var input = document.getElementById('home-search-input');
  var resultsContainer = document.getElementById('results-container');
  var statusEl = document.getElementById('search-status');

  var debounceTimer = null;
  var currentRequestId = 0; // guards against out-of-order responses
  var activeController = null; // lets us cancel an in-flight TMDB request

  function setStatus(content, isError) {
    if (!content) {
      statusEl.hidden = true;
      statusEl.innerHTML = '';
      statusEl.classList.remove('-error');
      return;
    }
    statusEl.hidden = false;
    statusEl.innerHTML = content;
    statusEl.classList.toggle('-error', !!isError);
  }

  var SPINNER_HTML =
    '<div class="spinner -inline"><div></div><div></div><div></div><div></div><div></div><div></div></div>';

  function clearResults() {
    resultsContainer.innerHTML = '';
  }

  function yearFromDate(dateStr) {
    if (!dateStr) return '';
    return dateStr.slice(0, 4);
  }

  function buildCard(show) {
    var item = document.createElement('a');
    item.className = 'result-item';
    item.href = '/show/?id=' + show.id;

    var posterSrc = show.poster_path
      ? IMG_BASE + show.poster_path
      : 'poster-placeholder.jpg';

    item.innerHTML =
      '<img class="poster" src="' + posterSrc + '" alt="' + escapeHtml(show.name) + '" loading="lazy" decoding="async">' +
      '<div class="details">' +
        '<div class="header">' +
          '<h2 class="title">' + escapeHtml(show.name) + '</h2>' +
          (yearFromDate(show.first_air_date) ? '<span class="year numbers">' + yearFromDate(show.first_air_date) + '</span>' : '') +
        '</div>' +
        (show.overview ? '<p class="overview">' + escapeHtml(show.overview) + '</p>' : '') +
        '<div class="creator">' +
          '<span>Created by</span>' +
          '<span class="creator-badge -loading" data-show-id="' + show.id + '">…</span>' +
        '</div>' +
      '</div>';

    return item;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // TMDB's /search/tv endpoint doesn't include creators, so we fetch each
  // show's details separately, in parallel, after the list is on screen.
  function fetchCreators(shows) {
    shows.forEach(function (show) {
      fetch(TMDB_BASE + '/tv/' + show.id + '?api_key=' + TMDB_API_KEY)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (details) {
          var badge = resultsContainer.querySelector('.creator-badge[data-show-id="' + show.id + '"]');
          if (!badge) return; // card no longer on screen (query changed)
          badge.classList.remove('-loading');
          var names = (details && details.created_by || []).map(function (c) { return c.name; });
          badge.textContent = names.length ? names.join(', ') : 'Unknown';
        })
        .catch(function () {
          var badge = resultsContainer.querySelector('.creator-badge[data-show-id="' + show.id + '"]');
          if (badge) {
            badge.classList.remove('-loading');
            badge.textContent = 'Unknown';
          }
        });
    });
  }

  function runSearch(query) {
    var requestId = ++currentRequestId;

    // Tab title reflects whatever's currently being searched.
    document.title = query.trim()
      ? 'Search: ' + query.trim() + ' — TVbox'
      : 'Search TV Shows — TVbox';

    if (!query.trim()) {
      clearResults();
      setStatus('');
      return;
    }

    setStatus(SPINNER_HTML);

    if (activeController) activeController.abort(); // drop any request still in flight
    var controller = new AbortController();
    activeController = controller;

    var url = TMDB_BASE + '/search/tv?api_key=' + TMDB_API_KEY +
      '&query=' + encodeURIComponent(query) +
      '&include_adult=false&page=1';

    fetch(url, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('TMDB request failed (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        if (requestId !== currentRequestId) return; // a newer search superseded this one

        var shows = (data.results || []).filter(function (r) { return r.name; });

        clearResults();

        if (!shows.length) {
          setStatus('');
          resultsContainer.innerHTML = '<p class="no-results">No shows found for “' + escapeHtml(query) + '”.</p>';
          return;
        }

        setStatus('');
        var fragment = document.createDocumentFragment();
        shows.forEach(function (show) {
          fragment.appendChild(buildCard(show));
        });
        resultsContainer.appendChild(fragment);

        fetchCreators(shows);
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return; // we cancelled this one ourselves
        if (requestId !== currentRequestId) return;
        clearResults();
        setStatus('Something went wrong: ' + err.message, true);
      });
  }

  input.addEventListener('input', function () {
    var query = input.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      runSearch(query);
    }, 350); // debounce so we don't hit TMDB on every keystroke
  });

  // Support ?q=... in the URL so search.html?q=michael works directly
  var params = new URLSearchParams(window.location.search);
  var initialQuery = params.get('q');
  if (initialQuery) {
    input.value = initialQuery;
    runSearch(initialQuery);
  }

  // Cancel any in-flight request the moment we navigate away. An open
  // fetch can be exactly what makes a browser skip its fast "instant back"
  // cache for this page and do a full, slow reload instead — which is what
  // made returning to a previous page feel like it was stuck loading.
  window.addEventListener('pagehide', function () {
    if (activeController) activeController.abort();
    clearTimeout(debounceTimer);
  });

  // If this page itself gets restored from that cache (e.g. after clicking
  // a result and hitting Back), it's repainted exactly as it was left. That
  // normally means the results are already sitting right there — no need
  // to touch the network again. Only step in if it was frozen mid-spinner
  // with nothing to show, which would otherwise leave it stuck forever.
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    var stillSpinning = !statusEl.hidden && statusEl.innerHTML.indexOf('spinner') !== -1;
    var hasResults = resultsContainer.children.length > 0;
    if (stillSpinning && !hasResults) {
      var restoredParams = new URLSearchParams(window.location.search);
      var restoredQuery = restoredParams.get('q') || '';
      input.value = restoredQuery;
      runSearch(restoredQuery);
    }
  });
})();
