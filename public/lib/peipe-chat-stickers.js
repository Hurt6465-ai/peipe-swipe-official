/* Peipe chat WEBM sticker picker + shortcode renderer v21 */
(function () {
  'use strict';

  if (window.__peipeChatStickersV21) return;
  window.__peipeChatStickersV21 = true;

  var NAMES = ['hello-01','hello-02','hello-03','hello-04','hello-05','hello-06','hello-07','hello-08','hello-09','hello-10'];

  function rel(path) {
    var base = (window.config && window.config.relative_path) || '';
    if (!path) return base || '';
    if (/^https?:\/\//i.test(path)) return path;
    if (base && path.indexOf(base + '/') === 0) return path;
    return base + path;
  }
  function esc(s) { return String(s || '').replace(/[&<>"']/g, function (ch) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[ch]; }); }
  function byId(id) { return document.getElementById(id); }
  function stickerUrl(name) { return rel('/plugins/nodebb-plugin-peipe-partners/swipe/greet/' + name + '.webm'); }

  function ensureStyle() {
    if (byId('peipe-chat-sticker-style')) return;
    var css = '' +
      '.peipe-chat-sticker-btn{font-size:20px!important;color:#4b5563!important}' +
      '.peipe-chat-sticker-mask{position:fixed;inset:0;z-index:2147483600;background:rgba(15,23,42,.22);opacity:0;pointer-events:none;transition:opacity .18s ease}' +
      '.peipe-chat-sticker-mask.show{opacity:1;pointer-events:auto}' +
      '.peipe-chat-sticker-sheet{position:fixed;left:10px;right:10px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:2147483601;border-radius:22px;padding:12px;background:rgba(255,255,255,.94);box-shadow:0 20px 60px rgba(15,23,42,.22);backdrop-filter:blur(16px) saturate(130%);transform:translateY(18px);opacity:0;pointer-events:none;transition:all .2s cubic-bezier(.2,.8,.2,1)}' +
      '.peipe-chat-sticker-sheet.show{transform:translateY(0);opacity:1;pointer-events:auto}' +
      '.peipe-chat-sticker-head{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 10px;color:#111827;font-weight:900;font-size:15px}' +
      '.peipe-chat-sticker-close{width:32px;height:32px;border:0;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:18px;font-weight:900}' +
      '.peipe-chat-sticker-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}' +
      '.peipe-chat-sticker-item{height:64px;border:1px solid rgba(79,70,229,.12);border-radius:18px;background:linear-gradient(135deg,rgba(248,250,252,.96),rgba(238,242,255,.9));display:grid;place-items:center;padding:3px}' +
      '.peipe-chat-sticker-item:active{transform:scale(.96);background:#eef2ff}' +
      '.peipe-chat-sticker-item video{width:56px;height:56px;object-fit:contain;background:transparent;display:block}' +
      '.peipe-greet-sticker-wrap{display:inline-flex;align-items:center;justify-content:center;width:128px;height:128px;vertical-align:middle;background:transparent!important;border:0!important;box-shadow:none!important}' +
      '.peipe-greet-sticker{width:128px;height:128px;display:block;object-fit:contain;background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0!important}';
    var st = document.createElement('style');
    st.id = 'peipe-chat-sticker-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function ensurePickerDom() {
    ensureStyle();
    if (byId('peipe-chat-sticker-sheet')) return;
    var grid = NAMES.map(function (name) {
      return '<button type="button" class="peipe-chat-sticker-item" data-sticker="' + name + '"><video src="' + esc(stickerUrl(name)) + '" autoplay loop muted playsinline preload="metadata"></video></button>';
    }).join('');
    document.body.insertAdjacentHTML('beforeend',
      '<div class="peipe-chat-sticker-mask"></div>' +
      '<section id="peipe-chat-sticker-sheet" class="peipe-chat-sticker-sheet" role="dialog">' +
        '<div class="peipe-chat-sticker-head"><span>动态贴纸</span><button type="button" class="peipe-chat-sticker-close">×</button></div>' +
        '<div class="peipe-chat-sticker-grid">' + grid + '</div>' +
      '</section>');
    document.querySelector('.peipe-chat-sticker-mask').addEventListener('click', closePicker);
    document.querySelector('.peipe-chat-sticker-close').addEventListener('click', closePicker);
    byId('peipe-chat-sticker-sheet').addEventListener('click', function (e) {
      var item = e.target.closest('.peipe-chat-sticker-item');
      if (!item) return;
      sendSticker(item.dataset.sticker || 'hello-01');
    });
  }

  function openPicker() {
    ensurePickerDom();
    document.querySelector('.peipe-chat-sticker-mask').classList.add('show');
    byId('peipe-chat-sticker-sheet').classList.add('show');
  }
  function closePicker() {
    var m = document.querySelector('.peipe-chat-sticker-mask');
    var s = byId('peipe-chat-sticker-sheet');
    if (m) m.classList.remove('show');
    if (s) s.classList.remove('show');
  }

  function installButton() {
    var toolbar = byId('cp-toolbar-inputs') || byId('cp-toolbar');
    if (!toolbar || byId('peipe-chat-sticker-btn')) return;
    var mediaBtn = byId('cp-media-btn');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'peipe-chat-sticker-btn';
    btn.className = 'cp-tool-btn peipe-chat-sticker-btn';
    btn.title = '动态贴纸';
    btn.setAttribute('aria-label', '动态贴纸');
    btn.textContent = '✨';
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openPicker(); });
    if (mediaBtn && mediaBtn.parentNode) mediaBtn.parentNode.insertBefore(btn, mediaBtn.nextSibling);
    else toolbar.insertBefore(btn, toolbar.firstChild);
  }

  function sendSticker(name) {
    closePicker();
    var input = byId('cp-input');
    var sendBtn = byId('cp-primary-btn');
    if (!input || !sendBtn) return;
    var shortcode = '[peipe-greet:' + name + ']';
    var translateToggle = byId('cp-send-translate-toggle');
    var restoreTranslate = translateToggle && translateToggle.classList.contains('active');
    if (restoreTranslate) translateToggle.click();
    input.value = shortcode;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(function () {
      sendBtn.click();
      if (restoreTranslate) setTimeout(function () { translateToggle.click(); }, 650);
    }, 40);
  }

  function greetStickerNode(name) {
    var wrap = document.createElement('span');
    wrap.className = 'peipe-greet-sticker-wrap';
    wrap.setAttribute('data-peipe-greet-rendered', name);
    wrap.innerHTML = '<video class="peipe-greet-sticker" src="' + esc(stickerUrl(name)) + '" autoplay loop muted playsinline preload="metadata"></video>';
    return wrap;
  }

  function renderShortcodes(root) {
    root = root || document.body;
    if (!root || root.nodeType !== 1) return;
    var deny = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|VIDEO|CANVAS)$/;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node || !node.nodeValue || node.nodeValue.indexOf('[peipe-greet:') === -1) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        while (p && p !== root.parentNode) {
          if (p.nodeType === 1) {
            if (deny.test(p.tagName || '')) return NodeFilter.FILTER_REJECT;
            if (p.classList && (p.classList.contains('peipe-greet-sticker-wrap') || p.isContentEditable)) return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue || '';
      var re = /\[peipe-greet:(hello-(?:0[1-9]|10))\]/ig;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        frag.appendChild(greetStickerNode(m[1].toLowerCase()));
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode && node.parentNode.replaceChild(frag, node);
    });
  }

  function tick() { installButton(); renderShortcodes(document.body); }
  function boot() {
    ensureStyle();
    tick();
    var obs = new MutationObserver(function (mutations) {
      installButton();
      mutations.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes || [], function (node) {
          if (node && node.nodeType === 1) renderShortcodes(node);
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('action:ajaxify.end', function () { setTimeout(tick, 120); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
