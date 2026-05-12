/* Peipe Partners Swipe v15 overlay
   - no floating comments
   - reviews require chat duration >= 24h (server enforced)
   - shared translator settings with topic detail: x-topic-translate-settings
   - card intro / review input / review content translation
   - location upload at most once per day
*/
(function () {
  'use strict';

  if (window.__peipeSwipeV15Overlay) return;
  window.__peipeSwipeV15Overlay = true;
  window.__peipeSwipeV14Overlay = true;

  var CONFIG = {
    apiBase: '/api/peipe-partners',
    geoKey: 'pps:geo:last-post-at',
    geoMaxAge: 24 * 60 * 60 * 1000,
    translateSettingsKey: 'x-topic-translate-settings',
    translateCacheMs: 3 * 24 * 60 * 60 * 1000,
    defaultPrompt: '你是专业论坛翻译助手。请把用户提供的内容从 {{sourceLang}} 翻译为 {{targetLang}}。保留原有语气、换行、链接、Markdown、代码块、用户名、表情和列表结构。只输出译文，不要解释。'
  };

  var LANGUAGE_META = {
    auto: { flag: '🌐', label: '自动检测' }, zh: { flag: '🇨🇳', label: '中文' }, 'zh-cn': { flag: '🇨🇳', label: '中文' }, 'zh-tw': { flag: '🇹🇼', label: '繁中' },
    en: { flag: '🇺🇸', label: 'English' }, my: { flag: '🇲🇲', label: 'မြန်မာ' }, mm: { flag: '🇲🇲', label: 'မြန်မာ' }, th: { flag: '🇹🇭', label: 'ไทย' }, vi: { flag: '🇻🇳', label: 'Tiếng Việt' }, vn: { flag: '🇻🇳', label: 'Tiếng Việt' }, ja: { flag: '🇯🇵', label: '日本語' }, ko: { flag: '🇰🇷', label: '한국어' }, ms: { flag: '🇲🇾', label: 'Bahasa Melayu' }, id: { flag: '🇮🇩', label: 'Bahasa Indonesia' }, fr: { flag: '🇫🇷', label: 'Français' }, de: { flag: '🇩🇪', label: 'Deutsch' }, es: { flag: '🇪🇸', label: 'Español' }, ru: { flag: '🇷🇺', label: 'Русский' }
  };
  var SOURCE_LANGUAGE_OPTIONS = ['auto', 'zh', 'en', 'my', 'th', 'vi', 'ja', 'ko'];
  var TARGET_LANGUAGE_OPTIONS = ['en', 'zh', 'my', 'th', 'vi', 'ja', 'ko', 'ms', 'id', 'fr', 'de', 'es', 'ru'];
  var METRICS = [
    { key: 'language', label: '语言帮助' },
    { key: 'reply', label: '回复速度' },
    { key: 'friendly', label: '友善程度' },
    { key: 'patient', label: '耐心程度' }
  ];

  var state = {
    targetUid: 0,
    targetName: '',
    viewerReviewId: '',
    translateSettings: null,
    longPressTimer: 0,
    langPickerRole: '',
    userMap: {},
    overlayFeedLoaded: false
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function norm(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
  function rel(path) {
    var base = (window.config && window.config.relative_path) || '';
    if (!path) return base || '';
    if (/^https?:\/\//i.test(path)) return path;
    if (base && path.indexOf(base + '/') === 0) return path;
    return base + path;
  }
  function csrfToken() { return (window.config && (window.config.csrf_token || window.config.csrfToken)) || (($('meta[name="csrf-token"]') || {}).content) || ''; }
  function escapeHtml(s) { return String(s || '').replace(/[&<>'"]/g, function (ch) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch]; }); }
  function isLoggedIn() { var u = (window.app && window.app.user) || {}; return Number(u.uid || 0) > 0; }
  function toast(msg) { if (window.app && app.alert) app.alert({ type: 'info', message: msg }); else if (window.app && app.alertSuccess) app.alertSuccess(msg); else window.alert(msg); }
  function error(msg) { if (window.app && app.alertError) app.alertError(msg); else window.alert(msg); }
  function safeJsonGet(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function safeJsonSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function apiFetch(url, options) {
    options = options || {};
    options.credentials = options.credentials || 'same-origin';
    options.headers = Object.assign({ accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' }, options.headers || {});
    return fetch(rel(url), options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        var payload = json && json.response ? json.response : json;
        if (!res.ok || payload && payload.ok === false) {
          throw new Error((payload && (payload.error || payload.message || payload.reason)) || '请求失败');
        }
        return payload || {};
      });
    });
  }

  function normalizeLangCode(code, fallback) {
    var raw = norm(code).toLowerCase().replace(/_/g, '-');
    if (!raw) return fallback || 'auto';
    var short = raw.split('-')[0];
    if (LANGUAGE_META[raw]) return raw;
    if (LANGUAGE_META[short]) return short;
    return fallback || raw;
  }
  function getDefaultTargetLang() { return (navigator.language || 'en').split('-')[0] || 'en'; }
  function getLangMeta(code) { var n = normalizeLangCode(code, 'auto'); return LANGUAGE_META[n] || LANGUAGE_META[n.split('-')[0]] || { flag: '🏳️', label: n || '未知语言' }; }
  function loadTranslateSettings() {
    var saved = safeJsonGet(CONFIG.translateSettingsKey, {}) || {};
    var targetLang = normalizeLangCode(saved.targetLang, getDefaultTargetLang());
    if (TARGET_LANGUAGE_OPTIONS.indexOf(targetLang) === -1) targetLang = 'en';
    return {
      sourceLang: normalizeLangCode(saved.sourceLang, 'auto'),
      targetLang: targetLang,
      provider: saved.provider === 'ai' ? 'ai' : 'google',
      aiEndpoint: saved.aiEndpoint || '',
      aiModel: saved.aiModel || '',
      aiApiKey: saved.aiApiKey || '',
      aiPrompt: saved.aiPrompt || CONFIG.defaultPrompt,
      temperature: Number.isFinite(Number(saved.temperature)) ? Number(saved.temperature) : 0.3
    };
  }
  function saveTranslateSettings(settings) { state.translateSettings = settings; safeJsonSet(CONFIG.translateSettingsKey, settings); }
  function normalizeAiEndpoint(url) { url = norm(url); if (!url) return ''; if (/\/(chat\/completions|responses)$/i.test(url)) return url; return url.replace(/\/+$/, '') + '/chat/completions'; }
  function buildAiPrompt(settings) { return String(settings.aiPrompt || CONFIG.defaultPrompt).replace(/{{\s*sourceLang\s*}}/gi, settings.sourceLang || 'auto').replace(/{{\s*targetLang\s*}}/gi, settings.targetLang || getDefaultTargetLang()); }
  function extractAiText(data) {
    if (data && Array.isArray(data.choices) && data.choices[0] && data.choices[0].message) {
      var content = data.choices[0].message.content;
      if (typeof content === 'string') return norm(content);
      if (Array.isArray(content)) return norm(content.map(function (item) { return item && (item.text || item.output_text || '') || ''; }).join(''));
    }
    if (data && typeof data.output_text === 'string') return norm(data.output_text);
    return '';
  }
  function translateCacheKey(text) {
    var s = state.translateSettings || loadTranslateSettings();
    var provider = s.provider === 'ai' ? 'ai:' + (s.aiModel || 'model') : 'google';
    return 'x-topic-v12-translate:' + provider + ':' + s.sourceLang + ':' + s.targetLang + ':' + encodeURIComponent(norm(text)).slice(0, 220);
  }
  function translateViaGoogle(text, settings) {
    var sl = settings.sourceLang && settings.sourceLang !== 'auto' ? settings.sourceLang : 'auto';
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + encodeURIComponent(sl) + '&tl=' + encodeURIComponent(settings.targetLang || 'en') + '&dt=t&q=' + encodeURIComponent(text);
    return fetch(url, { cache: 'force-cache' }).then(function (res) { if (!res.ok) throw new Error('google translate failed'); return res.json(); }).then(function (data) {
      var parts = Array.isArray(data && data[0]) ? data[0] : [];
      return parts.map(function (item) { return item && item[0] ? item[0] : ''; }).join('');
    });
  }
  function translateViaAI(text, settings) {
    if (!settings.aiEndpoint || !settings.aiModel || !settings.aiApiKey) return Promise.reject(new Error('AI translate not configured'));
    return fetch(normalizeAiEndpoint(settings.aiEndpoint), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + settings.aiApiKey },
      body: JSON.stringify({ model: settings.aiModel, temperature: settings.temperature, messages: [{ role: 'system', content: buildAiPrompt(settings) }, { role: 'user', content: text }] })
    }).then(function (res) { return res.json().catch(function () { return {}; }).then(function (json) { if (!res.ok) throw new Error(json.error && json.error.message || 'translate failed'); return json; }); }).then(function (json) {
      var out = extractAiText(json);
      if (!out) throw new Error('empty translation');
      return out;
    });
  }
  function translateText(text) {
    var clean = norm(text);
    if (!clean) return Promise.resolve('');
    var key = translateCacheKey(clean);
    var cached = safeJsonGet(key, null);
    if (cached && cached.expiresAt > Date.now() && typeof cached.text === 'string') return Promise.resolve(cached.text);
    var settings = state.translateSettings || loadTranslateSettings();
    var p = settings.provider === 'ai' ? translateViaAI(clean, settings) : translateViaGoogle(clean, settings);
    return p.then(function (out) { out = norm(out); if (out) safeJsonSet(key, { text: out, expiresAt: Date.now() + CONFIG.translateCacheMs }); return out; });
  }

  function langOptions(list, current) {
    return list.map(function (code) {
      var m = getLangMeta(code);
      return '<button type="button" class="ppst-lang-option' + (code === current ? ' active' : '') + '" data-code="' + code + '"><span>' + m.flag + '</span><b>' + escapeHtml(m.label) + '</b></button>';
    }).join('');
  }
  function renderTranslateSettings() {
    var s = state.translateSettings || loadTranslateSettings();
    var src = getLangMeta(s.sourceLang), tgt = getLangMeta(s.targetLang);
    return '<div class="ppst-mask ppst-settings-mask"></div><section class="ppst-settings" role="dialog">' +
      '<div class="ppst-head"><strong>AI翻译设置</strong><button type="button" class="ppst-settings-close">×</button></div>' +
      '<input type="hidden" class="ppst-source-lang" value="' + escapeHtml(s.sourceLang) + '"><input type="hidden" class="ppst-target-lang" value="' + escapeHtml(s.targetLang) + '">' +
      '<div class="ppst-preview-row"><button type="button" class="ppst-lang-trigger" data-role="source"><span>' + src.flag + '</span><b>' + escapeHtml(src.label) + '</b></button><i>⇄</i><button type="button" class="ppst-lang-trigger" data-role="target"><span>' + tgt.flag + '</span><b>' + escapeHtml(tgt.label) + '</b></button></div>' +
      '<input type="hidden" class="ppst-provider" value="' + escapeHtml(s.provider) + '"><div class="ppst-provider-tabs"><button type="button" data-provider="google" class="' + (s.provider === 'google' ? 'active' : '') + '">谷歌翻译</button><button type="button" data-provider="ai" class="' + (s.provider === 'ai' ? 'active' : '') + '">AI翻译</button></div>' +
      '<div class="ppst-ai ' + (s.provider === 'ai' ? 'show' : '') + '"><label>AI 接口<input class="ppst-ai-endpoint" value="' + escapeHtml(s.aiEndpoint) + '" placeholder="https://your-api.example.com/v1"></label><label>模型<input class="ppst-ai-model" value="' + escapeHtml(s.aiModel) + '" placeholder="gpt-4.1-mini / qwen / deepseek"></label><label>密钥<input class="ppst-ai-key" type="password" value="' + escapeHtml(s.aiApiKey) + '" placeholder="API Key"></label><label>提示词<textarea class="ppst-ai-prompt" rows="4">' + escapeHtml(s.aiPrompt) + '</textarea></label></div>' +
      '<div class="ppst-actions"><button type="button" class="ppst-settings-cancel">取消</button><button type="button" class="ppst-settings-save">保存</button></div>' +
      '</section><section class="ppst-lang-picker"><div class="ppst-head"><strong>选择语言</strong><button type="button" class="ppst-lang-close">×</button></div><div class="ppst-lang-list"></div></section><div class="ppst-mask ppst-lang-mask"></div>';
  }
  function ensureTranslateSettingsDom() {
    if ($('.ppst-settings')) return;
    document.body.insertAdjacentHTML('beforeend', renderTranslateSettings());
  }
  function updateSettingsPreview() {
    var box = $('.ppst-settings'); if (!box) return;
    var stored = state.translateSettings || loadTranslateSettings();
    var sourceInput = $('.ppst-source-lang', box);
    var targetInput = $('.ppst-target-lang', box);
    var providerInput = $('.ppst-provider', box);
    var sourceLang = normalizeLangCode(sourceInput && sourceInput.value || stored.sourceLang, 'auto');
    var targetLang = normalizeLangCode(targetInput && targetInput.value || stored.targetLang, getDefaultTargetLang());
    if (sourceInput) sourceInput.value = sourceLang;
    if (targetInput) targetInput.value = targetLang;
    if (providerInput && !providerInput.value) providerInput.value = stored.provider || 'google';
    var src = getLangMeta(sourceLang), tgt = getLangMeta(targetLang);
    var triggers = $$('.ppst-lang-trigger', box);
    if (triggers[0]) triggers[0].innerHTML = '<span>' + src.flag + '</span><b>' + escapeHtml(src.label) + '</b>';
    if (triggers[1]) triggers[1].innerHTML = '<span>' + tgt.flag + '</span><b>' + escapeHtml(tgt.label) + '</b>';
  }
  function openTranslateSettings() { ensureTranslateSettingsDom(); updateSettingsPreview(); $('.ppst-settings').classList.add('show'); $('.ppst-settings-mask').classList.add('show'); }
  function closeTranslateSettings() { var a = $('.ppst-settings'), b = $('.ppst-settings-mask'); if (a) a.classList.remove('show'); if (b) b.classList.remove('show'); }
  function openLangPicker(role) {
    state.langPickerRole = role;
    var current = role === 'source' ? $('.ppst-source-lang').value : $('.ppst-target-lang').value;
    $('.ppst-lang-list').innerHTML = langOptions(role === 'source' ? SOURCE_LANGUAGE_OPTIONS : TARGET_LANGUAGE_OPTIONS, current);
    $('.ppst-lang-picker').classList.add('show'); $('.ppst-lang-mask').classList.add('show');
  }
  function closeLangPicker() { var a = $('.ppst-lang-picker'), b = $('.ppst-lang-mask'); if (a) a.classList.remove('show'); if (b) b.classList.remove('show'); state.langPickerRole = ''; }
  function bindLongPress(el, cb) {
    if (!el || el.dataset.ppstLongBound === '1') return;
    el.dataset.ppstLongBound = '1';
    var sx = 0, sy = 0, fired = false;
    function point(e) {
      var t = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0] || e;
      return { x: Number(t.clientX || 0), y: Number(t.clientY || 0) };
    }
    function start(e) {
      var p = point(e); sx = p.x; sy = p.y; fired = false;
      clearTimeout(state.longPressTimer);
      state.longPressTimer = setTimeout(function () {
        fired = true;
        try { e.preventDefault && e.preventDefault(); } catch (err) {}
        cb(e);
      }, 560);
    }
    function move(e) {
      var p = point(e);
      if (Math.hypot(p.x - sx, p.y - sy) > 10) clearTimeout(state.longPressTimer);
    }
    function end(e) {
      clearTimeout(state.longPressTimer);
      if (fired) { try { e.preventDefault && e.preventDefault(); } catch (err) {} }
    }
    el.addEventListener('pointerdown', start, { passive: false });
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave', 'touchend', 'touchcancel'].forEach(function (n) { el.addEventListener(n, end, { passive: false }); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); cb(e); });
  }
  function getTextValue(el) {
    if (!el) return '';
    if (el.tagName && /^(TEXTAREA|INPUT)$/i.test(el.tagName)) return el.value || '';
    var text = el.classList && el.classList.contains('ppst-card-text') ? el.textContent : (el.dataset && el.dataset.originalText || el.textContent);
    return text || '';
  }
  function setTextValue(el, value) {
    if (!el) return;
    if (el.tagName && /^(TEXTAREA|INPUT)$/i.test(el.tagName)) el.value = value;
    else el.textContent = value;
  }
  function translateInto(targetEl, textEl) {
    if (!textEl) return;
    var original = norm(textEl.dataset.originalText || getTextValue(textEl));
    if (!original) return;
    if (textEl.dataset.translated === '1') {
      setTextValue(textEl, textEl.dataset.originalText || original);
      textEl.dataset.translated = '0';
      return;
    }
    targetEl.classList.add('loading');
    translateText(original).then(function (out) {
      if (!textEl.dataset.originalText) textEl.dataset.originalText = original;
      if (out) { setTextValue(textEl, out); textEl.dataset.translated = '1'; }
    }).catch(function () { error('翻译失败'); }).finally(function () { targetEl.classList.remove('loading'); });
  }

  function maybeAddCardTranslate(root) {
    var selectors = ['.pps-about', '.pps-bio', '.pps-intro', '.pps-description', '.pps-profile-intro', '.pps-text', '.pps-card-intro'];
    selectors.forEach(function (sel) {
      $$(sel, root).forEach(function (el) {
        if (el.dataset.ppstTranslate === '1') return;
        var original = norm(el.dataset.originalText || el.textContent);
        if (!original || original.length < 2) return;
        el.dataset.ppstTranslate = '1';
        el.dataset.originalText = original;
        el.classList.add('ppst-card-intro');
        el.innerHTML = '';
        var text = document.createElement('span');
        text.className = 'ppst-card-text';
        text.dataset.originalText = original;
        text.textContent = original;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ppst-inline-translate';
        btn.innerHTML = '<i class="fa-solid fa-language"></i>';
        btn.title = '翻译';
        el.appendChild(text);
        el.appendChild(document.createTextNode(' '));
        el.appendChild(btn);
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); translateInto(btn, text); });
        bindLongPress(btn, function () { openTranslateSettings(); });
      });
    });
  }

  function requestDailyLocation() {
    if (!navigator.geolocation) return;
    var last = Number(localStorage.getItem(CONFIG.geoKey) || 0);
    if (Date.now() - last < CONFIG.geoMaxAge) return;
    function go() {
      navigator.geolocation.getCurrentPosition(function (pos) {
        localStorage.setItem(CONFIG.geoKey, String(Date.now()));
        apiFetch(CONFIG.apiBase + '/location', {
          method: 'PUT',
          headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 0, source: 'swipe-v14' })
        }).catch(function () {});
      }, function () {}, { enableHighAccuracy: false, timeout: 9000, maximumAge: 24 * 60 * 60 * 1000 });
    }
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(function (p) { if (p.state !== 'denied') go(); }).catch(go);
    } else go();
  }

  function currentFeedMode() {
    var path = location.pathname || '';
    return /nearby/i.test(path) ? 'nearby' : 'recommend';
  }
  function rememberUsers(users) {
    (users || []).forEach(function (u) {
      if (u && u.uid) state.userMap[String(u.uid)] = u;
    });
  }
  function loadOverlayFeedOnce() {
    if (state.overlayFeedLoaded) return;
    state.overlayFeedLoaded = true;
    apiFetch(CONFIG.apiBase + '/swipe/feed?mode=' + encodeURIComponent(currentFeedMode()) + '&limit=36').then(function (json) {
      rememberUsers(json.users || []);
      patchDistance(document);
    }).catch(function () {});
  }
  function formatDistance(km) {
    km = Number(km || 0);
    if (!Number.isFinite(km) || km <= 0) return '';
    if (km < 0.5) return '500米内';
    if (km < 1) return Math.round(km * 1000) + '米';
    return Math.round(km) + 'km';
  }
  function distanceHtml(txt) {
    return '<span class="ppst-location-icon"><i class="fa-solid fa-location-dot"></i></span><span>' + escapeHtml(txt) + '</span>';
  }
  function findUserDataFrom(el) {
    var uid = findUidFrom(el);
    return uid ? state.userMap[String(uid)] || null : null;
  }
  function ensureDistanceChip(slide, txt) {
    if (!slide || !txt || slide.querySelector('.ppst-distance-chip')) return;
    var host = $('.pps-detail-row,.pps-meta-row,.pps-user-meta,.pps-info', slide) || slide;
    var chip = document.createElement('span');
    chip.className = 'ppst-distance-chip';
    chip.innerHTML = distanceHtml(txt);
    host.insertBefore(chip, host.firstChild || null);
  }
  function patchDistance(root) {
    $$('.pps-distance,.pps-location-distance,.pps-location,.pps-meta-distance', root).forEach(function (el) {
      if (el.dataset.ppstDistance === '1') return;
      el.dataset.ppstDistance = '1';
      var raw = el.dataset.distanceKm || el.dataset.km || (el.textContent.match(/[\d.]+/) || [''])[0];
      var txt = formatDistance(raw);
      if (txt) { el.classList.add('ppst-distance-chip'); el.innerHTML = distanceHtml(txt); }
    });
    $$('.swiper-slide,.pps-slide,.pps-card,.pps-slide-item', root).forEach(function (slide) {
      if (slide.dataset.ppstDistanceAdded === '1') return;
      var u = findUserDataFrom(slide);
      var txt = u && (u.distanceText || formatDistance(u.distanceKm));
      if (txt) { slide.dataset.ppstDistanceAdded = '1'; ensureDistanceChip(slide, txt); }
    });
  }

  function removeMetaFields(root) {
    $$('.pps-detail-chip,.pps-meta-chip,.pps-info span,.pps-user-meta span', root).forEach(function (el) {
      var txt = norm(el.textContent).toLowerCase();
      if (/^\d+(\.\d+)?\s*(cm|kg|厘米|公斤|千克)$/.test(txt)) el.remove();
    });
  }
  function moveGenderToAvatar(root) {
    $$('.pps-gender-icon,.pps-gender,.pps-sex,.pps-meta-gender', root).forEach(function (el) {
      if (el.closest('.pps-avatar-wrap,.pps-avatar-box')) return;
      var slide = el.closest('.swiper-slide,.pps-slide,.pps-card,.pps-slide-item') || root;
      var avatar = $('.pps-avatar-wrap,.pps-avatar-box,.pps-avatar-holder', slide);
      if (avatar && !avatar.querySelector('.ppst-avatar-gender')) {
        var badge = el.cloneNode(true);
        badge.classList.add('ppst-avatar-gender');
        avatar.appendChild(badge);
      }
      el.classList.add('ppst-hide-gender-source');
    });
  }
  function patchButtons(root) {
    $$('.pps-float-comments', root).forEach(function (el) { el.remove(); });

    // Some earlier builds do not have a review button in renderSlide.
    // Insert it next to the greet button so this overlay is complete even on older base files.
    $$('.pps-greet-btn', root).forEach(function (greet) {
      var host = greet.closest('.pps-side-actions') || greet.parentNode;
      if (host && !host.querySelector('.pps-comment-btn')) {
        var review = document.createElement('button');
        review.type = 'button';
        review.className = 'pps-comment-btn ppst-open-review';
        review.dataset.uid = greet.dataset.uid || String(findUidFrom(greet) || '');
        review.innerHTML = '<span class="ppst-action-icon">💬</span><b>看评价</b>';
        host.insertBefore(review, greet);
      }
    });

    $$('.pps-comment-btn', root).forEach(function (btn) {
      if (btn.dataset.ppstLabel === '1') return;
      btn.dataset.ppstLabel = '1';
      btn.innerHTML = '<span class="ppst-action-icon">💬</span><b>看评价</b>';
    });
    $$('.pps-greet-btn', root).forEach(function (btn) {
      if (btn.dataset.ppstLabel === '1') return;
      btn.dataset.ppstLabel = '1';
      btn.innerHTML = '<span class="ppst-action-icon">👋</span>';
    });
  }

  function findUidFrom(el) {
    var cur = el;
    while (cur && cur !== document.body) {
      var uid = cur.dataset && (cur.dataset.uid || cur.dataset.targetUid || cur.dataset.userUid || cur.dataset.authorUid);
      if (uid) return Number(uid || 0);
      var child = cur.querySelector && cur.querySelector('[data-uid],[data-target-uid],[data-user-uid],.pps-greet-btn');
      if (child && child.dataset) {
        uid = child.dataset.uid || child.dataset.targetUid || child.dataset.userUid;
        if (uid) return Number(uid || 0);
      }
      cur = cur.parentNode;
    }
    return 0;
  }
  function findNameFrom(el) {
    var slide = el.closest('.swiper-slide,.pps-slide,.pps-card,.pps-slide-item') || document;
    var nameEl = $('.pps-username,.pps-name,.pps-display-name,.username', slide);
    return norm(nameEl && nameEl.textContent) || 'TA';
  }
  function starRow(key, label, value) {
    value = Number(value || 0);
    var stars = '';
    for (var i = 1; i <= 5; i += 1) stars += '<button type="button" class="ppst-star ' + (i <= value ? 'active' : '') + '" data-key="' + key + '" data-value="' + i + '">★</button>';
    return '<div class="ppst-rating-row" data-key="' + key + '"><span>' + escapeHtml(label) + '</span><div class="ppst-stars">' + stars + '</div></div>';
  }
  function progressRow(label, avg) {
    avg = Number(avg || 0);
    var pct = Math.max(0, Math.min(100, avg / 5 * 100));
    return '<div class="ppst-progress-row"><div><span>' + escapeHtml(label) + '</span><b>' + (avg ? avg.toFixed(1) : '0.0') + '</b></div><i><em style="width:' + pct + '%"></em></i></div>';
  }
  function renderReviewItem(item) {
    item = item || {};
    var avatar = item.authorAvatar ? '<img src="' + escapeHtml(item.authorAvatar) + '" alt="">' : '<span>' + escapeHtml((item.authorName || '匿').slice(0, 1)) + '</span>';
    return '<div class="ppst-review-item" data-id="' + escapeHtml(item.id || '') + '">' +
      '<div class="ppst-review-avatar">' + avatar + '</div><div class="ppst-review-main"><div class="ppst-review-top"><b>' + escapeHtml(item.authorName || '匿名用户') + '</b><span>🌟' + Number(item.overall || 0).toFixed(1) + '</span></div>' +
      '<div class="ppst-review-content">' + escapeHtml(item.content || '') + '</div><button type="button" class="ppst-review-translate"><i class="fa-solid fa-language"></i></button></div></div>';
  }
  function renderReviewSheet(loading) {
    var sheet = $('.ppst-review-sheet');
    if (!sheet) {
      document.body.insertAdjacentHTML('beforeend', '<div class="ppst-mask ppst-review-mask"></div><section class="ppst-review-sheet" role="dialog"></section>');
      sheet = $('.ppst-review-sheet');
    }
    sheet.innerHTML = '<div class="ppst-review-head"><div><strong>语伴评价</strong><span>' + escapeHtml(state.targetName || '') + '</span></div><button type="button" class="ppst-review-close">×</button></div>' +
      '<div class="ppst-review-summary">' + (loading ? '加载中...' : '') + '</div>' +
      '<div class="ppst-review-list"></div>' +
      '<div class="ppst-review-editor"><div class="ppst-rating-box">' + METRICS.map(function (m) { return starRow(m.key, m.label, 0); }).join('') + '</div>' +
      '<label class="ppst-anon"><input type="checkbox" class="ppst-anonymous"> 匿名发布</label>' +
      '<div class="ppst-input-wrap"><textarea class="ppst-review-input" maxlength="240" placeholder="写一下真实感受，最多240字"></textarea><button type="button" class="ppst-input-translate"><i class="fa-solid fa-language"></i></button></div>' +
      '<div class="ppst-review-actions"><button type="button" class="ppst-review-submit">发布评价</button></div></div>';
  }
  function setRating(key, value) {
    $$('.ppst-star[data-key="' + key + '"]').forEach(function (btn) { btn.classList.toggle('active', Number(btn.dataset.value) <= Number(value)); });
  }
  function getRatings() {
    var out = {};
    METRICS.forEach(function (m) { out[m.key] = $$('.ppst-star.active[data-key="' + m.key + '"]').length; });
    return out;
  }
  function setRatings(ratings) { ratings = ratings || {}; METRICS.forEach(function (m) { setRating(m.key, Number(ratings[m.key] || 0)); }); }
  function openReview(uid, name) {
    if (!uid) return;
    state.targetUid = uid; state.targetName = name || 'TA'; state.viewerReviewId = '';
    renderReviewSheet(true);
    $('.ppst-review-mask').classList.add('show'); $('.ppst-review-sheet').classList.add('show');
    loadReviews(uid);
  }
  function closeReview() { var a = $('.ppst-review-mask'), b = $('.ppst-review-sheet'); if (a) a.classList.remove('show'); if (b) b.classList.remove('show'); state.targetUid = 0; }
  function loadReviews(uid) {
    apiFetch(CONFIG.apiBase + '/comments/' + encodeURIComponent(uid) + '?limit=40').then(function (json) {
      var reviews = json.reviews || json.comments || [];
      var summary = json.summary || { count: reviews.length, overall: 0, metrics: {} };
      var can = json.canReview || {};
      var summaryBox = $('.ppst-review-summary');
      var title = escapeHtml(state.targetName || 'TA') + ' 🌟' + Number(summary.overall || 0).toFixed(1) + '（' + Number(summary.count || 0) + ' 条）';
      summaryBox.innerHTML = '<div class="ppst-summary-title">' + title + '</div>' + METRICS.map(function (m) { var row = summary.metrics && summary.metrics[m.key] || {}; return progressRow(m.label, row.avg || 0); }).join('');
      $('.ppst-review-list').innerHTML = reviews.length ? reviews.map(renderReviewItem).join('') : '<div class="ppst-empty-review">还没有评价</div>';
      if (json.viewerComment) {
        state.viewerReviewId = json.viewerComment.id || '';
        $('.ppst-review-input').value = json.viewerComment.content || '';
        $('.ppst-anonymous').checked = !!json.viewerComment.anonymous;
        setRatings(json.viewerComment.ratings || {});
      }
      var editor = $('.ppst-review-editor');
      if (!isLoggedIn()) { editor.classList.add('disabled'); editor.insertAdjacentHTML('afterbegin', '<div class="ppst-review-lock">请先登录后评价</div>'); return; }
      if (!can.eligible) { editor.classList.add('disabled'); editor.insertAdjacentHTML('afterbegin', '<div class="ppst-review-lock">聊天超过 24 小时后才可以评价</div>'); }
      $$('.ppst-review-translate,.ppst-input-translate').forEach(function (btn) { bindLongPress(btn, function () { openTranslateSettings(); }); });
    }).catch(function (err) { $('.ppst-review-summary').textContent = err.message || '加载失败'; });
  }
  function submitReview() {
    var input = $('.ppst-review-input');
    var content = norm(input && input.value);
    var ratings = getRatings();
    if (!content || content.length < 2) return error('至少写 2 个字');
    var hasRating = Object.keys(ratings).some(function (k) { return Number(ratings[k]) > 0; });
    if (!hasRating) return error('请至少选择一个评分');
    var btn = $('.ppst-review-submit'); btn.disabled = true; btn.textContent = '发布中...';
    apiFetch(CONFIG.apiBase + '/comments/' + encodeURIComponent(state.targetUid), {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({ content: content, ratings: ratings, anonymous: !!($('.ppst-anonymous') && $('.ppst-anonymous').checked) })
    }).then(function () { toast('评价已保存'); loadReviews(state.targetUid); }).catch(function (err) { error(err.message === 'chat-under-24h' ? '聊天超过 24 小时后才可以评价' : (err.message || '评价失败')); }).finally(function () { btn.disabled = false; btn.textContent = '发布评价'; });
  }

  function enhance(root) {
    root = root || document;
    patchButtons(root);
    removeMetaFields(root);
    moveGenderToAvatar(root);
    patchDistance(root);
    maybeAddCardTranslate(root);
  }
  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var btn;
      if ((btn = e.target.closest('.pps-comment-btn,.ppst-open-review'))) {
        e.preventDefault(); e.stopImmediatePropagation();
        var uid = Number(btn.dataset.uid || findUidFrom(btn));
        if (!uid) { error('没有找到用户ID，请刷新后再试'); return; }
        openReview(uid, findNameFrom(btn));
        return;
      }
      if (e.target.closest('.pps-tags,.pps-tag-list,.pps-profile-tags')) {
        var tags = e.target.closest('.pps-tags,.pps-tag-list,.pps-profile-tags');
        tags.classList.toggle('is-expanded');
        return;
      }
      if (e.target.closest('.ppst-card-intro') && !e.target.closest('.ppst-inline-translate')) {
        e.target.closest('.ppst-card-intro').classList.toggle('is-expanded');
        return;
      }
      if (e.target.closest('.ppst-review-close') || e.target.closest('.ppst-review-mask')) { e.preventDefault(); closeReview(); return; }
      if ((btn = e.target.closest('.ppst-star'))) { e.preventDefault(); setRating(btn.dataset.key, btn.dataset.value); return; }
      if (e.target.closest('.ppst-review-submit')) { e.preventDefault(); submitReview(); return; }
      if ((btn = e.target.closest('.ppst-review-translate'))) { e.preventDefault(); var item = btn.closest('.ppst-review-item'); translateInto(btn, $('.ppst-review-content', item)); return; }
      if ((btn = e.target.closest('.ppst-input-translate'))) { e.preventDefault(); translateInto(btn, $('.ppst-review-input')); return; }
      if (e.target.closest('.ppst-settings-close,.ppst-settings-cancel,.ppst-settings-mask')) { e.preventDefault(); closeTranslateSettings(); return; }
      if ((btn = e.target.closest('.ppst-provider-tabs button'))) { e.preventDefault(); $$('.ppst-provider-tabs button').forEach(function (b) { b.classList.toggle('active', b === btn); }); $('.ppst-provider').value = btn.dataset.provider || 'google'; $('.ppst-ai').classList.toggle('show', btn.dataset.provider === 'ai'); return; }
      if ((btn = e.target.closest('.ppst-lang-trigger'))) { e.preventDefault(); openLangPicker(btn.dataset.role); return; }
      if (e.target.closest('.ppst-lang-close,.ppst-lang-mask')) { e.preventDefault(); closeLangPicker(); return; }
      if ((btn = e.target.closest('.ppst-lang-option'))) { e.preventDefault(); var target = state.langPickerRole === 'source' ? $('.ppst-source-lang') : $('.ppst-target-lang'); if (target) target.value = btn.dataset.code || 'auto'; closeLangPicker(); updateSettingsPreview(); return; }
      if (e.target.closest('.ppst-settings-save')) {
        e.preventDefault();
        saveTranslateSettings({
          sourceLang: normalizeLangCode($('.ppst-source-lang').value, 'auto'),
          targetLang: normalizeLangCode($('.ppst-target-lang').value, getDefaultTargetLang()),
          provider: $('.ppst-provider').value === 'ai' ? 'ai' : 'google',
          aiEndpoint: norm($('.ppst-ai-endpoint').value), aiModel: norm($('.ppst-ai-model').value), aiApiKey: norm($('.ppst-ai-key').value), aiPrompt: norm($('.ppst-ai-prompt').value) || CONFIG.defaultPrompt,
          temperature: 0.3
        });
        closeTranslateSettings(); toast('翻译设置已保存'); return;
      }
      if ((btn = e.target.closest('.ppst-inline-translate'))) { e.preventDefault(); translateInto(btn, btn.previousElementSibling); return; }
    }, true);
  }

  function init() {
    state.translateSettings = loadTranslateSettings();
    document.body.classList.add('pps-v14-overlay');
    enhance(document);
    bindGlobal();
    requestDailyLocation();
    loadOverlayFeedOnce();
    var obs = new MutationObserver(function (mutations) { mutations.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes || [], function (node) { if (node && node.nodeType === 1) enhance(node); }); }); });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
