{{- $musicFallbacks := partial "music-fallbacks.html" . -}}

(function () {
  var fallbackList = {{ $musicFallbacks | jsonify | safeJS }};
  var fallbackById = {};
  var defaultCover = '/images/youmu.png';
  var neteaseApiBase = 'https://api.toolkal.com';
  var cachePrefix = 'ncm-api-cache:v2:';
  var audioCacheTTL = 10 * 60 * 1000;
  var playlistCacheTTL = 6 * 60 * 60 * 1000;
  var songDetailCacheTTL = 24 * 60 * 60 * 1000;
  var memoryCache = {};
  var pendingCache = {};

  window.pageDisposerQueue = window.pageDisposerQueue || [];
  window.registerPageDisposer = window.registerPageDisposer || function (disposer) {
    window.pageDisposerQueue.push(disposer);
  };

  fallbackList.forEach(function (item) {
    fallbackById[String(item.id)] = item;
  });

  function buildApiUrl(path, params) {
    var url = neteaseApiBase + path;
    var pairs = [];
    for (var key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      }
    }
    if (pairs.length) {
      url += '?' + pairs.join('&');
    }
    return url;
  }

  function fetchJson(url) {
    var controller = new AbortController();
    if (typeof window.registerPageDisposer === 'function') {
      window.registerPageDisposer(function () {
        try {
          controller.abort();
        } catch (error) {
          // ignore
        }
      });
    }

    return fetch(url, {
      credentials: 'omit',
      signal: controller.signal
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    });
  }

  function readCache(key) {
    var entry = memoryCache[key];
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    if (entry) {
      delete memoryCache[key];
    }

    try {
      var raw = window.localStorage && window.localStorage.getItem(cachePrefix + key);
      if (!raw) return null;

      entry = JSON.parse(raw);
      if (!entry || entry.expiresAt <= Date.now()) {
        window.localStorage.removeItem(cachePrefix + key);
        return null;
      }

      memoryCache[key] = entry;
      return entry.value;
    } catch (error) {
      return null;
    }
  }

  function writeCache(key, value, ttl) {
    var entry = {
      value: value,
      expiresAt: Date.now() + ttl
    };

    memoryCache[key] = entry;

    try {
      if (window.localStorage) {
        window.localStorage.setItem(cachePrefix + key, JSON.stringify(entry));
      }
    } catch (error) {
      // localStorage can be disabled or full; memory cache still helps this page.
    }
  }

  function withCache(key, ttl, loader) {
    var cached = readCache(key);
    if (cached) {
      return Promise.resolve(cached);
    }

    if (pendingCache[key]) {
      return pendingCache[key];
    }

    pendingCache[key] = loader().then(function (value) {
      writeCache(key, value, ttl);
      delete pendingCache[key];
      return value;
    }, function (error) {
      delete pendingCache[key];
      throw error;
    });

    return pendingCache[key];
  }

  function fetchJsonCached(key, ttl, url) {
    return withCache(key, ttl, function () {
      return fetchJson(url);
    });
  }

  function chunkArray(array, size) {
    var chunks = [];
    for (var i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  function fallbackAudio(id) {
    var fallback = fallbackById[String(id)];
    if (!fallback) return null;

    return {
      id: String(id),
      name: fallback.name || ('NetEase #' + id),
      artist: fallback.artist || '',
      url: fallback.url,
      cover: fallback.cover || defaultCover,
      lrc: fallback.lrc || '',
      fallback: true
    };
  }

  function normalizeAudioUrl(url) {
    if (!url) return '';
    url = String(url);

    // NetEase returns http CDN links; HTTPS pages may block them as mixed content.
    if (url.indexOf('http://') === 0) {
      return 'https://' + url.slice(7);
    }

    return url;
  }

  function getSongUrls(ids) {
    var chunks = chunkArray(ids, 100);
    return Promise.all(chunks.map(function (chunk) {
      var chunkIds = chunk.join(',');
      return fetchJsonCached(
        'song-url:' + chunkIds,
        audioCacheTTL,
        buildApiUrl('/song/url', { id: chunkIds })
      );
    })).then(function (results) {
      var urlMap = {};
      results.forEach(function (result) {
        if (result && result.data) {
          result.data.forEach(function (item) {
            if (item && item.id) {
              urlMap[String(item.id)] = normalizeAudioUrl(item.url || '');
            }
          });
        }
      });
      return urlMap;
    });
  }

  function normalizeSong(song, urlMap) {
    if (!song) return null;
    var id = String(song.id);
    var fallback = fallbackById[id];
    var url = (urlMap && urlMap[id]) || '';

    if (fallback) {
      url = fallback.url;
    }

    return {
      id: id,
      name: song.name || '',
      artist: (song.ar || []).map(function (a) { return a.name; }).join(' / '),
      url: url,
      cover: (fallback && fallback.cover) || (song.al && song.al.picUrl) || defaultCover,
      lrc: (fallback && fallback.lrc) || ''
    };
  }

  function normalizeLimit(value) {
    var limit = parseInt(value, 10);
    if (!isFinite(limit) || limit <= 0) return 50;
    return Math.min(limit, 100);
  }

  function loadPlaylistAudio(id, limit) {
    return fetchJsonCached(
      'playlist-track-all:' + id + ':' + limit,
      playlistCacheTTL,
      buildApiUrl('/playlist/track/all', { id: id, limit: limit })
    )
      .then(function (data) {
        var songs = (data && data.songs) || [];
        if (!songs.length) {
          throw new Error('Empty playlist');
        }
        var ids = songs.map(function (song) { return String(song.id); });
        return getSongUrls(ids).then(function (urlMap) {
          var tracks = songs.map(function (song) {
            return normalizeSong(song, urlMap);
          }).filter(function (track) {
            return track && track.url;
          });

          if (!tracks.length) {
            throw new Error('Empty playlist urls');
          }

          return tracks;
        });
      });
  }

  function getPlaylistAudio(id, options) {
    var limit = normalizeLimit(options && options.playlistLimit);
    return withCache('playlist-audio:' + id + ':' + limit, audioCacheTTL, function () {
      return loadPlaylistAudio(id, limit);
    });
  }

  function loadSongAudio(id) {
    return fetchJsonCached(
      'song-detail:' + id,
      songDetailCacheTTL,
      buildApiUrl('/song/detail', { ids: id })
    )
      .then(function (data) {
        var songs = (data && data.songs) || [];
        if (!songs.length) {
          throw new Error('Song not found');
        }
        var ids = songs.map(function (song) { return String(song.id); });
        return getSongUrls(ids).then(function (urlMap) {
          var tracks = songs.map(function (song) {
            return normalizeSong(song, urlMap);
          }).filter(function (track) {
            return track && track.url;
          });

          if (!tracks.length) {
            throw new Error('Empty song urls');
          }

          return tracks;
        });
      });
  }

  function getSongAudio(id) {
    return withCache('song-audio:' + id, audioCacheTTL, function () {
      return loadSongAudio(id);
    });
  }

  function getNeteaseAudio(type, id, options) {
    var fallback = fallbackAudio(id);
    var promise = type === 'playlist' ? getPlaylistAudio(id, options) : getSongAudio(id);

    return promise.catch(function (error) {
      if (fallback) {
        console.warn('NetEase metadata failed, using local fallback for ' + id + ':', error);
        return [fallback];
      }
      throw error;
    });
  }

  window.musicFallbacks = fallbackById;
  window.getNeteaseAudio = getNeteaseAudio;
  window.getMetingAudio = getNeteaseAudio;
  window.preloadNeteaseAudio = function (options) {
    options = options || {};
    return getNeteaseAudio(options.type || 'song', options.id, options).catch(function (error) {
      console.warn('NetEase audio preload failed:', error);
      return null;
    });
  };

  window.createNeteaseAPlayer = function (container, options) {
    options = options || {};
    if (typeof APlayer === 'undefined') {
      return Promise.reject(new Error('APlayer is not available'));
    }

    return getNeteaseAudio(options.type || 'song', options.id, options)
      .then(function (tracks) {
        if (!tracks.length) {
          throw new Error('Empty music playlist');
        }

        return new APlayer({
          container: container,
          fixed: !!options.fixed,
          autoplay: !!options.autoplay,
          order: options.order || 'list',
          loop: options.loop || 'all',
          volume: typeof options.volume === 'number' ? options.volume : 0.6,
          theme: options.theme || '#86efac',
          preload: options.preload || 'metadata',
          listFolded: options.listFolded !== false,
          mutex: options.mutex !== false,
          lrcType: typeof options.lrcType === 'number' ? options.lrcType : 3,
          audio: tracks
        });
      });
  };
})();
