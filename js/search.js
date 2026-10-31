(function () {
  var TMDB_BASE = 'https://api.themoviedb.org/3';
  var TMDB_API_KEYS = [
    '6cb6e1dc603bc65ffb6198489d5bc5b7',
    '2e7b2fe7002c21f45f08c0a03aa9df52',
    '51952b66efcd80289c3ba5f8f8044e6a'
  ];
  function tmdbFetch(path, params, signal) {
    return new Promise(function (resolve, reject) {
      var controllers = [];
      var failures = 0;
      var settled = false;
      var bestError = null;
      var sep = path.indexOf('?') > -1 ? '&' : '?';
      var extra = params ? '&' + params : '';
      function isAuthError(err) {
        return !!err && (err.status === 401 || err.status === 403);
      }
      function abortAll(exceptIndex) {
        controllers.forEach(function (c, i) {
          if (c && i !== exceptIndex) c.abort();
        });
      }
      if (signal) {
        if (signal.aborted) {
          var abortErr = new Error('Aborted');
          abortErr.name = 'AbortError';
          reject(abortErr);
          return;
        }
        signal.addEventListener('abort', function () {
          if (settled) return;
          settled = true;
          abortAll(-1);
          var e = new Error('Aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }
      function onFail(err) {
        if (settled) return;
        failures++;
        if (!bestError || (isAuthError(bestError) && !isAuthError(err))) bestError = err;
        if (failures === TMDB_API_KEYS.length) {
          settled = true;
          reject(bestError);
        }
      }
      TMDB_API_KEYS.forEach(function (key, index) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        controllers.push(controller);
        fetch(
          TMDB_BASE + path + sep + 'api_key=' + key + extra,
          controller ? { signal: controller.signal } : undefined
        )
          .then(function (res) {
            if (!res.ok) {
              var err = new Error('TMDB request failed (' + res.status + ')');
              err.status = res.status;
              throw err;
            }
            return res.json();
          })
          .then(function (data) {
            if (settled) return;
            settled = true;
            abortAll(index);
            resolve(data);
          })
          .catch(onFail);
      });
    });
  }
  var IMG_BASE = 'https://image.tmdb.org/t/p/w154';
  var SAIF = {
    name: 'Saif',
    href: '/u/saif/',
    photo: 'https://raw.githubusercontent.com/osaiif/r/main/r.webp'
  };
  var ROLE_LABELS = {
    Acting: 'Actor',
    Directing: 'Director',
    Writing: 'Writer',
    Production: 'Producer',
    Editing: 'Editor',
    Creator: 'Creator',
    Camera: 'Cinematographer',
    Sound: 'Composer'
  };
  var PEOPLE_LIMIT = 6;
  function slugify(name) {
    var s = String(name || '');
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function personPath(name, id) {
    var base = slugify(name);
    return '/p/' + (base ? base + '-' + id : String(id));
  }
  function normalize(str) {
    var s = String(str || '');
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function nameMatches(name, query) {
    var tokens = normalize(query).split(' ').filter(Boolean);
    if (!tokens.length) return false;
    var hay = normalize(name);
    return tokens.every(function (t) { return hay.indexOf(t) !== -1; });
  }
  function matchesSaif(query) {
    var t = String(query || '').trim().toLowerCase().replace(/^@/, '');
    return t.length >= 3 && ('saif'.indexOf(t) === 0 || t === 'osaif');
  }
  function firstLetter(name) {
    var chars = Array.from(String(name || '').trim());
    return chars.length ? chars[0].toUpperCase() : '';
  }
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
  var LOADING_HTML = '<div class="loading-shimmer">' + SPINNER_HTML + '</div>';
  function clearResults() {
    resultsContainer.innerHTML = '';
  }
  function yearFromDate(dateStr) {
    if (!dateStr) return '';
    return dateStr.slice(0, 4);
  }
  var STAR_ICON_SVG =
    '<svg class="star-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.75l2.87 6.13 6.63.7-4.93 4.6 1.32 6.62L12 17.9l-5.89 3.9 1.32-6.62-4.93-4.6 6.63-.7L12 2.75z"></path></svg>';
  function formatRating(voteAverage, voteCount) {
    if (!voteAverage || !voteCount) return '';
    return voteAverage.toFixed(1);
  }
  function buildCard(show) {
    var item = document.createElement('a');
    item.className = 'result-item';
    item.href = '/show/?id=' + show.id;
    var posterSrc = show.poster_path
      ? IMG_BASE + show.poster_path
      : 'poster-placeholder.jpg';
    var rating = formatRating(show.vote_average, show.vote_count);
    item.innerHTML =
      '<img class="poster" src="' + posterSrc + '" alt="' + escapeHtml(show.name) + '" loading="lazy" decoding="async">' +
      '<div class="details">' +
        '<div class="header">' +
          '<h2 class="title">' + escapeHtml(show.name) + '</h2>' +
          '<div class="meta">' +
            (yearFromDate(show.first_air_date) ? '<span class="year numbers">' + yearFromDate(show.first_air_date) + '</span>' : '') +
            (rating ? '<span class="rating numbers">' + STAR_ICON_SVG + rating + '</span>' : '') +
          '</div>' +
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
      tmdbFetch('/tv/' + show.id)
        .catch(function () { return null; })
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
  function buildPersonCard(person) {
    var item = document.createElement('a');
    item.className = 'result-item person-item';
    item.href = personPath(person.name, person.id);
    var photo = person.profile_path ? IMG_BASE + person.profile_path : '';
    var role = ROLE_LABELS[person.known_for_department] || person.known_for_department || '';
    var known = (person.known_for || [])
      .map(function (k) { return k.name || k.title; })
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    item.innerHTML =
      '<span class="person-photo">' +
        '<span class="person-initial">' + escapeHtml(firstLetter(person.name)) + '</span>' +
        (photo ? '<img src="' + escapeHtml(photo) + '" alt="" loading="lazy" decoding="async">' : '') +
      '</span>' +
      '<div class="details">' +
        '<div class="header">' +
          '<h2 class="title">' + escapeHtml(person.name) + '</h2>' +
          '<div class="meta">' + (role ? '<span class="year">' + escapeHtml(role) + '</span>' : '') + '</div>' +
        '</div>' +
        (known ? '<p class="overview">Known for ' + escapeHtml(known) + '</p>' : '') +
      '</div>';
    return item;
  }
  function buildSaifCard() {
    var item = document.createElement('a');
    item.className = 'result-item person-item';
    item.href = SAIF.href;
    item.innerHTML =
      '<span class="person-photo">' +
        '<span class="person-initial">' + escapeHtml(firstLetter(SAIF.name)) + '</span>' +
        '<img src="' + escapeHtml(SAIF.photo) + '" alt="" decoding="async">' +
      '</span>' +
      '<div class="details">' +
        '<div class="header">' +
          '<h2 class="title">' + escapeHtml(SAIF.name) + '</h2>' +
          '<div class="meta"><span class="year">Profile</span></div>' +
        '</div>' +
        '<p class="overview">Favorites, ratings and stats.</p>' +
      '</div>';
    return item;
  }
  function buildGroupLabel(text) {
    var label = document.createElement('div');
    label.className = 'result-group-label';
    label.textContent = text;
    return label;
  }
  function renderResults(query, shows, people) {
    var showSaif = matchesSaif(query);
    clearResults();
    if (!showSaif && !people.length && !shows.length) {
      setStatus('');
      resultsContainer.innerHTML = '<p class="no-results">No results found for “' + escapeHtml(query) + '”.</p>';
      return;
    }
    setStatus('');
    var personFirst = false;
    if (people.length && nameMatches(people[0].name, query)) {
      if (!shows.length || !nameMatches(shows[0].name, query) ||
          (people[0].popularity || 0) > (shows[0].popularity || 0)) {
        personFirst = true;
      }
    }
    var peopleCount = people.length + (showSaif ? 1 : 0);
    var multiple = peopleCount > 0 && shows.length > 0;
    var fragment = document.createDocumentFragment();
    function addPeople() {
      if (!peopleCount) return;
      if (multiple) fragment.appendChild(buildGroupLabel('People'));
      if (showSaif) fragment.appendChild(buildSaifCard());
      people.forEach(function (p) { fragment.appendChild(buildPersonCard(p)); });
    }
    function addShows() {
      if (!shows.length) return;
      if (multiple) fragment.appendChild(buildGroupLabel('Shows'));
      shows.forEach(function (show) { fragment.appendChild(buildCard(show)); });
    }
    if (personFirst || showSaif) {
      addPeople();
      addShows();
    } else {
      addShows();
      addPeople();
    }
    resultsContainer.appendChild(fragment);
    if (shows.length) fetchCreators(shows);
  }
  function runSearch(query) {
    var requestId = ++currentRequestId;
    document.title = query.trim()
      ? query.trim() + ' | tvbox'
      : 'Search TV Shows ǀ tvbox';
    if (!query.trim()) {
      clearResults();
      setStatus('');
      return;
    }
    setStatus(LOADING_HTML);
    if (activeController) activeController.abort();
    var controller = new AbortController();
    activeController = controller;
    var q = encodeURIComponent(query.trim());
    var showsReq = tmdbFetch('/search/tv', 'query=' + q + '&include_adult=false&page=1', controller.signal);
    var peopleReq = tmdbFetch('/search/person', 'query=' + q + '&include_adult=false&page=1', controller.signal)
      .catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        return null;
      });
    Promise.all([showsReq, peopleReq])
      .then(function (res) {
        if (requestId !== currentRequestId) return;
        var shows = (res[0].results || []).filter(function (r) { return r.name; });
        var people = ((res[1] && res[1].results) || [])
          .filter(function (r) { return r.name && nameMatches(r.name, query); })
          .slice(0, PEOPLE_LIMIT);
        renderResults(query.trim(), shows, people);
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
