(function () {
  var TMDB_API_KEY = '6cb6e1dc603bc65ffb6198489d5bc5b7';
  var TMDB_BASE = 'https://api.themoviedb.org/3';
  var IMG_BASE = 'https://image.tmdb.org/t/p/w154';

  var input = document.getElementById('home-search-input');
  var resultsContainer = document.getElementById('results-container');
  var statusEl = document.getElementById('search-status');

  var debounceTimer = null;
  var currentRequestId = 0;
  var activeController = null;

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

  function fetchCreators(shows) {
    shows.forEach(function (show) {
      fetch(TMDB_BASE + '/tv/' + show.id + '?api_key=' + TMDB_API_KEY)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (details) {
          var badge = resultsContainer.querySelector('.creator-badge[data-show-id="' + show.id + '"]');
          if (!badge) return;
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

    document.title = query.trim()
      ? 'Search: ' + query.trim() + ' — TVbox'
      : 'Search TV Shows — TVbox';

    if (!query.trim()) {
      clearResults();
      setStatus('');
      return;
    }

    setStatus(SPINNER_HTML);

    if (activeController) activeController.abort();
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
        if (requestId !== currentRequestId) return;

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
        if (err.name === 'AbortError') return;
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
    }, 350);
  });

  var params = new URLSearchParams(window.location.search);
  var initialQuery = params.get('q');
  if (initialQuery) {
    input.value = initialQuery;
    runSearch(initialQuery);
  }

  window.addEventListener('pagehide', function () {
    if (activeController) activeController.abort();
    clearTimeout(debounceTimer);
  });

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
