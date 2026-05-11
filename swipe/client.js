/* Peipe Partners Swipe v4
   - full-screen mobile page
   - vertical swipe partners, horizontal swipe photos
   - profile setup with frosted glass sheet
   - local photo upload with front-end compression, <= 5MB after compression
   - no avatar-as-background: avatar is avatar, partner photos are separate
*/
(function () {
  'use strict';

  if (window.__peipePartnersSwipeV4) return;
  window.__peipePartnersSwipeV4 = true;

  var CONFIG = Object.assign({
    pageSize: 18,
    maxPhotos: 5,
    maxUploadBytes: 5 * 1024 * 1024,
    imageMaxSide: 1600,
    imageQualityStart: 0.82,
    imageQualityMin: 0.48,
    uploadCid: 1,
    preloadAhead: 2,
    swiperCss: '/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.css',
    swiperJs: '/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.js',
    swiperFallbackCss: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
    swiperFallbackJs: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js'
  }, window.PEIPE_SWIPE_CONFIG || {});

  var TEXT = {
    loading: '语伴加载中...',
    empty: '暂时没有可推荐的语伴',
    login: '请先登录',
    profileTitle: '完善语伴资料',
    profileSubtitle: '第一次打开语伴前，需要先填写这些资料。',
    editProfileTitle: '编辑语伴资料',
    displayName: '用户名 / 显示名',
    photos: '语伴照片',
    uploadPhotos: '上传手机图片',
    uploading: '上传中...',
    imageTooLarge: '图片压缩后仍超过 5MB，请换一张图片',
    imageOnly: '请选择图片文件',
    maxPhotos: '最多 5 张照片，前端会自动压缩。头像不会当成背景照片。',
    bio: '介绍',
    bioPlaceholder: '介绍一下你想练什么语言、喜欢聊什么。',
    country: '国籍 / 地区',
    nativeLanguage: '母语 / 我会说',
    learningLanguage: '想学语言',
    gender: '性别',
    birthday: '出生日期',
    height: '身高',
    weight: '体重',
    education: '学历',
    occupation: '职业',
    relationship: '感情状况',
    interests: '兴趣爱好',
    heightPlaceholder: '例如 170',
    weightPlaceholder: '例如 60',
    occupationPlaceholder: '例如 学生 / 设计师',
    interestsPlaceholder: '例如 电影、音乐、旅行',
    optional: '选填',
    tags: '标签',
    chooseTags: '选择标签',
    save: '保存资料',
    saving: '保存中...',
    saveOk: '资料已保存',
    saveFail: '保存失败',
    required: '请先补全必填资料',
    noBio: '这个人还没有写简介。',
    noPhoto: '未上传语伴照片',
    greet: '👋 Hi',
    greeted: '已打招呼',
    greeting: '发送中...',
    greetOk: '已打招呼',
    greetAlready: '你已经打过招呼了',
    greetLimit: '今天打招呼次数已用完',
    greetFail: '打招呼失败',
    tagTitle: '选择标签',
    tagDone: '完成',
    tagClear: '清空',
    selectedCount: '已选',
    male: '男',
    female: '女',
    other: '其他',
    privateGender: '保密',
    selectPlaceholder: '请选择',
    missingPrefix: '请先补全：',
    settings: '资料',
    back: '返回',
    tagCategoryPurpose: '练习目的',
    tagCategoryPersonality: '性格',
    tagCategoryInterests: '兴趣',
    tagCategoryTime: '时间',
    tagCategoryLevel: '水平',
    tagDailyChat: '日常聊天',
    tagVoicePractice: '语音练习',
    tagTextChat: '文字聊天',
    tagPronunciation: '纠音',
    tagGrammar: '语法',
    tagExam: '考试',
    tagBusiness: '商务',
    tagTravel: '旅行',
    tagPatient: '有耐心',
    tagFriendly: '友好',
    tagOutgoing: '外向',
    tagQuiet: '安静',
    tagHumorous: '幽默',
    tagSerious: '认真',
    tagMovies: '电影',
    tagMusic: '音乐',
    tagGames: '游戏',
    tagSports: '运动',
    tagFood: '美食',
    tagBooks: '阅读',
    tagAnime: '动漫',
    tagTechnology: '科技',
    tagPhotography: '摄影',
    tagPets: '宠物',
    tagMorning: '早上',
    tagAfternoon: '下午',
    tagNight: '晚上',
    tagWeekend: '周末',
    tagDaily: '每天',
    tagBeginner: '初级',
    tagIntermediate: '中级',
    tagAdvanced: '高级',
    tagNativeHelper: '母语帮助'
  };

  var OPTIONS = {
    countries: [
      { value: 'CN', label: '中国' },
      { value: 'MM', label: '缅甸' },
      { value: 'VN', label: '越南' },
      { value: 'TH', label: '泰国' },
      { value: 'US', label: '美国' },
      { value: 'GB', label: '英国' },
      { value: 'JP', label: '日本' },
      { value: 'KR', label: '韩国' }
    ],
    languages: [
      { value: 'CN', label: '中文' },
      { value: 'EN', label: 'English' },
      { value: 'MM', label: 'မြန်မာ' },
      { value: 'VI', label: 'Tiếng Việt' },
      { value: 'TH', label: 'ภาษาไทย' },
      { value: 'JP', label: '日本語' },
      { value: 'KR', label: '한국어' }
    ],
    genders: [
      { value: 'male', label: TEXT.male },
      { value: 'female', label: TEXT.female },
      { value: 'private', label: TEXT.privateGender },
      { value: 'other', label: TEXT.other }
    ],
    relationships: [
      { value: 'private', label: '保密' },
      { value: 'single', label: '单身' },
      { value: 'dating', label: '恋爱中' },
      { value: 'married', label: '已婚' }
    ],
    educations: [
      { value: 'private', label: '保密' },
      { value: 'middle_school', label: '初中' },
      { value: 'high_school', label: '高中' },
      { value: 'college', label: '大专' },
      { value: 'bachelor', label: '本科' },
      { value: 'master', label: '硕士' },
      { value: 'doctor', label: '博士' }
    ]
  };

  var state = {
    root: null,
    swiper: null,
    users: [],
    loading: false,
    done: false,
    index: 0,
    profile: null,
    profileComplete: false,
    requiredProfile: false,
    tagCategories: [],
    selectedTags: [],
    uploadBusy: false,
    photoSwipers: new Map(),
    tagDraft: [],
    toastTimer: 0,
    nativeMode: false,
    settingsVisible: true
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function rel(path) {
    var base = (window.config && window.config.relative_path) || '';
    if (!path) return base || '';
    if (/^https?:\/\//i.test(path)) return path;
    if (base && path.indexOf(base + '/') === 0) return path;
    return base + path;
  }
  function csrfToken() {
    return (window.config && (window.config.csrf_token || window.config.csrfToken)) ||
      ($('meta[name="csrf-token"]') && $('meta[name="csrf-token"]').getAttribute('content')) || '';
  }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>'"]/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch];
    });
  }
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function currentUser() { return (window.app && window.app.user) || null; }
  function isLoggedIn() { var u = currentUser(); return !!(u && Number(u.uid || 0) > 0); }
  function jsonBody(data) { return JSON.stringify(data || {}); }

  function apiFetch(url, options) {
    options = options || {};
    options.credentials = options.credentials || 'same-origin';
    options.headers = Object.assign({
      accept: 'application/json',
      'x-requested-with': 'XMLHttpRequest'
    }, options.headers || {});
    return fetch(rel(url), options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          var msg = json.error || json.message || (json.status && json.status.message) || ('HTTP ' + res.status);
          throw new Error(msg);
        }
        return json.response || json;
      });
    });
  }

  function loadAsset(tag, url, attr) {
    return new Promise(function (resolve, reject) {
      var selector = tag + '[' + attr + ']';
      var existing = document.querySelector(selector);
      if (existing) {
        if (tag === 'link' || existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      var el = document.createElement(tag);
      el.setAttribute(attr, '1');
      if (tag === 'link') {
        el.rel = 'stylesheet';
        el.href = rel(url);
      } else {
        el.src = rel(url);
        el.async = true;
      }
      el.onload = function () { el.dataset.loaded = '1'; resolve(); };
      el.onerror = reject;
      document.head.appendChild(el);
      if (tag === 'link') resolve();
    });
  }

  function ensureSwiper() {
    if (window.Swiper) return Promise.resolve(true);
    return loadAsset('link', CONFIG.swiperCss, 'data-pps-swiper-css')
      .then(function () { return loadAsset('script', CONFIG.swiperJs, 'data-pps-swiper-js'); })
      .then(function () { return !!window.Swiper; })
      .catch(function () {
        if (window.Swiper) return true;
        return loadAsset('link', CONFIG.swiperFallbackCss, 'data-pps-swiper-css-fallback')
          .then(function () { return loadAsset('script', CONFIG.swiperFallbackJs, 'data-pps-swiper-js-fallback'); })
          .then(function () { return !!window.Swiper; })
          .catch(function () { return false; });
      });
  }

  var COUNTRY_FLAG_MAP = { CN: 'CN', MM: 'MM', VN: 'VN', VI: 'VN', TH: 'TH', US: 'US', GB: 'GB', UK: 'GB', JP: 'JP', JA: 'JP', KR: 'KR', KO: 'KR', EN: 'GB' };
  var LANGUAGE_FLAG_MAP = { CN: 'CN', ZH: 'CN', EN: 'GB', MM: 'MM', MY: 'MM', VI: 'VN', VN: 'VN', TH: 'TH', JP: 'JP', JA: 'JP', KR: 'KR', KO: 'KR' };

  function flagEmojiFromCountry(code) {
    var c = String(code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return '';
    return c.replace(/./g, function (char) { return String.fromCodePoint(127397 + char.charCodeAt(0)); });
  }

  function normalCode(code) {
    return String(code || '')
      .replace(/^\s*\[\s*["']?/, '')
      .replace(/["']?\s*\]\s*$/, '')
      .trim()
      .toUpperCase();
  }

  function countryFlag(code) {
    var raw = normalCode(code);
    var c = COUNTRY_FLAG_MAP[raw] || raw;
    return flagEmojiFromCountry(c);
  }

  function languageFlag(code) {
    var raw = normalCode(code);
    var c = LANGUAGE_FLAG_MAP[raw] || COUNTRY_FLAG_MAP[raw] || raw;
    return flagEmojiFromCountry(c);
  }

  function findOption(list, value) {
    value = normalCode(value);
    var found = null;
    (list || []).some(function (item) {
      if (normalCode(item.value) === value || normalCode(item.code) === value || normalCode(item.label) === value) {
        found = item;
        return true;
      }
      return false;
    });
    return found;
  }

  function languageLabel(value) {
    var opt = findOption(OPTIONS.languages, value);
    return (opt && (opt.label || opt.value)) || String(value || '-').replace(/^\[["']?/, '').replace(/["']?\]$/, '') || '-';
  }

  function optionText(item, type) {
    var value = item && item.value;
    var label = item && (item.label || item.value);
    var flag = type === 'language' ? languageFlag(value || label) : (type === 'country' ? countryFlag(value || label) : '');
    return (flag ? flag + ' ' : '') + (label || value || '');
  }

  function genderIcon(value) {
    value = String(value || '').toLowerCase();
    if (value === 'male' || value === 'm' || value === '男') return '♂';
    if (value === 'female' || value === 'f' || value === '女') return '♀';
    if (value === 'private' || value === 'secret' || value === '保密') return '·';
    if (value) return '◇';
    return '';
  }

  function genderMeta(user) {
    var icon = genderIcon(user.gender || user.genderCode);
    var age = Number(user.age || 0);
    var html = '';
    if (icon) html += '<span class="pps-gender-icon" aria-label="' + escapeHtml(TEXT.gender) + '">' + escapeHtml(icon) + '</span>';
    if (age) html += '<span class="pps-age">' + age + '岁</span>';
    return html;
  }

  function renderAvatarBlock(user) {
    var flag = user.flagEmoji || countryFlag(user.countryCode || user.language_flag);
    var online = user.isOnline || String(user.status || '').toLowerCase() === 'online';
    return '<div class="pps-avatar-wrap">' +
      avatarHtml(user, 'pps-avatar') +
      (flag ? '<span class="pps-avatar-flag">' + escapeHtml(flag) + '</span>' : '') +
      (online ? '<span class="pps-online-dot" aria-label="online"></span>' : '') +
    '</div>';
  }

  function renderLanguageChip(value, className) {
    var label = languageLabel(value);
    var flag = languageFlag(value || label);
    return '<span class="pps-lang-chip ' + (className || '') + '">' + (flag ? '<span class="pps-lang-flag">' + escapeHtml(flag) + '</span>' : '') + '<span>' + escapeHtml(label) + '</span></span>';
  }


  function optionLabel(list, value) {
    var opt = findOption(list, value);
    return (opt && (opt.label || opt.value)) || '';
  }

  function renderProfileDetails(user) {
    var chips = [];
    if (user.heightCm) chips.push(user.heightCm + 'cm');
    if (user.weightKg) chips.push(user.weightKg + 'kg');
    var edu = optionLabel(OPTIONS.educations, user.education);
    if (edu && edu !== '保密') chips.push(edu);
    if (user.occupation) chips.push(user.occupation);
    var rel = optionLabel(OPTIONS.relationships, user.relationship || user.relationshipStatus);
    if (rel && rel !== '保密') chips.push(rel);
    if (user.interestsText) chips.push(user.interestsText);
    if (!chips.length) return '';
    return '<div class="pps-detail-row">' + chips.slice(0, 4).map(function (txt) { return '<span class="pps-detail-chip">' + escapeHtml(txt) + '</span>'; }).join('') + '</div>';
  }

  function tagLabel(key) {
    var found = null;
    (state.tagCategories || []).some(function (cat) {
      return (cat.tags || []).some(function (tag) {
        if (tag.key === key) { found = tag; return true; }
        return false;
      });
    });
    if (!found) return key;
    return TEXT[found.labelKey] || found.label || key;
  }

  function categoryLabel(cat) {
    return TEXT[cat.labelKey] || cat.label || cat.key;
  }

  function isProfileComplete(profile) {
    return !!(profile && profile.displayName && profile.photos && profile.photos.length && profile.language_flag && profile.language_fluent && profile.language_learning && profile.gender && profile.birthday);
  }

  function normalisePhotos(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (url) {
      url = norm(url);
      if (url && out.indexOf(url) === -1) out.push(url);
    });
    return out.slice(0, CONFIG.maxPhotos);
  }

  function avatarHtml(user, cls) {
    var src = user && (user.avatar || user.accountPicture || user.uploadedpicture || user.picture);
    var name = (user && (user.displayName || user.username)) || 'U';
    if (src) return '<img class="' + cls + '" src="' + escapeHtml(src) + '" alt="avatar">';
    return '<span class="' + cls + ' pps-avatar-fallback">' + escapeHtml(name.slice(0, 1).toUpperCase()) + '</span>';
  }

  function iconBack() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>';
  }

  function iconSettings() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-.4-1.1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1A1.7 1.7 0 0 0 2.9 13H3a2 2 0 1 1 0-4h-.09a1.7 1.7 0 0 0 1.1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 .4 1.1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.37.5.7.9.9.33.17.7.26 1.1.26h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.1.26c-.4.2-.7.53-.9.9z"></path></svg>';
  }

  function iconGreet() {
    return '👋';
  }

  function loadTranslations() {
    return new Promise(function (resolve) {
      if (!window.require) return resolve();
      try {
        window.require(['translator'], function (translator) {
          var keys = Object.keys(TEXT);
          if (!translator || typeof translator.translate !== 'function' || !keys.length) return resolve();
          var left = keys.length;
          var done = false;
          function finish() {
            left -= 1;
            if (!left && !done) {
              done = true;
              resolve();
            }
          }
          keys.forEach(function (key) {
            try {
              translator.translate('[[peipe-partners-swipe:' + key + ']]', function (translated) {
                if (translated && translated.indexOf('[[') !== 0) TEXT[key] = translated;
                finish();
              });
            } catch (e) {
              finish();
            }
          });
          setTimeout(function () {
            if (!done) {
              done = true;
              resolve();
            }
          }, 1200);
        }, resolve);
      } catch (err) {
        resolve();
      }
    });
  }

  function buildChrome() {
    state.root.innerHTML = '' +
      '<div class="pps-native-feed" hidden></div>' +
      '<div class="pps-swiper swiper" hidden><div class="swiper-wrapper"></div></div>' +
      '<button type="button" class="pps-floating-settings pps-edit-profile" aria-label="' + escapeHtml(TEXT.settings) + '">' + iconSettings() + '</button>' +
      '<div class="pps-loading">' + escapeHtml(TEXT.loading) + '</div>' +
      '<div class="pps-toast" hidden></div>' +
      '<div class="pps-sheet-backdrop"></div>' +
      '<section class="pps-profile-sheet" role="dialog" aria-modal="true"></section>' +
      '<div class="pps-tag-backdrop"></div>' +
      '<section class="pps-tag-sheet" role="dialog" aria-modal="true"></section>';
  }

  function renderSlide(user, index) {
    var photos = normalisePhotos(user.photos);
    var photoSlides = photos.length ? photos.map(function (src) {
      return '<div class="swiper-slide"><img class="pps-photo" src="' + escapeHtml(src) + '" alt="photo" loading="eager" decoding="async"></div>';
    }).join('') : '<div class="swiper-slide"><div class="pps-no-photo">' + escapeHtml(TEXT.noPhoto) + '</div></div>';
    var dots = photos.length > 1 ? '<div class="pps-pagination"></div>' : '';
    var tags = (user.tags || []).slice(0, 8).map(function (key) { return '<span class="pps-tag">' + escapeHtml(tagLabel(key)) + '</span>'; }).join('');
    var meta = genderMeta(user);
    var bio = norm(user.bio) || TEXT.noBio;
    var native = user.nativeCode || user.language_fluent || '';
    var learn = user.learnCode || user.language_learning || '';

    return '' +
      '<section class="swiper-slide pps-slide" data-index="' + index + '" data-uid="' + Number(user.uid || 0) + '">' +
        '<div class="pps-photo-layer">' +
          '<div class="pps-photo-swiper swiper" data-index="' + index + '"><div class="swiper-wrapper">' + photoSlides + '</div>' + dots + '</div>' +
        '</div>' +
        '<div class="pps-gradient"></div>' +
        '<div class="pps-info">' +
          '<div class="pps-user-card">' +
            renderAvatarBlock(user) +
            '<div class="pps-user-main">' +
              '<div class="pps-name-row"><span class="pps-name">' + escapeHtml(user.displayName || user.username || 'User') + '</span>' + (meta ? '<span class="pps-user-meta">' + meta + '</span>' : '') + '</div>' +
              '<div class="pps-lang-row">' + renderLanguageChip(native, 'pps-native-chip') + '<span class="pps-arrow">→</span>' + renderLanguageChip(learn, 'pps-learn-chip') + '</div>' +
              renderProfileDetails(user) +
            '</div>' +
          '</div>' +
          '<div class="pps-bio">' + escapeHtml(bio) + '</div>' +
          (tags ? '<div class="pps-tags">' + tags + '</div>' : '') +
        '</div>' +
        '<div class="pps-side-actions"><button type="button" class="pps-greet-btn" data-uid="' + Number(user.uid || 0) + '"><span class="pps-greet-wave">👋</span><span class="pps-greet-label">Hi</span></button></div>' +
      '</section>';
  }

  function updateSlides(reset) {
    var html = state.users.map(renderSlide).join('');
    if (window.Swiper && state.swiper) {
      state.swiper.virtual.slides = state.users.map(renderSlide);
      state.swiper.virtual.update(true);
      if (reset) state.swiper.slideTo(0, 0);
      afterSlideUpdate();
      return;
    }
    var feed = $('.pps-native-feed', state.root);
    if (feed) feed.innerHTML = html;
    initPhotoSwipers();
    preloadAround(state.index);
  }


  function hideSettingsButton() {
    if (!state.settingsVisible) return;
    state.settingsVisible = false;
    var btn = $('.pps-floating-settings', state.root);
    if (btn) btn.classList.add('is-hidden');
  }

  function initMainSwiper() {
    var el = $('.pps-swiper', state.root);
    if (!el || !window.Swiper) return false;
    if (state.swiper) return true;
    state.swiper = new window.Swiper(el, {
      direction: 'vertical',
      slidesPerView: 1,
      speed: 250,
      threshold: 3,
      resistanceRatio: 0.38,
      watchSlidesProgress: true,
      preventClicks: false,
      preventClicksPropagation: false,
      passiveListeners: false,
      virtual: {
        enabled: true,
        addSlidesBefore: 1,
        addSlidesAfter: 2,
        slides: state.users.map(renderSlide)
      },
      on: {
        init: function (swiper) {
          state.index = swiper.activeIndex || 0;
          afterSlideUpdate();
        },
        slideChange: function (swiper) {
          state.index = swiper.activeIndex || 0;
          hideSettingsButton();
          if (state.index >= state.users.length - 4) loadFeed(false);
          afterSlideUpdate();
        },
        virtualUpdate: afterSlideUpdate,
        reachEnd: function () { loadFeed(false); }
      }
    });
    return true;
  }

  function afterSlideUpdate() {
    initPhotoSwipers();
    preloadAround(state.index);
  }

  function initPhotoSwipers() {
    if (!window.Swiper) return;
    $$('.pps-photo-swiper', state.root).forEach(function (el) {
      var idx = Number(el.dataset.index || -1);
      if (state.photoSwipers.has(idx) && state.photoSwipers.get(idx).el === el) return;
      var user = state.users[idx];
      if (!user) return;
      var photos = normalisePhotos(user.photos);
      if (photos.length <= 1) return;
      var sw = new window.Swiper(el, {
        direction: 'horizontal',
        slidesPerView: 1,
        speed: 220,
        nested: true,
        threshold: 3,
        resistanceRatio: 0.55,
        pagination: { el: $('.pps-pagination', el), clickable: false }
      });
      state.photoSwipers.set(idx, sw);
    });
  }

  function useNativeFeed() {
    state.nativeMode = true;
    $('.pps-swiper', state.root).hidden = true;
    var feed = $('.pps-native-feed', state.root);
    feed.hidden = false;
    feed.addEventListener('scroll', function () {
      var idx = Math.max(0, Math.round(feed.scrollTop / Math.max(1, feed.clientHeight)));
      if (idx !== state.index) {
        state.index = idx;
        hideSettingsButton();
        preloadAround(idx);
        if (idx >= state.users.length - 4) loadFeed(false);
      }
    });
  }

  function showFeed() {
    var loading = $('.pps-loading', state.root);
    if (loading) loading.hidden = true;
    if (window.Swiper) {
      $('.pps-swiper', state.root).hidden = false;
      $('.pps-native-feed', state.root).hidden = true;
      initMainSwiper();
      updateSlides(false);
    } else {
      useNativeFeed();
      updateSlides(false);
    }
  }

  function showEmpty(text) {
    var loading = $('.pps-loading', state.root);
    if (loading) loading.outerHTML = '<div class="pps-empty">' + escapeHtml(text || TEXT.empty) + '</div>';
  }

  function preloadImage(src) {
    if (!src) return;
    try {
      var img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
    } catch (e) {}
  }

  function preloadAround(index) {
    var start = Math.max(0, Number(index || 0));
    var end = Math.min(state.users.length - 1, start + CONFIG.preloadAhead);
    for (var i = start; i <= end; i += 1) {
      normalisePhotos(state.users[i] && state.users[i].photos).slice(0, 2).forEach(preloadImage);
      var avatar = state.users[i] && (state.users[i].avatar || state.users[i].accountPicture);
      preloadImage(avatar);
    }
  }

  function loadFeed(refresh) {
    if (state.loading || (state.done && !refresh)) return Promise.resolve();
    state.loading = true;
    if (refresh) {
      state.done = false;
      state.users = [];
      state.index = 0;
      state.photoSwipers.clear();
    }
    return apiFetch('/api/peipe-partners/swipe/feed?mode=recommend&limit=' + CONFIG.pageSize)
      .then(function (json) {
        var users = Array.isArray(json.users) ? json.users : [];
        state.users = refresh ? users : state.users.concat(users);
        state.done = json.hasMore === false || users.length === 0;
        if (!state.users.length) showEmpty(TEXT.empty);
        else showFeed();
      })
      .catch(function (err) {
        console.warn('[peipe-swipe] feed failed', err);
        showEmpty(err.message || TEXT.empty);
      })
      .finally(function () { state.loading = false; });
  }

  function loadMe() {
    if (!isLoggedIn()) {
      state.profileComplete = true;
      return Promise.resolve();
    }
    return apiFetch('/api/peipe-partners/swipe/me')
      .then(function (json) {
        state.profile = json.profile || {};
        state.profileComplete = !!json.complete;
        state.tagCategories = json.tagCategories || [];
        if (!state.profileComplete) openProfile(true);
      })
      .catch(function (err) {
        console.warn('[peipe-swipe] me failed', err);
      });
  }

  function ensureGenderOptions() {
    var seen = {};
    OPTIONS.genders = (OPTIONS.genders || []).filter(function (item) {
      if (!item || !item.value || seen[item.value]) return false;
      seen[item.value] = true;
      return true;
    });
    if (!seen.private && !seen['保密']) OPTIONS.genders.unshift({ value: 'private', label: TEXT.privateGender });
  }

  function loadOptions() {
    ensureGenderOptions();
    return apiFetch('/api/peipe-partners/options')
      .then(function (json) {
        if (Array.isArray(json.countries)) OPTIONS.countries = json.countries;
        if (Array.isArray(json.languages)) OPTIONS.languages = json.languages;
        if (Array.isArray(json.genders)) OPTIONS.genders = json.genders;
        if (Array.isArray(json.relationships)) OPTIONS.relationships = json.relationships;
        if (Array.isArray(json.educations)) OPTIONS.educations = json.educations;
        ensureGenderOptions();
      })
      .catch(function () { ensureGenderOptions(); });
  }

  function loadTags() {
    return apiFetch('/api/peipe-partners/swipe/tags')
      .then(function (json) { state.tagCategories = json.categories || state.tagCategories || []; })
      .catch(function () {});
  }

  function toast(text) {
    var el = $('.pps-toast', state.root);
    if (!el) return;
    clearTimeout(state.toastTimer);
    el.textContent = text;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-open'); });
    state.toastTimer = setTimeout(function () {
      el.classList.remove('is-open');
      setTimeout(function () { el.hidden = true; }, 210);
    }, 2100);
  }

  function greet(uid, btn) {
    if (!isLoggedIn()) {
      toast(TEXT.login);
      return;
    }
    if (!uid || !btn || btn.disabled) return;
    btn.disabled = true;
    var label = $('.pps-greet-label', btn);
    var old = label ? label.textContent : TEXT.greet;
    if (label) label.textContent = TEXT.greeting;
    apiFetch('/api/peipe-partners/me/greet', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: jsonBody({ uid: uid })
    }).then(function (json) {
      if (json && json.already) toast(TEXT.greetAlready);
      else toast(TEXT.greetOk);
      if (label) label.textContent = TEXT.greeted;
    }).catch(function (err) {
      if (/daily-limit/.test(err.message)) toast(TEXT.greetLimit);
      else toast(err.message || TEXT.greetFail);
      btn.disabled = false;
      if (label) label.textContent = old;
    });
  }

  function buildSelect(name, list, value) {
    var type = name === 'language_flag' ? 'country' : ((name === 'language_fluent' || name === 'language_learning') ? 'language' : 'text');
    var html = '<option value="">' + escapeHtml(TEXT.selectPlaceholder) + '</option>';
    html += (list || []).map(function (item) {
      var selected = String(item.value) === String(value || '') ? ' selected' : '';
      return '<option value="' + escapeHtml(item.value) + '"' + selected + '>' + escapeHtml(optionText(item, type)) + '</option>';
    }).join('');
    return '<select name="' + name + '">' + html + '</select>';
  }

  function renderPhotoTiles(photos) {
    photos = normalisePhotos(photos);
    if (!photos.length) return '';
    return photos.map(function (src, index) {
      return '<div class="pps-photo-tile"><img src="' + escapeHtml(src) + '" alt="photo"><button type="button" class="pps-photo-remove" data-index="' + index + '">×</button></div>';
    }).join('');
  }

  function renderSelectedTags(tags) {
    tags = Array.isArray(tags) ? tags : [];
    if (!tags.length) return '<span class="pps-form-note">' + escapeHtml(TEXT.chooseTags) + '</span>';
    return tags.map(function (key) { return '<span class="pps-mini-tag">' + escapeHtml(tagLabel(key)) + '</span>'; }).join('');
  }

  function openProfile(required) {
    state.requiredProfile = !!required;
    var profile = Object.assign({}, state.profile || {});
    profile.photos = normalisePhotos(profile.photos);
    state.selectedTags = Array.isArray(profile.tags) ? profile.tags.slice(0, 12) : [];
    var sheet = $('.pps-profile-sheet', state.root);
    var backdrop = $('.pps-sheet-backdrop', state.root);
    var me = currentUser() || {};
    var avatar = profile.avatar || profile.accountPicture || me.picture || me.uploadedpicture || '';
    var title = required ? TEXT.profileTitle : TEXT.editProfileTitle;

    sheet.innerHTML = '' +
      '<div class="pps-profile-scroll">' +
        '<div class="pps-profile-head"><div><div class="pps-profile-title">' + escapeHtml(title) + '</div><div class="pps-profile-subtitle">' + escapeHtml(TEXT.profileSubtitle) + '</div></div><button type="button" class="pps-close-btn pps-profile-close" ' + (required ? 'hidden' : '') + '>×</button></div>' +
        '<div class="pps-form-grid">' +
          '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.displayName) + '</label><div class="pps-display-row">' + (avatar ? '<img class="pps-form-avatar" src="' + escapeHtml(avatar) + '" alt="avatar">' : '<div class="pps-form-avatar"></div>') + '<input name="displayName" maxlength="40" value="' + escapeHtml(profile.displayName || profile.username || me.username || '') + '"></div></div>' +
          '<div class="pps-field pps-span-2"><div class="pps-field-title">' + escapeHtml(TEXT.photos) + '</div><div class="pps-photos-row">' + renderPhotoTiles(profile.photos) + '</div><input class="pps-photo-input" type="file" accept="image/*" multiple hidden><button type="button" class="pps-upload-btn">' + escapeHtml(TEXT.uploadPhotos) + '</button><div class="pps-form-note">' + escapeHtml(TEXT.maxPhotos) + '</div></div>' +
          '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.bio) + '</label><textarea name="bio" maxlength="180" placeholder="' + escapeHtml(TEXT.bioPlaceholder) + '">' + escapeHtml(profile.bio || '') + '</textarea></div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.country) + '</label>' + buildSelect('language_flag', OPTIONS.countries, profile.language_flag) + '</div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.gender) + '</label>' + buildSelect('gender', OPTIONS.genders, profile.gender) + '</div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.nativeLanguage) + '</label>' + buildSelect('language_fluent', OPTIONS.languages, profile.language_fluent) + '</div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.learningLanguage) + '</label>' + buildSelect('language_learning', OPTIONS.languages, profile.language_learning) + '</div>' +
          '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.birthday) + '</label><input type="date" name="birthday" value="' + escapeHtml(profile.birthday || '') + '"></div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.height) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label><input inputmode="decimal" name="heightCm" maxlength="5" placeholder="' + escapeHtml(TEXT.heightPlaceholder) + '" value="' + escapeHtml(profile.heightCm || '') + '"></div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.weight) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label><input inputmode="decimal" name="weightKg" maxlength="5" placeholder="' + escapeHtml(TEXT.weightPlaceholder) + '" value="' + escapeHtml(profile.weightKg || '') + '"></div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.education) + '</label>' + buildSelect('education', OPTIONS.educations, profile.education) + '</div>' +
          '<div class="pps-field"><label>' + escapeHtml(TEXT.relationship) + '</label>' + buildSelect('relationship', OPTIONS.relationships, profile.relationship || profile.relationshipStatus) + '</div>' +
          '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.occupation) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label><input name="occupation" maxlength="60" placeholder="' + escapeHtml(TEXT.occupationPlaceholder) + '" value="' + escapeHtml(profile.occupation || '') + '"></div>' +
          '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.interests) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label><input name="interestsText" maxlength="120" placeholder="' + escapeHtml(TEXT.interestsPlaceholder) + '" value="' + escapeHtml(profile.interestsText || '') + '"></div>' +
          '<div class="pps-field pps-span-2"><div class="pps-field-title">' + escapeHtml(TEXT.tags) + '</div><div class="pps-selected-tags">' + renderSelectedTags(state.selectedTags) + '</div><button type="button" class="pps-select-tags-btn">' + escapeHtml(TEXT.chooseTags) + '</button></div>' +
          '<div class="pps-field pps-span-2"><button type="button" class="pps-save-btn">' + escapeHtml(TEXT.save) + '</button></div>' +
        '</div>' +
      '</div>';

    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  }

  function closeProfile() {
    if (state.requiredProfile) return;
    $('.pps-sheet-backdrop', state.root).classList.remove('is-open');
    $('.pps-profile-sheet', state.root).classList.remove('is-open');
  }

  function getProfilePhotosFromSheet() {
    return $$('.pps-photo-tile img', state.root).map(function (img) { return img.getAttribute('src'); }).filter(Boolean).slice(0, CONFIG.maxPhotos);
  }

  function updateProfilePhotoTiles(photos) {
    var box = $('.pps-photos-row', state.root);
    if (box) box.innerHTML = renderPhotoTiles(photos);
  }

  function collectProfileData() {
    var sheet = $('.pps-profile-sheet', state.root);
    return {
      displayName: norm($('[name="displayName"]', sheet).value),
      photos: getProfilePhotosFromSheet(),
      bio: norm($('[name="bio"]', sheet).value),
      language_flag: $('[name="language_flag"]', sheet).value,
      language_fluent: $('[name="language_fluent"]', sheet).value,
      language_learning: $('[name="language_learning"]', sheet).value,
      gender: $('[name="gender"]', sheet).value,
      birthday: $('[name="birthday"]', sheet).value,
      heightCm: norm($('[name="heightCm"]', sheet).value),
      weightKg: norm($('[name="weightKg"]', sheet).value),
      education: $('[name="education"]', sheet).value,
      relationship: $('[name="relationship"]', sheet).value,
      occupation: norm($('[name="occupation"]', sheet).value),
      interestsText: norm($('[name="interestsText"]', sheet).value),
      tags: state.selectedTags.slice(0, 12)
    };
  }

  function profileMissing(data) {
    var missing = [];
    if (!data.displayName) missing.push('displayName');
    if (!data.photos.length) missing.push('photos');
    if (!data.language_flag) missing.push('country');
    if (!data.language_fluent) missing.push('nativeLanguage');
    if (!data.language_learning) missing.push('learningLanguage');
    if (!data.gender) missing.push('gender');
    if (!data.birthday) missing.push('birthday');
    return missing;
  }

  function missingLabel(key) {
    var map = {
      displayName: TEXT.displayName,
      photos: TEXT.photos,
      country: TEXT.country,
      nativeLanguage: TEXT.nativeLanguage,
      learningLanguage: TEXT.learningLanguage,
      gender: TEXT.gender,
      birthday: TEXT.birthday
    };
    return map[key] || key;
  }

  function validateProfile(data) {
    var missing = profileMissing(data);
    if (missing.length) {
      toast(TEXT.missingPrefix + missing.map(missingLabel).join('、'));
      return false;
    }
    return true;
  }

  function saveProfile() {
    if (state.uploadBusy) return toast(TEXT.uploading);
    var data = collectProfileData();
    if (!validateProfile(data)) return;
    var btn = $('.pps-save-btn', state.root);
    btn.disabled = true;
    btn.textContent = TEXT.saving;
    apiFetch('/api/peipe-partners/swipe/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
      body: jsonBody(data)
    }).then(function (json) {
      state.profile = json.profile || data;
      state.profileComplete = !!json.complete;
      state.requiredProfile = false;
      toast(TEXT.saveOk);
      $('.pps-sheet-backdrop', state.root).classList.remove('is-open');
      $('.pps-profile-sheet', state.root).classList.remove('is-open');
      loadFeed(true);
    }).catch(function (err) {
      toast(err.message || TEXT.saveFail);
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = TEXT.save;
    });
  }

  function canCanvasEncode(type) {
    return new Promise(function (resolve) {
      try {
        var c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        c.toBlob(function (b) { resolve(!!b && b.type === type); }, type, 0.8);
      } catch (e) { resolve(false); }
    });
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(TEXT.imageOnly)); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  function compressImageFile(file) {
    if (!file || !/^image\//i.test(file.type)) return Promise.reject(new Error(TEXT.imageOnly));
    if (/gif|svg/i.test(file.type)) {
      if (file.size <= CONFIG.maxUploadBytes) return Promise.resolve(file);
      return Promise.reject(new Error(TEXT.imageTooLarge));
    }
    return loadImageFromFile(file).then(function (img) {
      var maxSide = CONFIG.imageMaxSide;
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      var scale = Math.min(1, maxSide / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      var ctx = canvas.getContext('2d');
      if (!ctx || !canvas.toBlob) {
        if (file.size <= CONFIG.maxUploadBytes) return file;
        throw new Error(TEXT.imageTooLarge);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canCanvasEncode('image/webp').then(function (webp) {
        var type = webp ? 'image/webp' : 'image/jpeg';
        var quality = CONFIG.imageQualityStart;
        function step() {
          return canvasToBlob(canvas, type, quality).then(function (blob) {
            if (!blob) throw new Error(TEXT.imageTooLarge);
            if (blob.size <= CONFIG.maxUploadBytes || quality <= CONFIG.imageQualityMin) return blob;
            quality = Math.max(CONFIG.imageQualityMin, quality - 0.10);
            return step();
          });
        }
        return step().then(function (blob) {
          if (blob.size > CONFIG.maxUploadBytes) throw new Error(TEXT.imageTooLarge);
          var name = String(file.name || ('photo-' + Date.now())).replace(/\.[^.]+$/, '') + (type === 'image/webp' ? '.webp' : '.jpg');
          return new File([blob], name, { type: type, lastModified: Date.now() });
        });
      });
    });
  }

  function extractUploadUrl(payload) {
    var q = [payload];
    var seen = new Set();
    while (q.length) {
      var cur = q.shift();
      if (!cur || seen.has(cur)) continue;
      if (typeof cur === 'string' && (/^(https?:)?\//i.test(cur) || /^\/assets\//i.test(cur) || /^\/uploads\//i.test(cur))) return cur;
      if (typeof cur !== 'object') continue;
      seen.add(cur);
      if (Array.isArray(cur)) q.push.apply(q, cur);
      else Object.keys(cur).forEach(function (k) { q.push(cur[k]); });
    }
    throw new Error('upload url missing');
  }

  function uploadToNodeBB(file) {
    var cids = [CONFIG.uploadCid || 1, 0, 1, 6].filter(function (cid, index, arr) {
      cid = Number(cid || 0);
      return arr.indexOf(cid) === index;
    });
    var lastError = null;

    function tryOne(i) {
      var cid = cids[i];
      var form = new FormData();
      form.append('files[]', file);
      form.append('file', file);
      form.append('cid', String(cid));

      return fetch(rel('/api/post/upload'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'x-csrf-token': csrfToken(), 'x-requested-with': 'XMLHttpRequest' },
        body: form
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok) throw new Error(json.error || json.message || 'upload failed');
          return extractUploadUrl(json);
        });
      }).catch(function (err) {
        lastError = err;
        if (i + 1 < cids.length) return tryOne(i + 1);
        throw lastError || err;
      });
    }

    return tryOne(0);
  }

  function handlePhotoFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (file) { return /^image\//i.test(file.type); });
    if (!files.length) return toast(TEXT.imageOnly);
    var current = getProfilePhotosFromSheet();
    files = files.slice(0, Math.max(0, CONFIG.maxPhotos - current.length));
    if (!files.length) return;
    state.uploadBusy = true;
    var btn = $('.pps-upload-btn', state.root);
    if (btn) { btn.disabled = true; btn.textContent = TEXT.uploading; }
    var chain = Promise.resolve();
    var uploaded = [];
    files.forEach(function (file) {
      chain = chain.then(function () {
        return compressImageFile(file).then(uploadToNodeBB).then(function (url) {
          uploaded.push(url);
          updateProfilePhotoTiles(current.concat(uploaded).slice(0, CONFIG.maxPhotos));
        });
      });
    });
    chain.catch(function (err) {
      toast(err.message || TEXT.imageTooLarge);
    }).finally(function () {
      state.uploadBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = TEXT.uploadPhotos; }
    });
  }

  function renderTagSheet() {
    state.tagDraft = state.selectedTags.slice(0, 12);
    var sheet = $('.pps-tag-sheet', state.root);
    var groups = (state.tagCategories || []).map(function (cat) {
      var choices = (cat.tags || []).map(function (tag) {
        var selected = state.tagDraft.indexOf(tag.key) !== -1;
        return '<button type="button" class="pps-tag-choice ' + (selected ? 'is-selected' : '') + '" data-key="' + escapeHtml(tag.key) + '">' + escapeHtml(TEXT[tag.labelKey] || tag.label || tag.key) + '</button>';
      }).join('');
      return '<div class="pps-tag-category">' + escapeHtml(categoryLabel(cat)) + '</div><div class="pps-tag-grid">' + choices + '</div>';
    }).join('');

    sheet.innerHTML = '' +
      '<div class="pps-tag-scroll">' +
        '<div class="pps-tag-head"><div><div class="pps-tag-title">' + escapeHtml(TEXT.tagTitle) + '</div><div class="pps-profile-subtitle"><span class="pps-tag-count">' + escapeHtml(TEXT.selectedCount) + ' ' + state.tagDraft.length + '/12</span></div></div><button type="button" class="pps-close-btn pps-tag-close">×</button></div>' +
        groups +
        '<div class="pps-tag-actions"><button type="button" class="pps-tag-clear">' + escapeHtml(TEXT.tagClear) + '</button><button type="button" class="pps-tag-done">' + escapeHtml(TEXT.tagDone) + '</button></div>' +
      '</div>';
    $('.pps-tag-backdrop', state.root).classList.add('is-open');
    sheet.classList.add('is-open');
  }

  function closeTags(save) {
    if (save) {
      state.selectedTags = state.tagDraft.slice(0, 12);
      var selectedBox = $('.pps-selected-tags', state.root);
      if (selectedBox) selectedBox.innerHTML = renderSelectedTags(state.selectedTags);
    }
    $('.pps-tag-backdrop', state.root).classList.remove('is-open');
    $('.pps-tag-sheet', state.root).classList.remove('is-open');
  }

  function updateTagCount() {
    var count = $('.pps-tag-count', state.root);
    if (count) count.textContent = TEXT.selectedCount + ' ' + state.tagDraft.length + '/12';
  }

  function toggleTag(key, btn) {
    var idx = state.tagDraft.indexOf(key);
    if (idx !== -1) state.tagDraft.splice(idx, 1);
    else if (state.tagDraft.length < 12) state.tagDraft.push(key);
    else return;
    if (btn) btn.classList.toggle('is-selected', state.tagDraft.indexOf(key) !== -1);
    updateTagCount();
  }

  function bindEvents() {
    state.root.addEventListener('click', function (e) {
      var btn;
      if ((btn = e.target.closest('.pps-greet-btn'))) {
        e.preventDefault();
        e.stopPropagation();
        greet(Number(btn.dataset.uid || 0), btn);
        return;
      }
      if (e.target.closest('.pps-edit-profile')) {
        e.preventDefault();
        e.stopPropagation();
        openProfile(false);
        return;
      }
      if (e.target.closest('.pps-profile-close')) {
        e.preventDefault();
        closeProfile();
        return;
      }
      if (e.target.closest('.pps-upload-btn')) {
        e.preventDefault();
        var input = $('.pps-photo-input', state.root);
        if (input) input.click();
        return;
      }
      if ((btn = e.target.closest('.pps-photo-remove'))) {
        e.preventDefault();
        var photos = getProfilePhotosFromSheet();
        photos.splice(Number(btn.dataset.index || 0), 1);
        updateProfilePhotoTiles(photos);
        return;
      }
      if (e.target.closest('.pps-select-tags-btn')) {
        e.preventDefault();
        renderTagSheet();
        return;
      }
      if (e.target.closest('.pps-save-btn')) {
        e.preventDefault();
        saveProfile();
        return;
      }
      if (e.target.closest('.pps-tag-close')) {
        e.preventDefault();
        closeTags(false);
        return;
      }
      if (e.target.closest('.pps-tag-done')) {
        e.preventDefault();
        closeTags(true);
        return;
      }
      if (e.target.closest('.pps-tag-clear')) {
        e.preventDefault();
        state.tagDraft = [];
        $$('.pps-tag-choice', state.root).forEach(function (node) { node.classList.remove('is-selected'); });
        updateTagCount();
        return;
      }
      if ((btn = e.target.closest('.pps-tag-choice'))) {
        e.preventDefault();
        toggleTag(btn.dataset.key, btn);
      }
    }, true);

    state.root.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('pps-photo-input')) {
        var files = e.target.files;
        e.target.value = '';
        handlePhotoFiles(files);
      }
    });
  }

  function enterFullScreenMode() {
    document.documentElement.classList.add('peipe-swipe-html');
    document.body.classList.add('peipe-swipe-mode');
  }

  function init() {
    state.root = document.getElementById('peipe-swipe-app');
    if (!state.root || state.root.dataset.ppsReady === '1') return;
    state.root.dataset.ppsReady = '1';
    state.settingsVisible = true;
    state.swiper = null;
    state.users = [];
    state.done = false;
    state.loading = false;
    enterFullScreenMode();
    loadTranslations().then(function () {
      buildChrome();
      bindEvents();
      Promise.all([loadOptions(), loadTags(), loadMe(), ensureSwiper()]).then(function () {
        loadFeed(true);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  if (window.ajaxify && window.ajaxify.on) {
    window.ajaxify.on('action:ajaxify.end', init);
  }
})();
