var STATS_YEARS = (function () {
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

  var TMDB_API_KEY = '6cb6e1dc603bc65ffb6198489d5bc5b7';
  var TMDB_BASE = 'https://api.themoviedb.org/3';
  var TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w154';
  var CACHE_PREFIX = 'tvbox:stats:';
  var CACHE_VERSION = 2;
  var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  var DEFAULT_RUNTIME_MIN = 45;

  var EMPTY_RECORD = Object.freeze({
    episodes: 0,
    seasons: 0,
    minutes: 0,
    genres: [],
    networks: [],
    creators: [],
    countries: [],
    languages: [],
    rating: 0,
    votes: 0,
    popularity: 0,
    firstYear: null,
    lastYear: null,
    status: null,
    poster: null,
    name: null
  });

  function readCache(imdbId) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + imdbId);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== CACHE_VERSION || (Date.now() - parsed.ts) > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeCache(imdbId, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + imdbId, JSON.stringify({ data: data, ts: Date.now(), v: CACHE_VERSION }));
    } catch (e) {}
  }

  function yearFromDate(str) {
    if (!str || str.length < 4) return null;
    var y = parseInt(str.slice(0, 4), 10);
    return isNaN(y) ? null : y;
  }

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

    var countries = (show.production_countries || []).map(function (c) { return c.name; });
    if (!countries.length) countries = (show.origin_country || []).slice();

    var languages = (show.spoken_languages || []).map(function (l) { return l.english_name || l.name; });
    if (!languages.length && show.original_language) languages = [show.original_language.toUpperCase()];

    return {
      episodes: episodes,
      seasons: seasons,
      minutes: episodes * avgRuntime,
      genres: genres.length ? genres : ['Unspecified'],
      networks: networks.length ? networks : ['Independent / Other'],
      creators: creators.length ? creators : ['Unattributed'],
      countries: countries.length ? countries : ['Unspecified'],
      languages: languages.length ? languages : ['Unspecified'],
      rating: typeof show.vote_average === 'number' ? show.vote_average : 0,
      votes: show.vote_count || 0,
      popularity: show.popularity || 0,
      firstYear: yearFromDate(show.first_air_date),
      lastYear: yearFromDate(show.last_air_date),
      status: show.status || null,
      poster: show.poster_path ? (TMDB_POSTER_BASE + show.poster_path) : null,
      name: show.name || null
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

  function aggregate(showList, records) {
    var summary = {
      hours: 0,
      episodes: 0,
      seasons: 0,
      showCount: showList.length,
      platforms: {},
      genres: {},
      creators: {},
      countries: {},
      languages: {},
      ratingSum: 0,
      ratedShowCount: 0,
      avgRating: 0,
      details: []
    };

    showList.forEach(function (entry) {
      var r = records[entry.imdb] || EMPTY_RECORD;
      var hours = r.minutes / 60;

      summary.hours += hours;
      summary.episodes += r.episodes;
      summary.seasons += r.seasons;

      var platformShare = hours / r.networks.length;
      r.networks.forEach(function (name) {
        summary.platforms[name] = (summary.platforms[name] || 0) + platformShare;
      });

      var genreShare = hours / r.genres.length;
      r.genres.forEach(function (name) {
        summary.genres[name] = (summary.genres[name] || 0) + genreShare;
      });

      var creatorShare = r.episodes / r.creators.length;
      r.creators.forEach(function (name) {
        summary.creators[name] = (summary.creators[name] || 0) + creatorShare;
      });

      var countryShare = hours / r.countries.length;
      r.countries.forEach(function (name) {
        summary.countries[name] = (summary.countries[name] || 0) + countryShare;
      });

      var languageShare = hours / r.languages.length;
      r.languages.forEach(function (name) {
        summary.languages[name] = (summary.languages[name] || 0) + languageShare;
      });

      if (r.rating > 0) {
        summary.ratingSum += r.rating;
        summary.ratedShowCount += 1;
      }

      summary.details.push({
        title: entry.title,
        imdb: entry.imdb,
        hours: hours,
        episodes: r.episodes,
        seasons: r.seasons,
        rating: r.rating,
        votes: r.votes,
        popularity: r.popularity,
        firstYear: r.firstYear,
        lastYear: r.lastYear,
        status: r.status,
        poster: r.poster,
        networks: r.networks,
        genres: r.genres
      });
    });

    summary.avgRating = summary.ratedShowCount ? (summary.ratingSum / summary.ratedShowCount) : 0;

    return summary;
  }

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
