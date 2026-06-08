{{- $musicFallbacks := partial "music-fallbacks.html" . -}}

(function () {
  var fallbackList = {{ $musicFallbacks | jsonify | safeJS }};
  var fallbackById = {};
  var defaultCover = '/images/youmu.png';
  var defaultMetingApi = 'https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r';

  window.pageDisposerQueue = window.pageDisposerQueue || [];
  window.registerPageDisposer = window.registerPageDisposer || function (disposer) {
    window.pageDisposerQueue.push(disposer);
  };

  fallbackList.forEach(function (item) {
    fallbackById[String(item.id)] = item;
  });

  function buildMetingUrl(server, type, id) {
    return defaultMetingApi
      .replace(':server', encodeURIComponent(server || 'netease'))
      .replace(':type', encodeURIComponent(type))
      .replace(':id', encodeURIComponent(id))
      .replace(':r', Date.now().toString());
  }

  function extractNeteaseId(audio) {
    if (!audio) return '';
    if (audio.id) return String(audio.id);

    var candidates = [audio.url, audio.lrc];
    for (var i = 0; i < candidates.length; i += 1) {
      var value = candidates[i];
      if (!value) continue;
      var match = String(value).match(/[?&]id=(\d+)/);
      if (match) return match[1];
    }

    return '';
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

  function normalizeAudio(audio) {
    var id = extractNeteaseId(audio);
    var normalized = {
      id: id,
      name: audio.name || '',
      artist: audio.artist || '',
      url: audio.url || '',
      cover: audio.cover || audio.pic || defaultCover,
      lrc: audio.lrc || ''
    };
    var fallback = fallbackById[id];

    if (fallback) {
      normalized.url = fallback.url;
      normalized.cover = fallback.cover || normalized.cover || defaultCover;
      normalized.lrc = fallback.lrc || normalized.lrc || '';
      normalized.fallback = true;
    }

    return normalized;
  }

  function getMetingAudio(server, type, id) {
    var fallback = fallbackAudio(id);
    return fetch(buildMetingUrl(server, type, id))
      .then(function (response) {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var tracks = Array.isArray(data) ? data : (data ? [data] : []);
        tracks = tracks.map(normalizeAudio).filter(function (track) {
          return track.url;
        });

        if (!tracks.length && fallback) {
          return [fallback];
        }

        return tracks;
      })
      .catch(function (error) {
        if (fallback) {
          console.warn('NetEase metadata failed, using local fallback for ' + id + ':', error);
          return [fallback];
        }
        throw error;
      });
  }

  window.musicFallbacks = fallbackById;
  window.getMetingAudio = getMetingAudio;

  window.createNeteaseAPlayer = function (container, options) {
    options = options || {};
    if (typeof APlayer === 'undefined') {
      return Promise.reject(new Error('APlayer is not available'));
    }

    return getMetingAudio(options.server || 'netease', options.type || 'song', options.id)
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
