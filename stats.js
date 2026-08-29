// stats.js — data + engine behind 2026stats.html
//
// STATS_YEARS is now built live from SHOWS (shows.js) — same pattern as
// journal.html's JOURNAL object. Add, edit, or remove a show's
// journalYear/journalOrder in shows.js and it's reflected here
// automatically. Nothing to maintain in this file.
//
// Everything past that — hours watched, episodes, seasons, and the
// platform / genre / creator breakdowns — is computed live from TMDB,
// the same client-side pattern sort.js already uses for rating/popularity
// (find-by-imdb -> fetch /tv/{id} -> cache in localStorage).

var STATS_YEARS = (function () {
  // Built live from SHOWS (shows.js) — same journalYear/journalOrder
  // fields journal.html already uses. Nothing to maintain here: add,
  // edit, or remove shows in shows.js only, and this stays in sync.
  var byYear = {};
  SHOWS.filter(function (s) { return !!s.journalYear; })
    .sort(function (a, b) { return a.journalOrder - b.journalOrder; })
    .forEach(function (s) {
      (byYear[s.journalYear] = byYear[s.journalYear] || []).push({ title: s.title, imdb: s.imdb });
    });
  return byYear;
})();

(function (global) {
  'use strict';

  // Same v3 TMDB key already used across the rest of the site (search.js,
  // sort.js, postershow.html, home.html) — client-side, fine for personal use.
  var TMDB_API_KEY = '6cb6e1dc603bc65ffb6198489d5bc5b7';
  var TMDB_BASE = 'https://api.themoviedb.org/3';
  var CACHE_PREFIX = 'tvbox:stats:';
  var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — show metadata barely changes

  var DEFAULT_RUNTIME_MIN = 45; // fallback when TMDB has no episode_run_time on file

  var EMPTY_RECORD = Object.freeze({
    episodes: 0,
    seasons: 0,
    minutes: 0,
    genres: [],
    networks: [],
    creators: []
  });

  // ------------------------------------------------------------------
  // Cache
  // ------------------------------------------------------------------

  function readCache(imdbId) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + imdbId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || (Date.now() - parsed.ts) > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(imdbId, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + imdbId, JSON.stringify({ data: data, ts: Date.now() }));
    } catch (e) {
      // storage full / private browsing — just skip caching
    }
  }

  // ------------------------------------------------------------------
  // TMDB fetch + normalize
  // ------------------------------------------------------------------

  function normalizeShow(show) {
    if (!show) return EMPTY_RECORD;

    var episodes = show.number_of_episodes || 0;
    var seasons = show.number_of_seasons || 0;
    var runtimes = show.episode_run_time || [];
    var avgRuntime = runtimes.length
      ? runtimes.reduce(function (a, b) { return a + b; }, 0) / runtimes.length
      : DEFAULT_RUNTIME_MIN;

    var genres = (show.genres || []).map(function (g) { return g.name; });
    var networks = (show.networks || []).map(function (n) { return n.name; });
    var creators = (show.created_by || []).map(function (c) { return c.name; });

    return {
      episodes: episodes,
      seasons: seasons,
      minutes: episodes * avgRuntime,
      genres: genres.length ? genres : ['Unspecified'],
      networks: networks.length ? networks : ['Independent / Other'],
      creators: creators.length ? creators : ['Unattributed']
    };
  }

  function fetchShowRecord(imdbId) {
    var cached = readCache(imdbId);
    if (cached) return Promise.resolve(cached);

    var findUrl = TMDB_BASE + '/find/' + encodeURIComponent(imdbId) +
      '?api_key=' + TMDB_API_KEY + '&external_source=imdb_id';

    return fetch(findUrl)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (found) {
        var match = found && found.tv_results && found.tv_results[0];
        if (!match) return null;
        return fetch(TMDB_BASE + '/tv/' + match.id + '?api_key=' + TMDB_API_KEY)
          .then(function (res) { return res.ok ? res.json() : null; });
      })
      .then(function (show) {
        var record = normalizeShow(show);
        writeCache(imdbId, record);
        return record;
      })
      .catch(function () {
        return EMPTY_RECORD;
      });
  }

  // Small concurrency cap so a year with 7-8 shows doesn't fire everything
  // at once — same shape as sort.js's fetchAllTmdbInfo.
  function fetchAll(imdbIds) {
    var CONCURRENCY = 5;
    var queue = imdbIds.slice();
    var results = {};

    function worker() {
      var id = queue.shift();
      if (!id) return Promise.resolve();
      return fetchShowRecord(id).then(function (record) {
        results[id] = record;
        return worker();
      });
    }

    var workers = [];
    for (var i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
      workers.push(worker());
    }
    return Promise.all(workers).then(function () { return results; });
  }

  // ------------------------------------------------------------------
  // Aggregation
  // ------------------------------------------------------------------

  function aggregate(showList, records) {
    var summary = {
      hours: 0,
      episodes: 0,
      seasons: 0,
      showCount: showList.length,
      platforms: {},
      genres: {},
      creators: {}
    };

    showList.forEach(function (entry) {
      var r = records[entry.imdb] || EMPTY_RECORD;
      var hours = r.minutes / 60;

      summary.hours += hours;
      summary.episodes += r.episodes;
      summary.seasons += r.seasons;

      // Platforms — a show's watched hours are split evenly across every
      // network credited on it (almost always just one).
      var platformShare = hours / r.networks.length;
      r.networks.forEach(function (name) {
        summary.platforms[name] = (summary.platforms[name] || 0) + platformShare;
      });

      // Genres — likewise, hours split evenly across the show's genres.
      var genreShare = hours / r.genres.length;
      r.genres.forEach(function (name) {
        summary.genres[name] = (summary.genres[name] || 0) + genreShare;
      });

      // Creators — the show's *episode count* split evenly across every
      // credited creator (TMDB doesn't expose a per-episode director
      // without an extra call per season, so the show's creator(s) is
      // the closest reliable signal of "whose work you watched").
      var creatorShare = r.episodes / r.creators.length;
      r.creators.forEach(function (name) {
        summary.creators[name] = (summary.creators[name] || 0) + creatorShare;
      });
    });

    return summary;
  }

  // Turns a { name: value } bucket into a sorted array, folding anything
  // past `cap` entries into a single trailing "Other" bucket.
  function toRanked(bucket, cap) {
    var list = Object.keys(bucket)
      .map(function (name) { return { name: name, value: bucket[name] }; })
      .sort(function (a, b) { return b.value - a.value; });

    if (!cap || list.length <= cap) return list;

    var head = list.slice(0, cap - 1);
    var tail = list.slice(cap - 1);
    var otherTotal = tail.reduce(function (sum, item) { return sum + item.value; }, 0);
    head.push({ name: 'Other', value: otherTotal });
    return head;
  }

  global.TVStats = {
    fetchAll: fetchAll,
    aggregate: aggregate,
    toRanked: toRanked
  };
})(window);
