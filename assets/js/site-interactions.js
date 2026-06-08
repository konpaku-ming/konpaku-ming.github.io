{{- $bgImages := resources.Match "backgrounds/*" -}}
{{- $backgroundUrls := slice -}}
{{- range $bgImages -}}
  {{- $backgroundUrls = $backgroundUrls | append .RelPermalink -}}
{{- end -}}
(function () {
  var s2tState = localStorage.getItem('s2t-state') || 'simplified';
  var s2tConverters = { cn2tw: null, initialized: false };
  var pageDisposers = [];
  var postedViewPaths = new Set();
  var viewsWorkerUrl = {{ site.Params.views.workerUrl | default "" | jsonify | safeJS }};
  var VIEW_BATCH_SIZE = 40;

  function addPageDisposer(disposer) {
    pageDisposers.push(disposer);
  }

  function addPageListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    addPageDisposer(function() {
      target.removeEventListener(type, handler, options);
    });
  }

  var queuedPageDisposers = window.pageDisposerQueue || [];
  window.pageDisposerQueue = queuedPageDisposers;
  window.registerPageDisposer = addPageDisposer;
  while (queuedPageDisposers.length) {
    addPageDisposer(queuedPageDisposers.shift());
  }

  function cleanupPage() {
    while (pageDisposers.length) {
      var dispose = pageDisposers.pop();
      try {
        dispose();
      } catch (e) {
        console.warn('Page cleanup failed', e);
      }
    }
  }

  function initS2TConverters() {
    if (typeof OpenCC === 'undefined') return false;
    if (s2tConverters.cn2tw) return true;
    try {
      s2tConverters.cn2tw = OpenCC.Converter({ from: 'cn', to: 'tw' });
      return true;
    } catch (e) {
      console.warn('OpenCC init failed', e);
      return false;
    }
  }

  var s2tNodes = [];

  function applyS2T() {
    if (s2tState !== 'traditional') return;
    if (!initS2TConverters()) {
      if (typeof OpenCC === 'undefined') {
        setTimeout(applyS2T, 200);
      }
      return;
    }

    var root = document.body;
    if (!root) return;

    s2tNodes = [];

    var treeWalker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          var parent = node.parentNode;
          if (!parent || !parent.tagName) return NodeFilter.FILTER_REJECT;
          if (parent.closest && (parent.closest('#s2t-toggle') || parent.closest('#bg-blur-toggle'))) {
            return NodeFilter.FILTER_REJECT;
          }
          var tag = parent.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'code' || tag === 'pre' || tag === 'textarea') {
            return NodeFilter.FILTER_REJECT;
          }
          if (!/[一-鿿]/.test(node.textContent)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    var nodes = [];
    var node;
    while (node = treeWalker.nextNode()) {
      if (!node._s2tOriginal) {
        node._s2tOriginal = node.textContent;
      }
      nodes.push(node);
    }

    var batchSize = 100;
    var index = 0;

    function processBatch() {
      var end = Math.min(index + batchSize, nodes.length);
      for (var i = index; i < end; i++) {
        nodes[i].textContent = s2tConverters.cn2tw(nodes[i]._s2tOriginal);
        s2tNodes.push(nodes[i]);
      }
      index = end;
      if (index < nodes.length) {
        requestAnimationFrame(processBatch);
      }
    }

    processBatch();
  }

  function restoreS2T() {
    for (var i = 0; i < s2tNodes.length; i++) {
      var node = s2tNodes[i];
      if (node._s2tOriginal) {
        node.textContent = node._s2tOriginal;
      }
    }
    s2tNodes = [];
  }

  function updateS2TButton() {
    var label = document.getElementById('s2t-label');
    var btn = document.getElementById('s2t-btn');
    if (!label || !btn) return;
    if (s2tState === 'traditional') {
      label.textContent = '简';
      btn.setAttribute('data-state', 'traditional');
    } else {
      label.textContent = '繁';
      btn.setAttribute('data-state', 'simplified');
    }
  }

  function toggleS2T() {
    if (typeof OpenCC === 'undefined') {
      setTimeout(toggleS2T, 200);
      return;
    }
    if (!initS2TConverters()) {
      console.warn('OpenCC init failed, cannot toggle S2T');
      return;
    }
    if (s2tState === 'simplified') {
      s2tState = 'traditional';
      localStorage.setItem('s2t-state', 'traditional');
      applyS2T();
    } else {
      s2tState = 'simplified';
      localStorage.setItem('s2t-state', 'simplified');
      restoreS2T();
    }
    updateS2TButton();
  }

  window.initS2T = function() {
    if (!s2tConverters.initialized) {
      var btn = document.getElementById('s2t-btn');
      if (btn) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          toggleS2T();
        });
      }
      s2tConverters.initialized = true;
    }
    updateS2TButton();
    if (s2tState === 'traditional') {
      applyS2T();
    }
  };

  var layoutState = localStorage.getItem('layout-state') || 'double';

  function applyLayout() {
    var articleContainer = document.querySelector('.article-with-sidebar');
    if (!articleContainer) return;
    if (layoutState === 'single') {
      articleContainer.classList.add('single-column');
    } else {
      articleContainer.classList.remove('single-column');
    }
  }

  function toggleLayout() {
    var articleContainer = document.querySelector('.article-with-sidebar');
    if (!articleContainer) return;
    if (layoutState === 'double') {
      articleContainer.classList.add('single-column');
      layoutState = 'single';
      localStorage.setItem('layout-state', 'single');
    } else {
      articleContainer.classList.remove('single-column');
      layoutState = 'double';
      localStorage.setItem('layout-state', 'double');
    }
  }

  window.initLayout = function() {
    if (window._layoutInitialized) {
      applyLayout();
      return;
    }
    window._layoutInitialized = true;
    var btn = document.getElementById('layout-btn');
    if (btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        toggleLayout();
      });
    }
    applyLayout();
  };

  function reExecuteScripts(container) {
    container.querySelectorAll('script[data-pjax-reexecute]').forEach(function (oldScript) {
      var newScript = document.createElement('script');
      for (var i = 0; i < oldScript.attributes.length; i++) {
        var attr = oldScript.attributes[i];
        newScript.setAttribute(attr.name, attr.value);
      }
      if (oldScript.textContent) newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  function initContent(container, options) {
    if (!container) return;
    options = options || {};
    if (typeof renderMathInElement === 'function') {
      try {
        renderMathInElement(container, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) { console.warn('KaTeX init failed', e); }
    }
    if (typeof Prism !== 'undefined') {
      try { Prism.highlightAllUnder(container); } catch (e) { console.warn('Prism init failed', e); }
    }
    if (typeof mediumZoom === 'function') {
      try { mediumZoom(container.querySelectorAll('img:not(.nozoom)')); } catch (e) { console.warn('mediumZoom init failed', e); }
    }
    if (options.reExecuteScripts) {
      reExecuteScripts(container);
    }
    initTOC();
    initPostTOCBar();
    initGiscus(container);
    updateViews(container);
    if (window.initS2T) window.initS2T();
    if (window.initLayout) window.initLayout();
  }

  function normalizeViewPath(path) {
    if (!path) return '';
    if (path.charAt(0) !== '/') {
      path = '/' + path;
    }
    return path.length > 1 ? path.replace(/\/$/, '') : path;
  }

  function getViewPath(node) {
    var path = node.getAttribute('data-view-path');
    if (!path) {
      var id = node.id.replace(/^views_/, '');
      path = '/' + id;
    }
    return normalizeViewPath(path);
  }

  function clearViewLoadingState(node) {
    node.classList.remove('animate-pulse', 'text-transparent', 'max-h-3', 'rounded-full', 'bg-neutral-300', 'dark:bg-neutral-400');
  }

  function getViewsWorkerEndpoint(route) {
    return viewsWorkerUrl.replace(/\/+$/, '') + route;
  }

  function formatViewCount(count) {
    var value = parseInt(count, 10);
    if (!isFinite(value) || value < 0) value = 0;
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function setViewNodes(nodes, count) {
    nodes.forEach(function (node) {
      node.innerText = formatViewCount(count);
      clearViewLoadingState(node);
    });
  }

  function setCurrentViewNodes(path, count) {
    var nodes = [];
    document.querySelectorAll("span[id^='views_']").forEach(function (node) {
      if (getViewPath(node) === path) {
        nodes.push(node);
      }
    });

    setViewNodes(nodes, count);
  }

  function collectViewNodes(root) {
    var nodes = root.querySelectorAll("span[id^='views_']");
    var paths = [];
    var nodesByPath = new Map();

    nodes.forEach(function (node) {
      var path = getViewPath(node);
      if (!path) return;

      if (!nodesByPath.has(path)) {
        nodesByPath.set(path, []);
        paths.push(path);
      }

      nodesByPath.get(path).push(node);
    });

    return {
      paths: paths,
      nodesByPath: nodesByPath
    };
  }

  function fetchPageJson(url, options) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var requestOptions = Object.assign({}, options || {});

    if (controller) {
      requestOptions.signal = controller.signal;
      addPageDisposer(function() {
        controller.abort();
      });
    }

    return fetch(url, requestOptions).then(function (res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json();
    });
  }

  function fetchSingleView(path, nodesByPath) {
    var nodes = nodesByPath.get(path) || [];

    return fetchPageJson(getViewsWorkerEndpoint('/views') + '?path=' + encodeURIComponent(path))
      .then(function (data) {
        setViewNodes(nodes, data.views);
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return;
        console.warn('Views fetch failed:', err);
        setViewNodes(nodes, 0);
      });
  }

  function fetchBatchViews(paths, nodesByPath) {
    var url = new URL(getViewsWorkerEndpoint('/views/batch'), window.location.href);
    paths.forEach(function (path) {
      url.searchParams.append('path', path);
    });

    return fetchPageJson(url.toString())
      .then(function (data) {
        var views = data.views || {};
        paths.forEach(function (path) {
          setViewNodes(nodesByPath.get(path) || [], views[path]);
        });
      })
      .catch(function (err) {
        if (err.name === 'AbortError') return;
        console.warn('Views batch fetch failed, falling back:', err);
        paths.forEach(function (path) {
          fetchSingleView(path, nodesByPath);
        });
      });
  }

  function updateViewNumbers(paths, nodesByPath) {
    if (!paths.length) return;

    if (paths.length === 1) {
      fetchSingleView(paths[0], nodesByPath);
      return;
    }

    for (var start = 0; start < paths.length; start += VIEW_BATCH_SIZE) {
      fetchBatchViews(paths.slice(start, start + VIEW_BATCH_SIZE), nodesByPath);
    }
  }

  function incrementCurrentViewOnce(currentPath, nodesByPath) {
    postedViewPaths.add(currentPath);

    fetch(getViewsWorkerEndpoint('/views') + '?path=' + encodeURIComponent(currentPath), { method: 'POST' })
      .then(function (res) {
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        setCurrentViewNodes(currentPath, data.views);
      })
      .catch(function (err) {
        postedViewPaths.delete(currentPath);
        console.warn('Views increment failed:', err);
        fetchSingleView(currentPath, nodesByPath);
      });
  }

  function updateViews(container) {
    var root = container || document;
    var viewNodes = collectViewNodes(root);
    var paths = viewNodes.paths;
    var nodesByPath = viewNodes.nodesByPath;

    if (!paths.length || !viewsWorkerUrl) return;

    var currentPath = normalizeViewPath(window.location.pathname);
    var hasCurrentPath = paths.some(function(path) {
      return path === currentPath;
    });
    var shouldIncrementCurrentPath = hasCurrentPath && !postedViewPaths.has(currentPath);
    var readPaths = shouldIncrementCurrentPath
      ? paths.filter(function(path) { return path !== currentPath; })
      : paths;

    updateViewNumbers(readPaths, nodesByPath);

    if (shouldIncrementCurrentPath) {
      incrementCurrentViewOnce(currentPath, nodesByPath);
    }
  }

  function initTOC() {
    var toc = document.querySelector('.post-toc-body #TableOfContents') || document.querySelector('.sidebar-toc-content #TableOfContents');
    if (!toc || toc._tocInit) return;
    toc._tocInit = true;

    var links = toc.querySelectorAll('a[href^="#"]');
    var anchors = document.querySelectorAll('.anchor');
    if (!links.length || !anchors.length) return;

    var tocIds = new Set();
    links.forEach(function (link) {
      tocIds.add(link.getAttribute('href').substring(1));
    });

    function update() {
      var threshold = window.scrollY + window.innerHeight * 0.33;
      var activeId = '';

      for (var i = anchors.length - 1; i >= 0; i--) {
        var rect = anchors[i].getBoundingClientRect();
        var top = rect.top + window.scrollY;
        if (top <= threshold && tocIds.has(anchors[i].id)) {
          activeId = anchors[i].id;
          break;
        }
      }

      if (!activeId && anchors.length) {
        for (var j = 0; j < anchors.length; j++) {
          if (tocIds.has(anchors[j].id)) {
            activeId = anchors[j].id;
            break;
          }
        }
      }

      links.forEach(function (link) {
        var isActive = link.getAttribute('href') === '#' + activeId;
        link.classList.toggle('active', isActive);
      });
    }

    addPageListener(window, 'scroll', update, { passive: true });
    addPageListener(window, 'hashchange', update, { passive: true });
    update();
  }

  function initPostTOCBar() {
    var bar = document.querySelector('.post-toc-bar');
    var details = document.querySelector('.post-toc-details');
    if (!bar || !details || bar._tocBarInit) return;
    bar._tocBarInit = true;

    var header = document.getElementById('single_header');
    var threshold = header ? header.offsetTop + header.offsetHeight : 200;

    var summary = details.querySelector('.post-toc-summary');
    if (summary) {
      addPageListener(summary, 'click', function (e) {
        e.preventDefault();
        details.classList.toggle('is-collapsed');
      });
    }

    function update() {
      var isSticky = window.scrollY > threshold;
      if (isSticky) {
        if (!bar.classList.contains('is-sticky')) {
          bar.classList.add('is-sticky');
          details.classList.add('is-collapsed');
        }
      } else {
        if (bar.classList.contains('is-sticky')) {
          bar.classList.remove('is-sticky');
          details.classList.remove('is-collapsed');
        }
      }
    }

    addPageListener(window, 'scroll', update, { passive: true });
    update();
  }

  function getGiscusTheme(wrapper) {
    var configuredTheme = wrapper.getAttribute('data-giscus-theme') || 'preferred_color_scheme';
    if (configuredTheme === 'preferred_color_scheme' || configuredTheme === 'auto') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return configuredTheme;
  }

  function initGiscus(container) {
    var root = container || document;
    var wrappers = root.querySelectorAll('.giscus-wrapper[data-giscus-repo-id][data-giscus-category-id]');
    if (!wrappers.length) return;

    wrappers.forEach(function(wrapper) {
      if (wrapper._giscusInitialized) return;
      wrapper._giscusInitialized = true;

      var script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      script.setAttribute('data-repo', wrapper.getAttribute('data-giscus-repo'));
      script.setAttribute('data-repo-id', wrapper.getAttribute('data-giscus-repo-id'));
      script.setAttribute('data-category', wrapper.getAttribute('data-giscus-category'));
      script.setAttribute('data-category-id', wrapper.getAttribute('data-giscus-category-id'));
      script.setAttribute('data-mapping', wrapper.getAttribute('data-giscus-mapping'));
      script.setAttribute('data-strict', wrapper.getAttribute('data-giscus-strict'));
      script.setAttribute('data-reactions-enabled', wrapper.getAttribute('data-giscus-reactions-enabled'));
      script.setAttribute('data-emit-metadata', wrapper.getAttribute('data-giscus-emit-metadata'));
      script.setAttribute('data-input-position', wrapper.getAttribute('data-giscus-input-position'));
      script.setAttribute('data-theme', getGiscusTheme(wrapper));
      script.setAttribute('data-lang', wrapper.getAttribute('data-giscus-lang'));
      script.setAttribute('data-loading', wrapper.getAttribute('data-giscus-loading'));
      script.setAttribute('crossorigin', 'anonymous');
      script.async = true;
      wrapper.appendChild(script);

      var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.attributeName !== 'class') return;
          var iframe = wrapper.querySelector('iframe.giscus-frame');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(
              { giscus: { setConfig: { theme: getGiscusTheme(wrapper) } } },
              'https://giscus.app'
            );
          }
        });
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      addPageDisposer(function() {
        observer.disconnect();
      });
    });
  }

  document.addEventListener('click', function (e) {
    var music = e.target.closest('a[href="#music"]');
    if (music) {
      e.preventDefault();
      var wrapper = document.getElementById('global-player-wrapper');
      if (wrapper) wrapper.style.display = 'block';
      var playerReady = window.initGlobalAPlayer
        ? window.initGlobalAPlayer()
        : Promise.resolve(window.globalAPlayer || (window.aplayers && window.aplayers[0]));

      playerReady.then(function (ap) {
        if (ap && ap.list && ap.list.audios && ap.list.audios.length) {
          var idx = Math.floor(Math.random() * ap.list.audios.length);
          ap.list.switch(idx);
          ap.seek(0);
          ap.play();
        }
      });
      return;
    }
    var search = e.target.closest('a[href="#search"]');
    if (search) {
      e.preventDefault();
      var btn = document.getElementById('search-button') || document.getElementById('search-button-mobile');
      if (btn) {
        btn.click();
        var q = document.getElementById('search-query');
        if (q) q.focus();
      }
    }
  });

  function bootstrapSwup() {
    if (typeof Swup === 'undefined') return;
    if (window._swup) return;
    var swup = new Swup({
      containers: ['#main-content'],
      animationSelector: false
    });
    swup.hooks.on('content:replace', function () {
      cleanupPage();
      initContent(document.getElementById('main-content'), { reExecuteScripts: true });
    });
    window._swup = swup;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initContent(document.body);
      bootstrapSwup();
    });
  } else {
    initContent(document.body);
    bootstrapSwup();
  }
})();

(function() {
  var backgroundImagesEnabled = {{ site.Params.backgroundImages.enabled | default false | jsonify | safeJS }};
  var backgroundUrls = {{ $backgroundUrls | jsonify | safeJS }};

  if (!backgroundImagesEnabled) {
    return;
  }

  // 验证配置
  if (!backgroundUrls || !Array.isArray(backgroundUrls) || backgroundUrls.length === 0) {
    console.warn('未配置背景图片或配置无效');
    return;
  }

  // 随机选择图片
  function selectRandomImage(urls) {
    if (!urls || urls.length === 0) return null;
    if (urls.length === 1) return urls[0];
    var index = Math.floor(Math.random() * urls.length);
    return urls[index];
  }

  // 应用背景图片
  function applyBackground(url) {
    var container = document.querySelector('.random-background-container');
    if (!container) {
      console.warn('背景容器不存在');
      return;
    }

    // 预加载图片
    var img = new Image();

    img.onload = function() {
      // 应用背景
      container.style.backgroundImage = 'url(' + url + ')';

      // 显示背景和覆盖层（浅色和深色模式都显示）
      container.classList.add('active');
      var overlay = document.querySelector('.random-background-overlay');
      if (overlay) {
        overlay.classList.add('active');
      }
    };

    img.onerror = function() {
      console.warn('背景图片加载失败:', url);
      // 优雅降级：保持默认背景
    };

    // 开始加载
    img.src = url;
  }

  // 监听主题切换（覆盖层颜色通过 CSS 自动切换，无需 JS 干预 active 状态）
  function observeTheme() {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.attributeName === 'class') {
          // 主题切换时覆盖层颜色由 CSS .dark .random-background-overlay.active 处理
          // 背景图片在深浅色模式下均保持显示，无需切换 active 状态
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  var bgBlurState = localStorage.getItem('bg-blur-state') || 'sharp';

  function applyBgBlur() {
    var container = document.querySelector('.random-background-container');
    var overlay = document.querySelector('.random-background-overlay');
    if (!container) return;
    if (bgBlurState === 'blurred') {
      container.classList.add('blurred');
      if (overlay) overlay.classList.add('blurred');
    } else {
      container.classList.remove('blurred');
      if (overlay) overlay.classList.remove('blurred');
    }
  }

  function toggleBgBlur() {
    var container = document.querySelector('.random-background-container');
    var overlay = document.querySelector('.random-background-overlay');
    if (!container) return;
    if (bgBlurState === 'blurred') {
      container.classList.remove('blurred');
      if (overlay) overlay.classList.remove('blurred');
      bgBlurState = 'sharp';
      localStorage.setItem('bg-blur-state', 'sharp');
    } else {
      container.classList.add('blurred');
      if (overlay) overlay.classList.add('blurred');
      bgBlurState = 'blurred';
      localStorage.setItem('bg-blur-state', 'blurred');
    }
  }

  // 初始化
  function init() {
    // 创建背景容器
    var container = document.createElement('div');
    container.className = 'random-background-container';
    document.body.insertBefore(container, document.body.firstChild);

    // 创建半透明覆盖层
    var overlay = document.createElement('div');
    overlay.className = 'random-background-overlay';
    document.body.insertBefore(overlay, container.nextSibling);

    // 随机选择图片
    var selectedUrl = selectRandomImage(backgroundUrls);
    if (selectedUrl) {
      applyBackground(selectedUrl);
    }

    // 监听主题切换
    observeTheme();

    // 应用背景模糊
    applyBgBlur();

    // 绑定背景模糊切换按钮
    var blurBtn = document.getElementById('bg-blur-btn');
    if (blurBtn) {
      blurBtn.addEventListener('click', function(e) {
        e.preventDefault();
        toggleBgBlur();
      });
    }
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
