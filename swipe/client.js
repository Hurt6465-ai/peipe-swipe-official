'use strict';

(function () {
  var PAGE_SELECTOR = '.peipe-swipe-page';
  var API_BASE = '/api/peipe-partners/swipe';
  var LOCAL_SWIPER_CSS = '/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.css';
  var LOCAL_SWIPER_JS = '/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.js';
  var CDN_SWIPER_CSS = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
  var CDN_SWIPER_JS = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';

  var STATE = {
    page: null,
    loading: null,
    empty: null,
    swiperEl: null,
    slidesEl: null,
    toast: null,
    mainSwiper: null,
    photoSwipers: [],
    users: [],
    uidSet: {},
    loadingFeed: false,
    loadedOnce: false,
    profile: null,
    options: null,
    tags: [],
    selectedTags: [],
    tagCategories: [],
    tagMap: {},
    translator: null,
    initialised: false,
    swiperReady: false
  };

  function boot() {
    if (typeof require === 'function') {
      require(['translator'], function (translator) {
        STATE.translator = translator;
        initIfNeeded();
      });
    } else {
      initIfNeeded();
    }
  }

  function currentAjaxifyUrl() {
    if (window.ajaxify && typeof window.ajaxify.currentPage === 'string') {
      return window.ajaxify.currentPage.replace(/^\//, '');
    }
    return window.location.pathname.replace(/^\//, '');
  }

  function initIfNeeded() {
    var page = document.querySelector(PAGE_SELECTOR);
    if (!page) {
      destroy();
      return;
    }

    if (STATE.initialised && STATE.page === page) {
      return;
    }

    destroy();

    STATE.page = page;
    STATE.loading = page.querySelector('[data-role="loading"]');
    STATE.empty = page.querySelector('[data-role="empty"]');
    STATE.swiperEl = page.querySelector('[data-role="swiper"]');
    STATE.slidesEl = page.querySelector('[data-role="slides"]');
    STATE.toast = page.querySelector('[data-role="toast"]');
    STATE.initialised = true;

    bindPageEvents();
    ensureSwiper().then(function (ready) {
      STATE.swiperReady = ready;
      start();
    });
  }

  function destroy() {
    if (STATE.mainSwiper && STATE.mainSwiper.destroy) {
      STATE.mainSwiper.destroy(true, true);
    }

    STATE.photoSwipers.forEach(function (swiper) {
      if (swiper && swiper.destroy) {
        swiper.destroy(true, true);
      }
    });

    STATE.mainSwiper = null;
    STATE.photoSwipers = [];
    STATE.users = [];
    STATE.uidSet = {};
    STATE.loadedOnce = false;
    STATE.loadingFeed = false;
    STATE.initialised = false;
  }

  function bindPageEvents() {
    if (!STATE.page) return;

    STATE.page.addEventListener('click', function (event) {
      var reloadBtn = event.target.closest('[data-action="reload"]');
      if (reloadBtn) {
        event.preventDefault();
        loadFeed(true);
        return;
      }

      var greetBtn = event.target.closest('[data-action="greet"]');
      if (greetBtn) {
        event.preventDefault();
        sendGreeting(greetBtn.getAttribute('data-uid'), greetBtn);
        return;
      }
    });
  }

  function start() {
    if (!STATE.page) return;

    showLoading(true);

    if (!window.config || !Number(window.config.uid || 0)) {
      showLoginRequired();
      return;
    }

    Promise.all([loadOptions(), loadTags(), loadMyProfile()]).then(function (results) {
      var me = results[2];
      if (me && !me.complete) {
        openProfileModal(me.profile || {}, me.missing || []);
      } else {
        loadFeed(true);
      }
    }).catch(function () {
      openProfileModal({}, []);
    });
  }

  function ensureSwiper() {
    if (window.Swiper) {
      return Promise.resolve(true);
    }

    loadCss(LOCAL_SWIPER_CSS);
    return loadScript(LOCAL_SWIPER_JS).then(function () {
      return !!window.Swiper;
    }).catch(function () {
      loadCss(CDN_SWIPER_CSS);
      return loadScript(CDN_SWIPER_JS).then(function () {
        return !!window.Swiper;
      }).catch(function () {
        return false;
      });
    });
  }

  function loadCss(href) {
    if (document.querySelector('link[href="' + href + '"]')) {
      return;
    }
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function api(path, options) {
    options = options || {};
    var headers = options.headers || {};
    headers.Accept = 'application/json';
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (window.config && window.config.csrf_token) {
      headers['x-csrf-token'] = window.config.csrf_token;
    }

    return fetch(path, Object.assign({
      credentials: 'same-origin',
      headers: headers
    }, options)).then(function (res) {
      if (!res.ok) {
        var err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      return res.json();
    }).then(unwrapApiPayload);
  }

  function unwrapApiPayload(payload) {
    if (payload && payload.response) return payload.response;
    return payload;
  }

  function loadOptions() {
    return api('/api/peipe-partners/options').then(function (payload) {
      STATE.options = normaliseOptions(payload || {});
      return STATE.options;
    }).catch(function () {
      STATE.options = normaliseOptions({});
      return STATE.options;
    });
  }

  function loadTags() {
    return api(API_BASE + '/tags').then(function (payload) {
      STATE.tagCategories = payload.categories || [];
      STATE.tagMap = {};
      STATE.tagCategories.forEach(function (category) {
        (category.tags || []).forEach(function (tag) {
          STATE.tagMap[tag.key] = tag;
        });
      });
      return STATE.tagCategories;
    });
  }

  function loadMyProfile() {
    return api(API_BASE + '/me').then(function (payload) {
      STATE.profile = payload.profile || {};
      STATE.selectedTags = (STATE.profile.tags || []).slice(0);
      return payload;
    });
  }

  function saveMyProfile(profile) {
    return api(API_BASE + '/me', {
      method: 'PUT',
      body: JSON.stringify(profile)
    });
  }

  function loadFeed(reset) {
    if (STATE.loadingFeed) return;
    STATE.loadingFeed = true;

    if (reset) {
      STATE.users = [];
      STATE.uidSet = {};
      if (STATE.slidesEl) STATE.slidesEl.innerHTML = '';
      destroySwipersOnly();
      showLoading(true);
      showEmpty(false);
    }

    var limit = reset ? 18 : 12;
    api(API_BASE + '/feed?mode=recommend&limit=' + limit).then(function (payload) {
      var incoming = Array.isArray(payload.users) ? payload.users : [];
      var fresh = incoming.filter(function (user) {
        var uid = Number(user && user.uid);
        if (!uid || STATE.uidSet[uid]) return false;
        STATE.uidSet[uid] = true;
        return true;
      });

      STATE.users = STATE.users.concat(fresh);
      appendSlides(fresh);
      STATE.loadedOnce = true;
      showLoading(false);
      showEmpty(STATE.users.length === 0);
      initSwipers();
    }).catch(function () {
      showLoading(false);
      showEmpty(true);
      toastKey('error');
    }).then(function () {
      STATE.loadingFeed = false;
    });
  }

  function destroySwipersOnly() {
    if (STATE.mainSwiper && STATE.mainSwiper.destroy) {
      STATE.mainSwiper.destroy(true, true);
    }
    STATE.photoSwipers.forEach(function (swiper) {
      if (swiper && swiper.destroy) swiper.destroy(true, true);
    });
    STATE.mainSwiper = null;
    STATE.photoSwipers = [];
  }

  function appendSlides(users) {
    if (!STATE.slidesEl) return;

    var html = users.map(buildUserSlide).join('');
    var holder = document.createElement('div');
    setTranslatedHtml(holder, html, function () {
      while (holder.firstChild) {
        STATE.slidesEl.appendChild(holder.firstChild);
      }
      if (STATE.swiperEl) STATE.swiperEl.hidden = false;
    });
  }

  function initSwipers() {
    if (!STATE.swiperEl) return;

    if (!STATE.swiperReady || !window.Swiper) {
      STATE.swiperEl.classList.add('peipe-native-snap');
      return;
    }

    if (STATE.mainSwiper && STATE.mainSwiper.update) {
      STATE.mainSwiper.update();
    } else {
      STATE.mainSwiper = new window.Swiper(STATE.swiperEl, {
        direction: 'vertical',
        slidesPerView: 1,
        resistanceRatio: 0.75,
        speed: 260,
        mousewheel: true,
        keyboard: { enabled: true },
        nested: true,
        on: {
          reachEnd: function () {
            loadFeed(false);
          }
        }
      });
    }

    STATE.photoSwipers.forEach(function (swiper) {
      if (swiper && swiper.destroy) swiper.destroy(true, true);
    });
    STATE.photoSwipers = [];

    STATE.page.querySelectorAll('.peipe-swipe-photo-swiper').forEach(function (el) {
      var swiper = new window.Swiper(el, {
        direction: 'horizontal',
        nested: true,
        resistanceRatio: 0.75,
        pagination: {
          el: el.querySelector('.swiper-pagination'),
          clickable: true
        }
      });
      STATE.photoSwipers.push(swiper);
    });
  }

  function buildUserSlide(user) {
    var uid = Number(user.uid || 0);
    var photos = getPhotos(user);
    var tags = Array.isArray(user.tags) ? user.tags.slice(0, 6) : [];
    var displayName = user.displayName || user.username || 'User';
    var bio = user.bio || '[[peipe-partners-swipe:noBio]]';
    var age = user.age || user.ageText || '';
    var nativeCode = user.nativeCode || user.language_fluent || '';
    var learnCode = user.learnCode || user.language_learning || '';
    var country = user.countryCode || user.language_flag || '';

    return '' +
      '<div class="swiper-slide peipe-swipe-person" data-uid="' + uid + '">' +
        '<div class="swiper peipe-swipe-photo-swiper">' +
          '<div class="swiper-wrapper">' + photos.map(function (src) {
            return '<div class="swiper-slide peipe-swipe-photo-slide"><img class="peipe-swipe-photo" src="' + escapeAttr(src) + '" alt=""></div>';
          }).join('') + '</div>' +
          (photos.length > 1 ? '<div class="swiper-pagination peipe-swipe-photo-pagination"></div>' : '') +
        '</div>' +
        '<div class="peipe-swipe-shade"></div>' +
        '<div class="peipe-swipe-copy">' +
          '<div class="peipe-swipe-name-row">' +
            '<span class="peipe-swipe-name">' + escapeHtml(displayName) + '</span>' +
            (country ? '<span class="peipe-swipe-pill">' + escapeHtml(country) + '</span>' : '') +
          '</div>' +
          '<div class="peipe-swipe-meta">' +
            (age ? '<span>' + escapeHtml(String(age)) + '</span>' : '') +
            (nativeCode || learnCode ? '<span>' + escapeHtml(nativeCode || '-') + ' ⇄ ' + escapeHtml(learnCode || '-') + '</span>' : '') +
          '</div>' +
          '<div class="peipe-swipe-bio">' + escapeHtml(bio) + '</div>' +
          '<div class="peipe-swipe-tags">' + tags.map(function (tag) {
            var item = STATE.tagMap[tag];
            return '<span>[[peipe-partners-swipe:' + escapeAttr(item ? item.labelKey : tag) + ']]</span>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="peipe-swipe-actions">' +
          '<button class="peipe-swipe-action" type="button" data-action="greet" data-uid="' + uid + '">' +
            '<span class="peipe-swipe-action-icon">✦</span>' +
            '<span>[[peipe-partners-swipe:greet]]</span>' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function getPhotos(user) {
    var photos = [];
    if (Array.isArray(user.photos)) {
      photos = user.photos;
    } else if (Array.isArray(user.partnerPhotos)) {
      photos = user.partnerPhotos;
    } else if (user.peipe_partner_photos) {
      try {
        photos = JSON.parse(user.peipe_partner_photos);
      } catch (err) {
        photos = String(user.peipe_partner_photos).split(/[,|\n]/g);
      }
    }
    if (user.picture) photos.push(user.picture);
    photos = photos.filter(Boolean).map(String).filter(function (url, index, list) {
      return list.indexOf(url) === index;
    }).slice(0, 5);
    if (!photos.length) photos.push('/assets/uploads/system/default-avatar.png');
    return photos;
  }

  function sendGreeting(uid, button) {
    uid = Number(uid || 0);
    if (!uid) return;

    button.disabled = true;
    api('/api/peipe-partners/me/greet', {
      method: 'POST',
      body: JSON.stringify({ uid: uid })
    }).then(function (payload) {
      if (payload && payload.ok === false) {
        if (payload.error === 'greet-limit-exceeded') {
          toastKey('greetLimit');
        } else {
          toastKey('error');
        }
      } else {
        button.classList.add('is-done');
        toastKey('greetOK');
      }
    }).catch(function () {
      toastKey('error');
    }).then(function () {
      button.disabled = false;
    });
  }

  function openProfileModal(profile, missing) {
    profile = profile || {};
    STATE.selectedTags = Array.isArray(profile.tags) ? profile.tags.slice(0) : [];

    var html = '' +
      '<div class="peipe-profile-mask" data-role="profile-mask">' +
        '<form class="peipe-profile-modal" data-role="profile-form">' +
          '<div class="peipe-profile-head">' +
            '<div>' +
              '<div class="peipe-profile-title">[[peipe-partners-swipe:profileTitle]]</div>' +
              '<div class="peipe-profile-subtitle">[[peipe-partners-swipe:profileSubtitle]]</div>' +
            '</div>' +
          '</div>' +
          '<div class="peipe-profile-body">' +
            buildInput('displayName', 'displayName', profile.displayName || profile.username || '', 'profileDisplayName') +
            buildPhotoInput(profile) +
            buildSelect('language_flag', 'country', profile.language_flag || profile.country || '', STATE.options.countries, 'profileCountry') +
            buildSelect('language_fluent', 'nativeLanguage', profile.language_fluent || profile.nativeLanguage || '', STATE.options.languages, 'profileNative') +
            buildSelect('language_learning', 'learningLanguage', profile.language_learning || profile.learningLanguage || '', STATE.options.languages, 'profileLearning') +
            buildSelect('gender', 'gender', profile.gender || '', STATE.options.genders, 'profileGender') +
            buildInput('age', 'age', profile.age || '', 'profileAge', 'number') +
            buildTextarea('bio', profile.bio || '', 'profileBio') +
            buildTagField() +
            '<div class="peipe-profile-error" data-role="profile-error">' + missingToText(missing) + '</div>' +
          '</div>' +
          '<div class="peipe-profile-footer">' +
            '<button class="peipe-swipe-primary peipe-profile-submit" type="submit">[[peipe-partners-swipe:saveProfile]]</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    var wrap = document.createElement('div');
    setTranslatedHtml(wrap, html, function () {
      document.body.appendChild(wrap.firstChild);
      bindProfileModal();
      updatePhotoPreview();
      renderSelectedTags();
    });
  }

  function buildInput(name, dataName, value, labelKey, type) {
    return '' +
      '<label class="peipe-profile-field">' +
        '<span>[[peipe-partners-swipe:' + labelKey + ']]</span>' +
        '<input name="' + escapeAttr(name) + '" data-name="' + escapeAttr(dataName) + '" type="' + escapeAttr(type || 'text') + '" value="' + escapeAttr(value) + '" autocomplete="off">' +
      '</label>';
  }

  function buildTextarea(name, value, labelKey) {
    return '' +
      '<label class="peipe-profile-field peipe-profile-field-full">' +
        '<span>[[peipe-partners-swipe:' + labelKey + ']]</span>' +
        '<textarea name="' + escapeAttr(name) + '" rows="3" maxlength="140">' + escapeHtml(value) + '</textarea>' +
      '</label>';
  }

  function buildPhotoInput(profile) {
    var photo = profile.picture || profile.photo || profile.accountPicture || '';
    return '' +
      '<div class="peipe-profile-field peipe-profile-field-full peipe-photo-field">' +
        '<span>[[peipe-partners-swipe:profilePhoto]]</span>' +
        '<div class="peipe-photo-edit-row">' +
          '<div class="peipe-photo-preview" data-role="photo-preview"></div>' +
          '<div class="peipe-photo-inputs">' +
            '<input name="picture" data-role="photo-input" type="url" value="' + escapeAttr(photo) + '" placeholder="https://...">' +
            '<button type="button" class="peipe-swipe-secondary" data-action="use-avatar" data-avatar="' + escapeAttr(profile.accountPicture || profile.picture || '') + '">[[peipe-partners-swipe:useAvatar]]</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function buildSelect(name, dataName, value, options, labelKey) {
    return '' +
      '<label class="peipe-profile-field">' +
        '<span>[[peipe-partners-swipe:' + labelKey + ']]</span>' +
        '<select name="' + escapeAttr(name) + '" data-name="' + escapeAttr(dataName) + '">' +
          '<option value="">[[peipe-partners-swipe:pleaseSelect]]</option>' +
          options.map(function (item) {
            var selected = String(item.value) === String(value) ? ' selected' : '';
            return '<option value="' + escapeAttr(item.value) + '"' + selected + '>' + escapeHtml(item.label) + '</option>';
          }).join('') +
        '</select>' +
      '</label>';
  }

  function buildTagField() {
    return '' +
      '<div class="peipe-profile-field peipe-profile-field-full">' +
        '<span>[[peipe-partners-swipe:profileTags]]</span>' +
        '<button class="peipe-tag-open" type="button" data-action="open-tags">[[peipe-partners-swipe:selectTags]]</button>' +
        '<div class="peipe-selected-tags" data-role="selected-tags"></div>' +
      '</div>';
  }

  function bindProfileModal() {
    var mask = document.querySelector('.peipe-profile-mask');
    if (!mask) return;

    var form = mask.querySelector('[data-role="profile-form"]');
    var photoInput = mask.querySelector('[data-role="photo-input"]');

    mask.addEventListener('click', function (event) {
      var useAvatar = event.target.closest('[data-action="use-avatar"]');
      if (useAvatar) {
        event.preventDefault();
        if (photoInput && useAvatar.getAttribute('data-avatar')) {
          photoInput.value = useAvatar.getAttribute('data-avatar');
          updatePhotoPreview();
        }
        return;
      }

      var openTags = event.target.closest('[data-action="open-tags"]');
      if (openTags) {
        event.preventDefault();
        openTagSheet();
      }
    });

    if (photoInput) {
      photoInput.addEventListener('input', updatePhotoPreview);
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      submitProfile(form);
    });
  }

  function submitProfile(form) {
    var data = formToObject(form);
    data.tags = STATE.selectedTags.slice(0);
    data.photos = [data.picture].filter(Boolean);

    var missing = validateProfile(data);
    var errorEl = form.querySelector('[data-role="profile-error"]');
    if (missing.length) {
      if (errorEl) errorEl.textContent = missingToPlainText(missing);
      return;
    }

    var submit = form.querySelector('.peipe-profile-submit');
    if (submit) submit.disabled = true;

    saveMyProfile(data).then(function (payload) {
      if (!payload.complete) {
        if (errorEl) errorEl.textContent = missingToPlainText(payload.missing || []);
        return;
      }
      closeProfileModal();
      toastKey('profileSaved');
      loadFeed(true);
    }).catch(function () {
      if (errorEl) errorEl.textContent = plainText('error', '保存失败，请稍后重试');
    }).then(function () {
      if (submit) submit.disabled = false;
    });
  }

  function formToObject(form) {
    var data = {};
    form.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.name) data[el.name] = el.value.trim();
    });
    return data;
  }

  function validateProfile(data) {
    var missing = [];
    if (!data.displayName) missing.push('displayName');
    if (!data.picture) missing.push('picture');
    if (!data.language_flag) missing.push('language_flag');
    if (!data.language_fluent) missing.push('language_fluent');
    if (!data.language_learning) missing.push('language_learning');
    if (!data.gender) missing.push('gender');
    if (!Number(data.age)) missing.push('age');
    if (!STATE.selectedTags.length) missing.push('tags');
    return missing;
  }

  function closeProfileModal() {
    var mask = document.querySelector('.peipe-profile-mask');
    if (mask) mask.remove();
  }

  function updatePhotoPreview() {
    var mask = document.querySelector('.peipe-profile-mask');
    if (!mask) return;
    var input = mask.querySelector('[data-role="photo-input"]');
    var preview = mask.querySelector('[data-role="photo-preview"]');
    if (!input || !preview) return;
    preview.style.backgroundImage = input.value ? 'url("' + input.value.replace(/"/g, '\\"') + '")' : '';
  }

  function openTagSheet() {
    var html = '' +
      '<div class="peipe-tag-sheet" data-role="tag-sheet">' +
        '<div class="peipe-tag-sheet-head">' +
          '<button type="button" class="peipe-tag-close" data-action="close-tags">[[peipe-partners-swipe:cancel]]</button>' +
          '<div class="peipe-tag-title">[[peipe-partners-swipe:chooseTags]]</div>' +
          '<button type="button" class="peipe-tag-done" data-action="done-tags">[[peipe-partners-swipe:done]]</button>' +
        '</div>' +
        '<div class="peipe-tag-layout">' +
          '<div class="peipe-tag-tabs">' + STATE.tagCategories.map(function (category, index) {
            return '<button type="button" class="' + (index === 0 ? 'active' : '') + '" data-category="' + escapeAttr(category.key) + '">[[peipe-partners-swipe:' + escapeAttr(category.labelKey) + ']]</button>';
          }).join('') + '</div>' +
          '<div class="peipe-tag-panels">' + STATE.tagCategories.map(function (category, index) {
            return '<div class="peipe-tag-panel ' + (index === 0 ? 'active' : '') + '" data-panel="' + escapeAttr(category.key) + '">' +
              (category.tags || []).map(function (tag) {
                var selected = STATE.selectedTags.indexOf(tag.key) !== -1;
                return '<button type="button" class="peipe-tag-choice ' + (selected ? 'selected' : '') + '" data-tag="' + escapeAttr(tag.key) + '">[[peipe-partners-swipe:' + escapeAttr(tag.labelKey) + ']]</button>';
              }).join('') +
            '</div>';
          }).join('') + '</div>' +
        '</div>' +
        '<div class="peipe-tag-count" data-role="tag-count"></div>' +
      '</div>';

    var wrap = document.createElement('div');
    setTranslatedHtml(wrap, html, function () {
      document.body.appendChild(wrap.firstChild);
      bindTagSheet();
      updateTagCount();
    });
  }

  function bindTagSheet() {
    var sheet = document.querySelector('[data-role="tag-sheet"]');
    if (!sheet) return;

    sheet.addEventListener('click', function (event) {
      var close = event.target.closest('[data-action="close-tags"]');
      if (close) {
        event.preventDefault();
        sheet.remove();
        return;
      }

      var done = event.target.closest('[data-action="done-tags"]');
      if (done) {
        event.preventDefault();
        renderSelectedTags();
        sheet.remove();
        return;
      }

      var tab = event.target.closest('[data-category]');
      if (tab) {
        event.preventDefault();
        var key = tab.getAttribute('data-category');
        sheet.querySelectorAll('[data-category]').forEach(function (item) {
          item.classList.toggle('active', item === tab);
        });
        sheet.querySelectorAll('[data-panel]').forEach(function (panel) {
          panel.classList.toggle('active', panel.getAttribute('data-panel') === key);
        });
        return;
      }

      var choice = event.target.closest('[data-tag]');
      if (choice) {
        event.preventDefault();
        var tag = choice.getAttribute('data-tag');
        var idx = STATE.selectedTags.indexOf(tag);
        if (idx === -1) {
          if (STATE.selectedTags.length >= 12) {
            toastKey('tagMax');
            return;
          }
          STATE.selectedTags.push(tag);
          choice.classList.add('selected');
        } else {
          STATE.selectedTags.splice(idx, 1);
          choice.classList.remove('selected');
        }
        updateTagCount();
      }
    });
  }

  function renderSelectedTags() {
    var box = document.querySelector('[data-role="selected-tags"]');
    if (!box) return;

    if (!STATE.selectedTags.length) {
      setTranslatedHtml(box, '<span class="empty">[[peipe-partners-swipe:noTagsSelected]]</span>');
      return;
    }

    var html = STATE.selectedTags.map(function (key) {
      var tag = STATE.tagMap[key];
      return '<span>[[peipe-partners-swipe:' + escapeAttr(tag ? tag.labelKey : key) + ']]</span>';
    }).join('');
    setTranslatedHtml(box, html);
  }

  function updateTagCount() {
    var el = document.querySelector('[data-role="tag-count"]');
    if (!el) return;
    setTranslatedHtml(el, '[[peipe-partners-swipe:selectedCount]]: ' + STATE.selectedTags.length + '/12');
  }

  function normaliseOptions(payload) {
    return {
      countries: optionArray(payload.countries || payload.country || payload.flags || [], fallbackCountries()),
      languages: optionArray(payload.languages || payload.language || [], fallbackLanguages()),
      genders: optionArray(payload.genders || payload.gender || [], fallbackGenders())
    };
  }

  function optionArray(values, fallback) {
    if (!Array.isArray(values) || !values.length) values = fallback;
    return values.map(function (item) {
      if (typeof item === 'string') {
        return { value: item, label: item };
      }
      return {
        value: item.value || item.code || item.key || item.id || item.name || item.label || '',
        label: item.label || item.name || item.text || item.title || item.code || item.value || ''
      };
    }).filter(function (item) {
      return item.value && item.label;
    });
  }

  function fallbackCountries() {
    return [
      { value: 'CN', label: '中国' },
      { value: 'US', label: 'United States' },
      { value: 'GB', label: 'United Kingdom' },
      { value: 'MM', label: 'Myanmar' },
      { value: 'TH', label: 'Thailand' },
      { value: 'VN', label: 'Vietnam' },
      { value: 'JP', label: 'Japan' },
      { value: 'KR', label: 'Korea' }
    ];
  }

  function fallbackLanguages() {
    return [
      { value: 'zh', label: '中文' },
      { value: 'en', label: 'English' },
      { value: 'my', label: 'မြန်မာ' },
      { value: 'th', label: 'ไทย' },
      { value: 'vi', label: 'Tiếng Việt' },
      { value: 'ja', label: '日本語' },
      { value: 'ko', label: '한국어' }
    ];
  }

  function fallbackGenders() {
    return [
      { value: 'female', label: '[[peipe-partners-swipe:genderFemale]]' },
      { value: 'male', label: '[[peipe-partners-swipe:genderMale]]' },
      { value: 'other', label: '[[peipe-partners-swipe:genderOther]]' }
    ];
  }

  function setTranslatedHtml(el, html, cb) {
    if (!el) return;
    if (STATE.translator && STATE.translator.translate) {
      STATE.translator.translate(html, function (translated) {
        el.innerHTML = translated;
        if (cb) cb();
      });
    } else {
      el.innerHTML = html;
      if (cb) cb();
    }
  }

  function plainText(key, fallback) {
    return fallback || key;
  }

  function missingToText(missing) {
    if (!missing || !missing.length) return '';
    return '[[peipe-partners-swipe:profileRequired]]';
  }

  function missingToPlainText(missing) {
    if (!missing || !missing.length) return '';
    return plainText('profileRequired', '请补全必填资料');
  }

  function showLoading(show) {
    if (STATE.loading) STATE.loading.hidden = !show;
  }

  function showEmpty(show) {
    if (STATE.empty) STATE.empty.hidden = !show;
  }

  function showLoginRequired() {
    showLoading(false);
    if (!STATE.empty) return;
    setTranslatedHtml(STATE.empty, '' +
      '<div class="peipe-swipe-empty-title">[[peipe-partners-swipe:loginRequiredTitle]]</div>' +
      '<div class="peipe-swipe-empty-text">[[peipe-partners-swipe:loginRequiredText]]</div>' +
      '<a class="peipe-swipe-primary" href="/login?returnTo=' + encodeURIComponent('/partners/swipe') + '">[[peipe-partners-swipe:login]]</a>'
    );
    STATE.empty.hidden = false;
  }

  function toastKey(key) {
    if (!STATE.toast) return;
    setTranslatedHtml(STATE.toast, '[[peipe-partners-swipe:' + key + ']]');
    STATE.toast.hidden = false;
    clearTimeout(STATE.toastTimer);
    STATE.toastTimer = setTimeout(function () {
      if (STATE.toast) STATE.toast.hidden = true;
    }, 1800);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  if (window.jQuery) {
    window.jQuery(window).on('action:ajaxify.end', function () {
      initIfNeeded();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
