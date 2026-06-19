/* Peipe Partners Swipe v12
   - full-screen mobile page
   - vertical swipe partners, horizontal swipe photos
   - profile setup with frosted glass sheet
   - direct NodeBB photo upload; optional compression must never block upload
   - no avatar-as-background: avatar is avatar, partner photos are separate
*/
(function () {
  'use strict';

  if (window.__peipePartnersSwipeV12) return;
  window.__peipePartnersSwipeV12 = true;
  window.__peipePartnersSwipeV11 = true;
  window.__peipePartnersSwipeV10 = true;
  window.__peipePartnersSwipeV9 = true;
  window.__peipePartnersSwipeV8 = true;
  window.__peipePartnersSwipeV7 = true;
  window.__peipePartnersSwipeV6 = true;
  window.__peipePartnersSwipeV5 = true;

  // NodeBB ajaxify tries to load a forum route module named after the template.
  // Defining this small no-op module prevents the "Cannot find module ./peipe-partners-swipe" console error.
  if (typeof define === 'function' && define.amd && !window.__peipePartnersSwipeForumModule) {
    window.__peipePartnersSwipeForumModule = true;
    define('forum/peipe-partners-swipe', [], function () { return { init: function () {} }; });
    try { define('forum/peipe-nearby-swipe', [], function () { return { init: function () {} }; }); } catch (err) {}
  }

  var CONFIG = Object.assign({
    pageSize: 18,
    maxPhotos: 5,
    uploadCid: 6,
    imageConfig: {
      maxSide: 1440,
      maxSizeMB: 0.12,
      quality: 0.60,
      minCompressBytes: 120 * 1024,
      useWebp: true,
      qualities: [0.60, 0.52, 0.45, 0.38, 0.32, 0.26, 0.20]
    },
    avatarImageConfig: {
      maxSide: 720,
      maxSizeMB: 0.10,
      quality: 0.58,
      minCompressBytes: 80 * 1024,
      useWebp: true,
      qualities: [0.58, 0.50, 0.42, 0.34, 0.28, 0.22]
    },
    preloadAhead: 2,
    swiperCss: '/plugins/nodebb-plugin-peipe-swipe-official/swipe/vendor/swiper-bundle.min.css',
    swiperJs: '/plugins/nodebb-plugin-peipe-swipe-official/swipe/vendor/swiper-bundle.min.js',
    swiperFallbackCss: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
    swiperFallbackJs: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',

    // 悟空独立版接口配置
    wkSdkUrls: [
      '/plugins/nodebb-plugin-wukong-chat/static/vendor/wukongimjssdk.umd.js',
      'https://cdn.jsdelivr.net/npm/wukongimjssdk@latest/lib/wukongimjssdk.umd.js'
    ],
    wkTokenPath: '/api/wukong/token',
    wkGreetPath: '/api/peipe-partners/me/wukong-greet',
    wkConversationUpsertPath: '/api/wukong/conversations/upsert',
    wkWsPath: '/wkws/'
  }, window.PEIPE_SWIPE_CONFIG || {});

  var TEXT = {
    loading: '语伴加载中...',
    empty: '新的语伴暂时看完了，正在随机回看可能合适的人',
    login: '请先登录',
    profileTitle: '完善语伴资料',
    profileSubtitle: '第一次打开语伴前，需要先填写这些资料。',
    editProfileTitle: '编辑语伴资料',
    displayName: '用户名 / 显示名',
    photos: '语伴照片',
    uploadPhotos: '上传手机图片',
    uploading: '上传中...',
    compressing: '压缩中...',
    uploadAvatar: '上传头像',
    imageTooLarge: '图片压缩后仍超过 5MB，请换一张图片',
    imageOnly: '请选择图片',
    maxPhotos: '',
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
    location: '距离',
    heightPlaceholder: '170',
    weightPlaceholder: '60',
    occupationPlaceholder: '请选择职业',
    locationPlaceholder: '',
    cropAvatar: '裁切头像',
    cropTip: '拖动图片调整位置，滑动缩放。建议裁到头像或半身。',
    cropUse: '上传头像',
    cropCancel: '取消',
    optional: '选填',
    tags: '标签',
    chooseTags: '选择标签',
    save: '保存资料',
    leave: '离开',
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
    tagDone: '保存',
    tagClear: '清空',
    selectedCount: '已选',
    male: '男',
    female: '女',
    other: '其他',
    privateGender: '保密',
    selectPlaceholder: '请选择',
    missingPrefix: '请先补全：',
    settings: '资料',
    recommendTab: '推荐',
    nearbyTab: '附近的人',
    switchToRecommend: '已切换到推荐',
    switchToNearby: '已切换到附近的人',
    back: '返回',
    chooseOption: '请选择',
    doneOption: '保存',
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
      { value: 'private', label: TEXT.privateGender }
    ],
    relationships: [
      { value: '', label: TEXT.selectPlaceholder },
      { value: 'private', label: '保密' },
      { value: 'single', label: '单身' },
      { value: 'dating', label: '恋爱中' },
      { value: 'married', label: '已婚' },
      { value: 'divorced', label: '离异' }
    ],
    educations: [
      { value: '', label: TEXT.selectPlaceholder },
      { value: 'private', label: '保密' },
      { value: 'middle_school', label: '初中' },
      { value: 'high_school', label: '高中' },
      { value: 'college', label: '大专' },
      { value: 'bachelor', label: '本科' },
      { value: 'master', label: '硕士' },
      { value: 'doctor', label: '博士' }
    ],
    occupations: [
      { value: '', label: TEXT.selectPlaceholder },
      { value: 'student', label: '在校生' },
      { value: 'worker', label: '普通职工' },
      { value: 'waiter', label: '服务员' },
      { value: 'teacher', label: '老师' },
      { value: 'police', label: '警察' },
      { value: 'driver', label: '司机' },
      { value: 'sales', label: '销售' },
      { value: 'developer', label: '程序员' },
      { value: 'designer', label: '设计师' },
      { value: 'business_owner', label: '个体/老板' },
      { value: 'unemployed', label: '无业' },
      { value: 'other', label: '其他' }
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
    nativeFeedBound: false,
    settingsVisible: true,
    seenUids: {},
    feedRequestId: 0,
    selectionGuardBound: false,
    modeGesture: null,

    // 悟空 SDK 状态
    wkReadyPromise: null,
    wkUid: '',
    wkConnectedStarted: false
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

    var timeoutMs = Number(options.timeoutMs || 12000);
    var controller = null;
    var timer = 0;

    if (window.AbortController && !options.signal) {
      controller = new AbortController();
      options.signal = controller.signal;
    }

    delete options.timeoutMs;

    var req = fetch(rel(url), options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) {
          var msg = json.error || json.message || (json.status && json.status.message) || ('HTTP ' + res.status);
          throw new Error(msg);
        }
        return json.response || json;
      });
    });

    var timeout = new Promise(function (resolve, reject) {
      if (!timeoutMs || timeoutMs <= 0) return;
      timer = setTimeout(function () {
        try { if (controller) controller.abort(); } catch (e) {}
        reject(new Error('请求超时，请检查网络或接口：' + url));
      }, timeoutMs);
    });

    return Promise.race([req, timeout]).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }


  function loadScriptOnce(url, key) {
    if (window.wk && window.wk.WKSDK) return Promise.resolve();

    key = key || String(url || '');

    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-pps-wk-sdk-key="' + key + '"]');

      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        if (existing.dataset.error === '1') return reject(new Error('悟空 SDK 加载失败'));
        existing.addEventListener('load', function () { resolve(); }, { once: true });
        existing.addEventListener('error', function () { reject(new Error('悟空 SDK 加载失败')); }, { once: true });
        return;
      }

      var s = document.createElement('script');
      s.src = rel(url);
      s.async = true;
      s.dataset.ppsWkSdkKey = key;
      s.onload = function () { s.dataset.loaded = '1'; resolve(); };
      s.onerror = function () { s.dataset.error = '1'; reject(new Error('悟空 SDK 加载失败：' + url)); };
      document.head.appendChild(s);
    });
  }

  function loadWukongSdk() {
    if (window.wk && window.wk.WKSDK) return Promise.resolve();

    var urls = CONFIG.wkSdkUrls || [];
    var index = 0;

    function next() {
      var url = urls[index++];
      if (!url) return Promise.reject(new Error('悟空 SDK 未加载'));

      return loadScriptOnce(url, 'pps-wk-sdk-' + index).then(function () {
        if (window.wk && window.wk.WKSDK) return true;
        throw new Error('悟空 SDK 格式不正确');
      }).catch(function () {
        return next();
      });
    }

    return next();
  }

  function ensureWukongReady() {
    if (state.wkReadyPromise) return state.wkReadyPromise;

    state.wkReadyPromise = apiFetch(CONFIG.wkTokenPath, {
      method: 'GET'
    }).then(function (token) {
      if (!token || !token.uid || !token.token) {
        throw new Error('悟空 token 获取失败');
      }

      state.wkUid = String(token.uid);

      return loadWukongSdk().then(function () {
        var wk = window.wk;

        if (!wk || !wk.WKSDK) {
          throw new Error('悟空 SDK 不可用');
        }

        wk.WKSDK.shared().config.uid = String(token.uid);
        wk.WKSDK.shared().config.token = String(token.token);

        // 优先使用 /api/wukong/token 返回的 WebSocket 地址
        wk.WKSDK.shared().config.addr = String(
          token.addr ||
          token.wsAddr ||
          token.wkws ||
          ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + CONFIG.wkWsPath)
        );

        // 只启动一次连接，避免重复 connect
        if (!state.wkConnectedStarted) {
          state.wkConnectedStarted = true;
          try {
            wk.WKSDK.shared().connectManager.connect();
          } catch (err) {}
        }

        return token;
      });
    }).catch(function (err) {
      state.wkReadyPromise = null;
      state.wkConnectedStarted = false;
      throw err;
    });

    return state.wkReadyPromise;
  }

  function waitWukongConnected(timeoutMs) {
    timeoutMs = Number(timeoutMs || 1800);

    return new Promise(function (resolve) {
      var wk = window.wk;
      var done = false;
      var timer = 0;
      var listener = null;

      function finish() {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        try {
          if (listener && wk && wk.WKSDK && wk.WKSDK.shared().connectManager && typeof wk.WKSDK.shared().connectManager.removeConnectStatusListener === 'function') {
            wk.WKSDK.shared().connectManager.removeConnectStatusListener(listener);
          }
        } catch (err) {}
        resolve(true);
      }

      try {
        if (!wk || !wk.WKSDK || !wk.WKSDK.shared().connectManager) return finish();

        listener = function (status) {
          var text = String(status || '');
          if ((wk.ConnectStatus && status === wk.ConnectStatus.Connected) || /connected/i.test(text) || status === 1) {
            finish();
          }
        };

        if (typeof wk.WKSDK.shared().connectManager.addConnectStatusListener === 'function') {
          wk.WKSDK.shared().connectManager.addConnectStatusListener(listener);
        }

        if (!state.wkConnectedStarted) {
          state.wkConnectedStarted = true;
          try { wk.WKSDK.shared().connectManager.connect(); } catch (err) {}
        }
      } catch (err) {
        return finish();
      }

      timer = setTimeout(finish, timeoutMs);
    });
  }

  function createWukongTextMessage(text) {
    var wk = window.wk;
    if (!wk || !wk.MessageText) {
      throw new Error('悟空 MessageText 不可用');
    }

    // 悟空 SDK 官方文本消息就是 MessageText；不要重写 encode，避免不同 SDK 版本格式不兼容。
    var msgContent = new wk.MessageText(text);
    msgContent.text = text;
    msgContent.content = text;
    msgContent.peipeGreet = true;
    return msgContent;
  }

  function sendWukongGreet(toUid, text) {
    return ensureWukongReady().then(function () {
      return waitWukongConnected(1800);
    }).then(function () {
      var wk = window.wk;

      if (!wk || !wk.WKSDK || !wk.Channel) {
        throw new Error('悟空 SDK 不可用');
      }

      var channel = new wk.Channel(String(toUid), 1);
      var msgContent = createWukongTextMessage(text);

      return Promise.resolve(
        wk.WKSDK.shared().chatManager.send(msgContent, channel)
      );
    });
  }

  function syncWukongConversation(toUid, text) {
    return apiFetch(CONFIG.wkConversationUpsertPath, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-csrf-token': csrfToken()
      },
      body: jsonBody({
        channel_id: String(toUid),
        channel_type: 1,
        ts: Date.now(),
        text: text,
        incoming: false,
        is_self: true,
        last_from_uid: state.wkUid || String(currentUser() && currentUser().uid || ''),
        last_from_name: '我'
      })
    }).catch(function () {
      // 会话同步失败不阻断打招呼发送
    });
  }

  function openWukongChat(uid) {
    if (!uid) return;
    window.location.href = rel('/wukong/' + encodeURIComponent(String(uid)));
  }

  function randomGreetingShortcode() {
    var idx = Math.floor(Math.random() * 10) + 1;
    return '[peipe-greet:hello-' + (idx < 10 ? '0' + idx : String(idx)) + ']';
  }

  function greetSentKey(toUid) {
    var me = currentUser() || {};
    return 'pps:wukong-greet-sent:' + String(me.uid || '0') + ':' + String(toUid || '0');
  }

  function hasLocalWukongGreetSent(toUid) {
    try { return !!localStorage.getItem(greetSentKey(toUid)); } catch (err) { return false; }
  }

  function markLocalWukongGreetSent(toUid) {
    try { localStorage.setItem(greetSentKey(toUid), String(Date.now())); } catch (err) {}
  }

  function greetErrorText(err) {
    var raw = String((err && (err.message || err.error || err.reason)) || err || '');
    if (/daily-limit/.test(raw)) return TEXT.greetLimit || '今天打招呼次数已用完';
    if (/login-required/.test(raw)) return TEXT.login;
    if (/invalid-user/.test(raw)) return TEXT.greetFail;
    return raw || TEXT.greetFail;
  }

  function reserveWukongGreet(toUid, text) {
    return apiFetch(CONFIG.wkGreetPath, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-csrf-token': csrfToken()
      },
      body: jsonBody({ uid: toUid, text: text, source: 'swipe-client', forceSend: !hasLocalWukongGreetSent(toUid) })
    }).then(function (json) {
      if (json && json.ok === false) {
        throw new Error(json.error || json.message || '发送失败');
      }
      return json || {};
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

  function parseMaybeArray(value) {
    if (Array.isArray(value)) return value;
    if (value == null || value === '') return [];
    var text = String(value).trim();
    if (!text) return [];
    try {
      var parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).map(function (key) { return parsed[key]; });
      return [parsed];
    } catch (e) {
      return text.split(/[\n,，|/]+/g);
    }
  }

  function normaliseCodeList(value, max) {
    var seen = {};
    var list = [];
    parseMaybeArray(value).forEach(function (item) {
      var code = normalCode(item);
      if (!code || seen[code]) return;
      seen[code] = true;
      list.push(code);
    });
    return list.slice(0, max || 5);
  }

  function languageLabel(value) {
    var opt = findOption(OPTIONS.languages, value);
    var code = normalCode(value);
    return (opt && (opt.label || opt.value)) || code || '-';
  }

  function languageCodeText(value) {
    var code = normalCode(value);
    if (!code) return '-';
    if (code === 'VI') return 'VN';
    if (code === 'JP') return 'JP';
    return code;
  }

  function optionText(item, type) {
    var value = item && item.value;
    var label = item && (item.label || item.value);
    var flag = type === 'language' ? languageFlag(value || label) : (type === 'country' ? countryFlag(value || label) : '');
    return (flag ? flag + ' ' : '') + (label || value || '');
  }

  function genderClass(value) {
    value = String(value || '').toLowerCase();
    if (value === 'male' || value === 'm' || value === '男') return 'male';
    if (value === 'female' || value === 'f' || value === '女') return 'female';
    if (value === 'private' || value === 'secret' || value === '保密') return 'private';
    return '';
  }

  function genderIcon(value) {
    var cls = genderClass(value);
    if (cls === 'male') return '♂';
    if (cls === 'female') return '♀';
    if (cls === 'private') return '•';
    return '';
  }

  function genderMeta(user) {
    var gender = user.gender || user.genderCode;
    var cls = genderClass(gender);
    var icon = genderIcon(gender);
    var age = Number(user.age || 0);
    var html = '';
    if (icon) html += '<span class="pps-gender-icon pps-gender-' + escapeHtml(cls || 'private') + '" aria-label="' + escapeHtml(TEXT.gender) + '">' + escapeHtml(icon) + '</span>';
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
    var code = languageCodeText(value);
    if (!code || code === '-') return '';
    return '<span class="pps-lang-code ' + (className || '') + '" title="' + escapeHtml(languageLabel(value)) + '">' + escapeHtml(code) + '</span>';
  }

  function renderLanguageList(values, className, max) {
    values = normaliseCodeList(values, max || 5);
    if (!values.length) return '';
    return values.slice(0, max || 5).map(function (code) { return renderLanguageChip(code, className); }).filter(Boolean).join('<span class="pps-lang-space"> </span>');
  }

  function optionLabel(list, value) {
    var opt = findOption(list, value);
    return (opt && (opt.label || opt.value)) || '';
  }

  function renderProfileDetails(user) {
    var chips = [];
    var loc = norm(user.locationText || user.location || user.city || '');
    if (loc) chips.push('<span class=\"pps-location-icon\">📍</span>' + escapeHtml(loc));
    if (user.heightCm) chips.push(escapeHtml(user.heightCm + 'cm'));
    if (user.weightKg) chips.push(escapeHtml(user.weightKg + 'kg'));
    var edu = optionLabel(OPTIONS.educations, user.education);
    if (edu && edu !== '保密') chips.push(escapeHtml(edu));
    var job = optionLabel(OPTIONS.occupations || [], user.occupation) || user.occupation;
    if (job && job !== TEXT.selectPlaceholder) chips.push(escapeHtml(job));
    var rel = optionLabel(OPTIONS.relationships, user.relationship || user.relationshipStatus);
    if (rel && rel !== '保密') chips.push(escapeHtml(rel));
    if (!chips.length) return '';
    return '<div class="pps-detail-row">' + chips.slice(0, 4).map(function (txt) { return '<span class="pps-detail-chip">' + txt + '</span>'; }).join('') + '</div>';
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
    return !!(profile && profile.displayName && profile.language_flag && profile.language_fluent && profile.language_learning && profile.gender && profile.birthday);
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


  function normalPathname() {
    var base = (window.config && window.config.relative_path) || '';
    var path = window.location && window.location.pathname || '';
    if (base && path.indexOf(base) === 0) path = path.slice(base.length) || '/';
    return path.replace(/\/+$/, '') || '/';
  }

  function isSwipeRoute() {
    var path = normalPathname();
    return path === '/partners/swipe' || path === '/nearby/swipe' || path === '/nearby';
  }

  function currentMode() {
    var path = normalPathname();
    var dataMode = state.root && state.root.getAttribute('data-mode');
    if (path === '/nearby' || path === '/nearby/swipe') return 'nearby';
    return dataMode === 'nearby' ? 'nearby' : 'recommend';
  }

  function cleanupFullScreenMode() {
    document.documentElement.classList.remove('peipe-swipe-html');
    document.body.classList.remove('peipe-swipe-mode');
  }

  function renderModeTabs() {
    var mode = state.mode || currentMode();
    return '' +
      '<nav class="pps-mode-switcher" aria-label="语伴推荐模式">' +
        '<button type="button" class="pps-mode-tab' + (mode === 'recommend' ? ' is-active' : '') + '" data-mode="recommend" aria-pressed="' + (mode === 'recommend' ? 'true' : 'false') + '">' + escapeHtml(TEXT.recommendTab) + '</button>' +
        '<button type="button" class="pps-mode-tab' + (mode === 'nearby' ? ' is-active' : '') + '" data-mode="nearby" aria-pressed="' + (mode === 'nearby' ? 'true' : 'false') + '">' + escapeHtml(TEXT.nearbyTab) + '</button>' +
      '</nav>';
  }

  function syncModeTabs() {
    if (!state.root) return;
    state.root.setAttribute('data-mode', state.mode || 'recommend');
    $$('.pps-mode-tab', state.root).forEach(function (tab) {
      var active = tab.dataset.mode === state.mode;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function buildChrome() {
    state.root.innerHTML = '' +
      '<div class="pps-native-feed" hidden></div>' +
      '<div class="pps-swiper swiper" hidden><div class="swiper-wrapper"></div></div>' +
      renderModeTabs() +
      '<button type="button" class="pps-floating-settings pps-edit-profile" aria-label="' + escapeHtml(TEXT.settings) + '">' + iconSettings() + '</button>' +
      '<div class="pps-loading">' + escapeHtml(TEXT.loading) + '</div>' +
      '<div class="pps-toast" hidden></div>' +
      '<div class="pps-sheet-backdrop"></div>' +
      '<section class="pps-profile-sheet" role="dialog" aria-modal="true"></section>' +
      '<div class="pps-tag-backdrop"></div>' +
      '<section class="pps-tag-sheet" role="dialog" aria-modal="true"></section>';
    syncModeTabs();
  }


  function renderFloatComments(user) {
    return '';
  }


  function renderSlide(user, index) {
    var photos = normalisePhotos(user.photos);
    if (!photos.length) photos = normalisePhotos([user.avatar || user.accountPicture || user.uploadedpicture || user.picture]);
    var photoSlides = photos.length ? photos.map(function (src, photoIndex) {
      var eager = Number(index || 0) <= Number(state.index || 0) + 1 && photoIndex === 0;
      return '<div class="swiper-slide"><img class="pps-photo" src="' + escapeHtml(src) + '" alt="photo" loading="' + (eager ? 'eager' : 'lazy') + '" decoding="async"' + (eager ? ' fetchpriority="high"' : '') + '></div>';
    }).join('') : '<div class="swiper-slide"><div class="pps-empty-bg"></div></div>';
    var dots = photos.length > 1 ? '<div class="pps-pagination"></div>' : '';
    var seenTags = {};
    var tags = (user.tags || []).filter(function (key) { if (!key || seenTags[key]) return false; seenTags[key] = true; return true; }).slice(0, 8).map(function (key) { return '<span class="pps-tag">' + escapeHtml(tagLabel(key)) + '</span>'; }).join('');
    var meta = genderMeta(user);
    var bio = norm(user.bio) || TEXT.noBio;
    var nativeList = user.nativeCodes || user.language_fluent || user.nativeCode || '';
    var learnList = user.learnCodes || user.language_learning || user.learnCode || '';
    var slideClass = tags ? ' swiper-slide pps-slide pps-has-tags' : ' swiper-slide pps-slide';

    return '' +
      '<section class="' + slideClass + '" data-index="' + index + '" data-uid="' + Number(user.uid || 0) + '">' +
        '<div class="pps-photo-layer">' +
          '<div class="pps-photo-swiper swiper" data-index="' + index + '"><div class="swiper-wrapper">' + photoSlides + '</div>' + dots + '</div>' +
        '</div>' +
        '<div class="pps-gradient"></div>' +
        renderFloatComments(user) +
        '<div class="pps-info">' +
          '<div class="pps-user-card">' +
            renderAvatarBlock(user) +
            '<div class="pps-user-main">' +
              '<div class="pps-name-row"><span class="pps-name">' + escapeHtml(user.displayName || user.username || 'User') + '</span>' + (meta ? '<span class="pps-user-meta">' + meta + '</span>' : '') + '</div>' +
              '<div class="pps-lang-row"><div class="pps-lang-side">' + renderLanguageList(nativeList, 'pps-native-chip', 3) + '</div><span class="pps-arrow">⇋</span><div class="pps-lang-side pps-lang-learn">' + renderLanguageList(learnList, 'pps-learn-chip', 5) + '</div></div>' +
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
    // The profile/settings entry is a primary action. Keep it visible while users swipe cards or switch modes.
    state.settingsVisible = true;
    var btn = $('.pps-floating-settings', state.root);
    if (btn) btn.classList.remove('is-hidden');
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

    state.photoSwipers.forEach(function (sw, idx) {
      if (!sw || !sw.el || !document.contains(sw.el)) {
        try { sw && sw.destroy && sw.destroy(true, true); } catch (e) {}
        state.photoSwipers.delete(idx);
      }
    });

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
    var swiperEl = $('.pps-swiper', state.root);
    if (swiperEl) swiperEl.hidden = true;
    var feed = $('.pps-native-feed', state.root);
    if (!feed) return;
    feed.hidden = false;
    if (state.nativeFeedBound) return;
    state.nativeFeedBound = true;
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

  function showLoading(text) {
    if (!state.root) return;
    var empty = $('.pps-empty', state.root);
    if (empty) empty.remove();
    var loading = $('.pps-loading', state.root);
    if (!loading) {
      loading = document.createElement('div');
      loading.className = 'pps-loading';
      state.root.appendChild(loading);
    }
    loading.textContent = text || TEXT.loading;
    loading.hidden = false;
  }

  function modePath(mode) {
    return mode === 'nearby' ? '/nearby/swipe' : '/partners/swipe';
  }

  function switchMode(mode, pushHistory) {
    mode = mode === 'nearby' ? 'nearby' : 'recommend';
    if (mode === state.mode) return Promise.resolve(false);

    state.mode = mode;
    state.done = false;
    state.index = 0;
    state.users = [];
    state.seenUids = {};
    state.loading = false;
    state.feedRequestId += 1;
    syncModeTabs();
    showLoading(mode === 'nearby' ? '正在查找附近的人...' : TEXT.loading);

    if (window.history && pushHistory !== false) {
      try { window.history.pushState({ peipeMode: mode }, '', rel(modePath(mode))); } catch (err) {}
    }

    updateSlides(true);

    var ready = mode === 'nearby' ? syncLocationIfPossible(true) : Promise.resolve(false);
    return ready.then(function () {
      if (!state.root || !isSwipeRoute() || state.mode !== mode) return false;
      return loadFeed(true);
    }).then(function () {
      toast(mode === 'nearby' ? TEXT.switchToNearby : TEXT.switchToRecommend);
      return true;
    });
  }

  function showFeed() {
    var loading = $('.pps-loading', state.root);
    var empty = $('.pps-empty', state.root);
    if (empty) empty.remove();
    if (loading) loading.hidden = true;
    hideSettingsButton();

    if (window.Swiper) {
      var swiperEl = $('.pps-swiper', state.root);
      var nativeEl = $('.pps-native-feed', state.root);
      if (swiperEl) swiperEl.hidden = false;
      if (nativeEl) nativeEl.hidden = true;
      initMainSwiper();
      updateSlides(false);
    } else {
      useNativeFeed();
      updateSlides(false);
    }
  }

  function showEmpty(text) {
    var loading = $('.pps-loading', state.root);
    var empty = $('.pps-empty', state.root);
    if (empty) empty.remove();
    var node = document.createElement('div');
    node.className = 'pps-empty';
    node.textContent = text || TEXT.empty;
    if (loading) loading.replaceWith(node);
    else state.root.appendChild(node);
    hideSettingsButton();
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

  function syncLocationIfPossible(force) {
    if (!isLoggedIn() || !navigator.geolocation) return Promise.resolve(false);
    var uid = String(currentUser() && currentUser().uid || '0');
    var key = 'pps-location-sync:' + uid;
    var last = Number(localStorage.getItem(key) || 0) || 0;
    if (!force && Date.now() - last < 6 * 60 * 60 * 1000) return Promise.resolve(false);
    localStorage.setItem(key, String(Date.now()));
    return new Promise(function (resolve) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        var c = pos && pos.coords;
        if (!c) return resolve(false);
        apiFetch('/api/peipe-partners/location', {
          method: 'PUT',
          headers: { 'content-type': 'application/json; charset=utf-8', 'x-csrf-token': csrfToken() },
          body: JSON.stringify({ lat: c.latitude, lng: c.longitude })
        }).then(function () {
          resolve(true);
        }).catch(function (err) {
          console.warn('[peipe-swipe] location save failed', err);
          resolve(false);
        });
      }, function () { resolve(false); }, {
        enableHighAccuracy: false,
        timeout: 6500,
        maximumAge: 60 * 60 * 1000
      });
    });
  }

  function appendUniqueUsers(users, refresh, allowRepeats) {
    var input = Array.isArray(users) ? users : [];
    var out = [];

    if (refresh) state.seenUids = {};

    input.forEach(function (u) {
      var uid = String(u && u.uid || '');
      if (!uid || uid === '0') return;
      if (!allowRepeats && state.seenUids[uid]) return;
      state.seenUids[uid] = true;
      out.push(u);
    });

    state.users = refresh ? out : state.users.concat(out);
    return out;
  }

  function loadFeed(refresh) {
    if (state.loading || (state.done && !refresh)) return Promise.resolve();

    state.loading = true;
    var requestId = ++state.feedRequestId;

    if (refresh) {
      showLoading(state.mode === 'nearby' ? '正在查找附近的人...' : TEXT.loading);
      syncModeTabs();
      state.done = false;
      state.users = [];
      state.seenUids = {};
      state.index = 0;
      state.photoSwipers.forEach(function (sw) { try { sw && sw.destroy && sw.destroy(true, true); } catch (e) {} });
      state.photoSwipers.clear();
    }

    return apiFetch('/api/peipe-partners/swipe/feed?mode=' + encodeURIComponent(state.mode || 'recommend') + '&limit=' + CONFIG.pageSize, { timeoutMs: 12000 })
      .then(function (json) {
        if (requestId !== state.feedRequestId) return;

        var rawUsers = Array.isArray(json.users) ? json.users : [];
        var allowRepeats = !!(json.recycled || json.allowRepeats);
        var added = appendUniqueUsers(rawUsers, refresh, allowRepeats);
        state.done = (json.hasMore === false && !allowRepeats && rawUsers.length === 0) || (!allowRepeats && !refresh && added.length === 0);

        if (!state.users.length) showEmpty(TEXT.empty);
        else showFeed();
      })
      .catch(function (err) {
        if (requestId !== state.feedRequestId) return;
        console.warn('[peipe-swipe] feed failed', err);
        if (!state.users.length) showEmpty((err && err.message) || TEXT.empty);
        else toast((err && err.message) || TEXT.empty);
      })
      .finally(function () {
        if (requestId === state.feedRequestId) state.loading = false;
      });
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
      if (!item || !item.value || item.value === 'other' || seen[item.value]) return false;
      seen[item.value] = true;
      return true;
    });
    if (!seen.private && !seen['保密']) OPTIONS.genders.push({ value: 'private', label: TEXT.privateGender });
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
        if (Array.isArray(json.occupations)) OPTIONS.occupations = json.occupations;
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

    // 已经打过招呼，再点一次直接进悟空独立聊天页
    if (btn.dataset.ppsWukongSent === '1') {
      openWukongChat(uid);
      return;
    }

    btn.disabled = true;

    var label = $('.pps-greet-label', btn);
    var old = label ? label.textContent : TEXT.greet;
    var text = randomGreetingShortcode();

    if (label) label.textContent = TEXT.greeting;

    reserveWukongGreet(uid, text).then(function (reserved) {
      btn.dataset.ppsWukongSent = '1';
      btn.classList.add('pps-greet-sent');
      if (label) label.textContent = TEXT.greeted;

      if (reserved && (reserved.wukongSent || reserved.wukongSkipped || reserved.already)) {
        markLocalWukongGreetSent(uid);
      }

      // 后端已经直接调用悟空 /message/send；前端不再用 SDK 二次发送，避免“显示成功但对方看不到”。
      syncWukongConversation(uid, reserved && reserved.text || text);

      if (reserved && reserved.already && reserved.wukongSkipped) toast(TEXT.greetAlready || '你已经打过招呼了');
      else if (reserved && reserved.already) toast('已补发打招呼图片');
      else toast(TEXT.greetOk || '已发送打招呼图片');
      return true;
    }).catch(function (err) {
      console.warn('[peipe-swipe] wukong greet failed', err);

      toast(greetErrorText(err));

      btn.disabled = false;

      if (label) label.textContent = old;
    }).finally(function () {
      // 发送成功后保持 disabled=false，方便用户再点一次进入聊天
      if (btn && btn.dataset.ppsWukongSent === '1') {
        btn.disabled = false;
      }
    });
  }

  var CHOICE_CONFIGS = {};

  function buildSelect(name, list, value) {
    var html = '';
    var hasEmpty = false;
    (list || []).forEach(function (item) {
      if (String(item.value || '') === '') hasEmpty = true;
    });
    if (!hasEmpty) html += '<option value="">' + escapeHtml(TEXT.selectPlaceholder) + '</option>';
    html += (list || []).map(function (item) {
      var selected = String(item.value || '') === String(value || '') ? ' selected' : '';
      return '<option value="' + escapeHtml(item.value || '') + '"' + selected + '>' + escapeHtml(item.label || item.value || TEXT.selectPlaceholder) + '</option>';
    }).join('');
    return '<select name="' + name + '">' + html + '</select>';
  }

  function choiceValues(value, multiple, max) {
    if (multiple) return normaliseCodeList(value, max || 5);
    var code = normalCode(value);
    return code ? [code] : [];
  }

  function choiceSummary(list, value, type, multiple, max) {
    var values = choiceValues(value, multiple, max);
    if (!values.length) return TEXT.selectPlaceholder;
    return values.map(function (code) {
      var opt = findOption(list, code) || { value: code, label: code };
      return optionText(opt, type);
    }).join('、');
  }

  function hiddenChoiceValue(value, multiple, max) {
    var values = choiceValues(value, multiple, max);
    return multiple ? JSON.stringify(values) : (values[0] || '');
  }

  function buildChoicePicker(name, list, value, type, multiple, max, title) {
    CHOICE_CONFIGS[name] = { name: name, list: list || [], type: type || 'text', multiple: !!multiple, max: Number(max || 1) || 1, title: title || name };
    var hidden = hiddenChoiceValue(value, multiple, max);
    var summary = choiceSummary(list, value, type, multiple, max);
    return '<div class="pps-choice-picker" data-name="' + escapeHtml(name) + '">' +
      '<input type="hidden" name="' + escapeHtml(name) + '" value="' + escapeHtml(hidden) + '">' +
      '<button type="button" class="pps-choice-open" data-name="' + escapeHtml(name) + '"><span class="pps-choice-summary">' + escapeHtml(summary) + '</span><span class="pps-choice-caret">›</span></button>' +
    '</div>';
  }

  function buildChoiceGrid(name, list, value, type, multiple, max) {
    return buildChoicePicker(name, list, value, type, multiple, max, name);
  }

  function getChoiceValue(name) {
    var input = $('.pps-choice-picker[data-name="' + name + '"] input[type="hidden"]', state.root) || $('[name="' + name + '"]', state.root);
    if (!input) return '';
    var cfg = CHOICE_CONFIGS[name];
    if (cfg && cfg.multiple) return normaliseCodeList(input.value, cfg.max || 5);
    return input.value || '';
  }

  function updateChoicePicker(name, values) {
    var cfg = CHOICE_CONFIGS[name];
    var picker = $('.pps-choice-picker[data-name="' + name + '"]', state.root);
    if (!cfg || !picker) return;
    var hidden = $('input[type="hidden"]', picker);
    var summary = $('.pps-choice-summary', picker);
    var value = cfg.multiple ? JSON.stringify((values || []).slice(0, cfg.max || 5)) : ((values && values[0]) || '');
    if (hidden) hidden.value = value;
    if (summary) summary.textContent = choiceSummary(cfg.list, value, cfg.type, cfg.multiple, cfg.max);
  }

  function syncChoiceGrid() {}

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
    hideSettingsButton();
    var profile = Object.assign({}, state.profile || {});
    profile.photos = normalisePhotos(profile.photos);
    state.selectedTags = Array.isArray(profile.tags) ? profile.tags.slice(0, 12) : [];
    var sheet = $('.pps-profile-sheet', state.root);
    var backdrop = $('.pps-sheet-backdrop', state.root);
    var me = currentUser() || {};
    var avatar = profile.avatar || profile.accountPicture || me.picture || me.uploadedpicture || '';
    var title = required ? TEXT.profileTitle : TEXT.editProfileTitle;

    sheet.innerHTML = '' +
      '<div class="pps-profile-panel">' +
        '<div class="pps-profile-scroll">' +
          '<div class="pps-profile-head"><div><div class="pps-profile-title">' + escapeHtml(title) + '</div><div class="pps-profile-subtitle">' + escapeHtml(TEXT.profileSubtitle) + '</div></div></div>' +
          '<div class="pps-form-grid">' +
            '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.displayName) + '</label><div class="pps-display-row"><button type="button" class="pps-avatar-upload" aria-label="' + escapeHtml(TEXT.uploadAvatar) + '">' + (avatar ? '<img class="pps-form-avatar pps-form-avatar-img" data-avatar="' + escapeHtml(avatar) + '" src="' + escapeHtml(avatar) + '" alt="avatar">' : '<span class="pps-form-avatar pps-form-avatar-img" data-avatar=""></span>') + '<span class="pps-avatar-plus">+</span></button><input class="pps-avatar-input" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif" hidden><input name="displayName" maxlength="40" value="' + escapeHtml(profile.displayName || profile.username || me.username || '') + '"></div></div>' +
            '<div class="pps-field pps-span-2"><div class="pps-field-title">' + escapeHtml(TEXT.photos) + '</div><div class="pps-photos-row">' + renderPhotoTiles(profile.photos) + '</div><input class="pps-photo-input" type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif" multiple hidden><button type="button" class="pps-upload-btn">' + escapeHtml(TEXT.uploadPhotos) + '</button></div>' +
            '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.bio) + '</label><textarea name="bio" maxlength="180" placeholder="' + escapeHtml(TEXT.bioPlaceholder) + '">' + escapeHtml(profile.bio || '') + '</textarea></div>' +
            '<div class="pps-field pps-compact"><label>' + escapeHtml(TEXT.country) + '</label>' + buildChoicePicker('language_flag', OPTIONS.countries, profile.language_flag, 'country', false, 1, TEXT.country) + '</div>' +
            '<div class="pps-field pps-compact"><label>' + escapeHtml(TEXT.gender) + '</label>' + buildChoicePicker('gender', OPTIONS.genders, profile.gender, 'text', false, 1, TEXT.gender) + '</div>' +
            '<div class="pps-lang-picker-row pps-span-2">' +
              '<div class="pps-field pps-compact"><label>' + escapeHtml(TEXT.nativeLanguage) + '</label>' + buildChoicePicker('language_fluent', OPTIONS.languages, profile.language_fluent, 'language', true, 5, TEXT.nativeLanguage) + '</div>' +
              '<div class="pps-field pps-compact"><label>' + escapeHtml(TEXT.learningLanguage) + '</label>' + buildChoicePicker('language_learning', OPTIONS.languages, profile.language_learning, 'language', true, 5, TEXT.learningLanguage) + '</div>' +
            '</div>' +
            '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.birthday) + '</label><input type="date" name="birthday" value="' + escapeHtml(profile.birthday || '') + '"></div>' +
            '<div class="pps-field"><label>' + escapeHtml(TEXT.height) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label><div class="pps-unit-input"><input inputmode="decimal" name="heightCm" maxlength="5" placeholder="' + escapeHtml(TEXT.heightPlaceholder) + '" value="' + escapeHtml(profile.heightCm || '') + '"><span>cm</span></div></div>' +
            '<div class="pps-field"><label>' + escapeHtml(TEXT.weight) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label><div class="pps-unit-input"><input inputmode="decimal" name="weightKg" maxlength="5" placeholder="' + escapeHtml(TEXT.weightPlaceholder) + '" value="' + escapeHtml(profile.weightKg || '') + '"><span>kg</span></div></div>' +
            '<div class="pps-field"><label>' + escapeHtml(TEXT.education) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label>' + buildSelect('education', OPTIONS.educations, profile.education) + '</div>' +
            '<div class="pps-field"><label>' + escapeHtml(TEXT.relationship) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label>' + buildSelect('relationship', OPTIONS.relationships, profile.relationship || profile.relationshipStatus) + '</div>' +
            '<div class="pps-field pps-span-2"><label>' + escapeHtml(TEXT.occupation) + ' <span>' + escapeHtml(TEXT.optional) + '</span></label>' + buildSelect('occupation', OPTIONS.occupations || [], profile.occupation) + '</div>' +
            '<div class="pps-field pps-span-2"><div class="pps-field-title">' + escapeHtml(TEXT.tags) + '</div><div class="pps-selected-tags">' + renderSelectedTags(state.selectedTags) + '</div><button type="button" class="pps-select-tags-btn">' + escapeHtml(TEXT.chooseTags) + '</button></div>' +
          '</div>' +
        '</div>' +
        '<div class="pps-profile-actions"><button type="button" class="pps-profile-leave">' + escapeHtml(TEXT.leave) + '</button><button type="button" class="pps-save-btn">' + escapeHtml(TEXT.save) + '</button></div>' +
      '</div>';

    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  }

  function closeProfile(force) {
    if (state.requiredProfile && !force) return;
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

  function getProfileAvatarFromSheet() {
    var avatar = $('.pps-form-avatar-img', state.root);
    if (!avatar) return '';
    return avatar.getAttribute('data-avatar') || avatar.getAttribute('src') || '';
  }

  function updateProfileAvatar(url) {
    var avatar = $('.pps-avatar-upload', state.root);
    if (!avatar || !url) return;
    avatar.innerHTML = '<img class="pps-form-avatar pps-form-avatar-img" data-avatar="' + escapeHtml(url) + '" src="' + escapeHtml(url) + '" alt="avatar"><span class="pps-avatar-plus">+</span>';
  }

  function collectProfileData() {
    var sheet = $('.pps-profile-sheet', state.root);
    return {
      displayName: norm($('[name="displayName"]', sheet).value),
      avatar: getProfileAvatarFromSheet(),
      photos: getProfilePhotosFromSheet(),
      bio: norm($('[name="bio"]', sheet).value),
      language_flag: getChoiceValue('language_flag'),
      language_fluent: getChoiceValue('language_fluent'),
      language_learning: getChoiceValue('language_learning'),
      gender: getChoiceValue('gender'),
      birthday: $('[name="birthday"]', sheet).value,
      heightCm: norm($('[name="heightCm"]', sheet).value),
      weightKg: norm($('[name="weightKg"]', sheet).value),
      education: $('[name="education"]', sheet).value,
      relationship: $('[name="relationship"]', sheet).value,
      occupation: $('[name="occupation"]', sheet).value,
      interestsText: '',
      tags: state.selectedTags.slice(0, 12)
    };
  }

  function profileMissing(data) {
    var missing = [];
    if (!data.displayName) missing.push('displayName');
    if (!data.language_flag) missing.push('country');
    if (!normaliseCodeList(data.language_fluent, 5).length) missing.push('nativeLanguage');
    if (!normaliseCodeList(data.language_learning, 5).length) missing.push('learningLanguage');
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

  function fileExt(file) {
    var name = String(file && file.name || '').toLowerCase();
    var m = name.match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  function mimeFromFile(file) {
    var type = String(file && file.type || '').toLowerCase();
    if (/^image\//.test(type)) return type;
    var ext = fileExt(file);
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'heic') return 'image/heic';
    if (ext === 'heif') return 'image/heif';
    return '';
  }

  function isImageFile(file) {
    if (!file) return false;
    var type = String(file.type || '').toLowerCase();
    var ext = fileExt(file);
    if (/^(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(ext)) return true;
    if (!type || type === 'application/octet-stream') return true;
    return /^image\//.test(type);
  }

  function withMime(file, type) {
    if (!file || !type || file.type === type) return file;
    try { return new File([file], file.name || ('photo-' + Date.now() + '.jpg'), { type: type, lastModified: file.lastModified || Date.now() }); }
    catch (e) { return file; }
  }

  function canCanvasEncode(type) {
    return new Promise(function (resolve) {
      try {
        var c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        if (!c.toBlob) return resolve(false);
        c.toBlob(function (b) { resolve(!!b && b.type === type); }, type, 0.8);
      } catch (e) { resolve(false); }
    });
  }

  function imageConfig(opts) {
    var base = Object.assign({}, CONFIG.imageConfig || {});
    return Object.assign({
      maxSide: 1440,
      maxSizeMB: 0.12,
      quality: 0.60,
      minCompressBytes: 120 * 1024,
      useWebp: true,
      qualities: [0.60, 0.52, 0.45, 0.38, 0.32, 0.26, 0.20]
    }, base, opts || {});
  }

  function imageTargetBytes(cfg) {
    return Math.max(30 * 1024, Math.round(Number(cfg.maxSizeMB || 0.12) * 1024 * 1024));
  }

  function extForMime(type) {
    type = String(type || '').toLowerCase();
    if (type === 'image/webp') return '.webp';
    if (type === 'image/png') return '.png';
    return '.jpg';
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error('empty file'));
      if (window.createImageBitmap) {
        window.createImageBitmap(file).then(function (bitmap) {
          resolve({
            width: bitmap.width,
            height: bitmap.height,
            draw: function (ctx, w, h) { ctx.drawImage(bitmap, 0, 0, w, h); },
            close: function () { try { bitmap.close && bitmap.close(); } catch (e) {} }
          });
        }).catch(function () {
          var img = new Image();
          var url = URL.createObjectURL(file);
          img.onload = function () {
            URL.revokeObjectURL(url);
            resolve({
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              draw: function (ctx, w, h) { ctx.drawImage(img, 0, 0, w, h); },
              close: function () {}
            });
          };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
          img.src = url;
        });
        return;
      }
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          draw: function (ctx, w, h) { ctx.drawImage(img, 0, 0, w, h); },
          close: function () {}
        });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, type, quality);
    });
  }

  function makeCompressedFile(original, blob, type) {
    if (!blob || !blob.size) return original;
    var base = String(original && original.name || ('photo-' + Date.now())).replace(/\.[^.]+$/, '');
    try { return new File([blob], base + extForMime(type), { type: type, lastModified: Date.now() }); }
    catch (e) { blob.name = base + extForMime(type); return blob; }
  }

  function compressWithLibrary(file, cfg, targetType) {
    if (typeof window.imageCompression !== 'function') return Promise.resolve(null);
    return window.imageCompression(file, {
      maxSizeMB: Number(cfg.maxSizeMB || 0.12),
      maxWidthOrHeight: Number(cfg.maxSide || 1440),
      useWebWorker: true,
      fileType: targetType,
      initialQuality: Number(cfg.quality || 0.60),
      alwaysKeepResolution: false,
      preserveExif: false
    }).then(function (blob) {
      if (!blob || !blob.size) return null;
      return blob;
    }).catch(function (err) {
      console.warn('[peipe-swipe] imageCompression library failed, fallback to canvas', err);
      return null;
    });
  }

  function compressWithCanvas(file, cfg, targetType) {
    return loadImageFromFile(file).then(function (img) {
      var w = img.width || 1;
      var h = img.height || 1;
      var maxSide = Number(cfg.maxSide || 1440);
      var scale = Math.min(1, maxSide / Math.max(w, h));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      var ctx = canvas.getContext('2d');
      if (!ctx || !canvas.toBlob) return null;
      ctx.drawImage && img.draw(ctx, canvas.width, canvas.height);
      img.close && img.close();

      var targetBytes = imageTargetBytes(cfg);
      var qualities = Array.isArray(cfg.qualities) && cfg.qualities.length ? cfg.qualities : [cfg.quality || 0.60, 0.52, 0.45, 0.38];
      var best = null;
      var chain = Promise.resolve();
      qualities.forEach(function (q) {
        chain = chain.then(function () {
          if (best && best.size <= targetBytes) return best;
          return canvasToBlob(canvas, targetType, Number(q)).then(function (blob) {
            if (blob && blob.size) best = blob;
            return best;
          });
        });
      });
      return chain.then(function () { return best; });
    }).catch(function (err) {
      console.warn('[peipe-swipe] canvas compression failed', err);
      return null;
    });
  }

  function compressImageFile(file, opts) {
    opts = opts || {};
    if (!file) return Promise.reject(new Error(TEXT.imageOnly));

    var cfg = imageConfig(opts);
    var ext = fileExt(file);
    var type = mimeFromFile(file);
    var size = Number(file.size || 0);

    if (!isImageFile(file)) return Promise.resolve(file);
    if (/gif|svg/i.test(type) || /^(gif|svg)$/i.test(ext)) return Promise.resolve(file);
    if (size > 0 && size < Number(cfg.minCompressBytes || 0)) return Promise.resolve(file);
    if (/heic|heif/i.test(type) || /^(heic|heif)$/i.test(ext)) return Promise.resolve(file);

    return canCanvasEncode('image/webp').then(function (webp) {
      var targetType = cfg.useWebp && webp ? 'image/webp' : 'image/jpeg';
      var targetBytes = imageTargetBytes(cfg);
      return compressWithLibrary(file, cfg, targetType).then(function (libBlob) {
        if (libBlob && libBlob.size <= Math.max(targetBytes * 1.25, targetBytes + 35 * 1024)) return libBlob;
        return compressWithCanvas(file, cfg, targetType).then(function (canvasBlob) {
          if (!canvasBlob) return libBlob || null;
          if (!libBlob) return canvasBlob;
          return canvasBlob.size < libBlob.size ? canvasBlob : libBlob;
        });
      }).then(function (blob) {
        if (!blob || !blob.size) return file;
        if (size && blob.size >= size * 0.98) return file;
        return makeCompressedFile(file, blob, targetType);
      });
    }).catch(function (err) {
      console.warn('[peipe-swipe] image compression skipped', err);
      return file;
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
    if (!file) return Promise.reject(new Error(TEXT.imageOnly));

    // This is intentionally the same shape as your working topic/video uploader.
    // Do NOT pre-read the image with FileReader/Image/canvas here; some mobile browsers
    // fail local decoding even though NodeBB can upload the File successfully.
    var form = new FormData();
    form.append('files[]', file);
    form.append('cid', String(CONFIG.uploadCid || 6));

    return fetch(rel('/api/post/upload'), {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'x-csrf-token': csrfToken(),
        'x-requested-with': 'XMLHttpRequest'
      },
      body: form
    }).then(function (res) {
      return res.text().then(function (text) {
        var json = {};
        try { json = text ? JSON.parse(text) : {}; } catch (e) {}
        if (!res.ok) {
          throw new Error(json.error || json.message || (json.status && json.status.message) || ('upload failed ' + res.status));
        }
        var url = extractUploadUrl(json);
        if (!url) throw new Error('上传成功但未返回文件地址');
        return url;
      });
    });
  }

  function handlePhotoFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (file) { return file && file.size !== 0; });
    if (!files.length) return toast(TEXT.imageOnly);

    var current = getProfilePhotosFromSheet();
    files = files.slice(0, Math.max(0, CONFIG.maxPhotos - current.length));
    if (!files.length) return;

    state.uploadBusy = true;
    var btn = $('.pps-upload-btn', state.root);
    if (btn) { btn.disabled = true; btn.textContent = TEXT.compressing; }

    var chain = Promise.resolve();
    var uploaded = [];
    files.forEach(function (file) {
      chain = chain.then(function () {
        // Upload original File directly. Compression can be reintroduced later only as a
        // non-blocking optimization, never as a prerequisite for upload.
        return compressImageFile(file).then(function (nextFile) {
          if (nextFile !== file && btn) btn.textContent = TEXT.uploading;
          return uploadToNodeBB(nextFile);
        }).then(function (url) {
          uploaded.push(url);
          updateProfilePhotoTiles(current.concat(uploaded).slice(0, CONFIG.maxPhotos));
        });
      });
    });

    chain.catch(function (err) {
      console.warn('[peipe-swipe] photo upload failed', err);
      toast((err && err.message) || TEXT.imageTooLarge);
    }).finally(function () {
      state.uploadBusy = false;
      if (btn) { btn.disabled = false; btn.textContent = TEXT.uploadPhotos; }
    });
  }

  function closeAvatarCrop() {
    var sheet = $('.pps-crop-sheet', state.root);
    if (sheet) sheet.remove();
    if (state.avatarCrop && state.avatarCrop.url) {
      try { URL.revokeObjectURL(state.avatarCrop.url); } catch (e) {}
    }
    state.avatarCrop = null;
  }

  function updateAvatarCropTransform() {
    var crop = state.avatarCrop;
    var img = $('.pps-crop-img', state.root);
    if (!crop || !img) return;
    img.style.transform = 'translate(-50%, -50%) translate(' + Math.round(crop.x || 0) + 'px,' + Math.round(crop.y || 0) + 'px) scale(' + Number(crop.zoom || 1).toFixed(2) + ')';
  }

  function cropAvatarToFile() {
    var crop = state.avatarCrop;
    if (!crop || !crop.file || !crop.naturalWidth || !crop.naturalHeight) return Promise.resolve(crop && crop.file);
    return canCanvasEncode('image/webp').then(function (webp) {
      var cfg = imageConfig(CONFIG.avatarImageConfig || {});
      var type = cfg.useWebp && webp ? 'image/webp' : 'image/jpeg';
      var outSize = 720;
      var box = 260;
      var naturalW = crop.naturalWidth;
      var naturalH = crop.naturalHeight;
      var baseScale = Math.max(box / naturalW, box / naturalH);
      var zoom = Math.max(1, Number(crop.zoom || 1));
      var displayScale = baseScale * zoom;
      var cropSize = Math.min(naturalW, naturalH, box / displayScale);
      var centerX = naturalW / 2 - Number(crop.x || 0) / displayScale;
      var centerY = naturalH / 2 - Number(crop.y || 0) / displayScale;
      var sx = Math.max(0, Math.min(naturalW - cropSize, centerX - cropSize / 2));
      var sy = Math.max(0, Math.min(naturalH - cropSize, centerY - cropSize / 2));
      var canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      var ctx = canvas.getContext('2d');
      if (!ctx || !canvas.toBlob) return crop.file;
      ctx.drawImage(crop.image, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);
      var qualities = Array.isArray(cfg.qualities) && cfg.qualities.length ? cfg.qualities : [0.58, 0.5, 0.42, 0.34, 0.28];
      var targetBytes = imageTargetBytes(cfg);
      var best = null;
      var chain = Promise.resolve();
      qualities.forEach(function (q) {
        chain = chain.then(function () {
          if (best && best.size <= targetBytes) return best;
          return canvasToBlob(canvas, type, Number(q)).then(function (blob) {
            if (blob && blob.size) best = blob;
            return best;
          });
        });
      });
      return chain.then(function () {
        if (!best || !best.size) return crop.file;
        return makeCompressedFile(crop.file, best, type);
      });
    }).catch(function () {
      return crop.file;
    });
  }

  function uploadAvatarPreparedFile(file) {
    if (!file || file.size === 0) return toast(TEXT.imageOnly);
    if (state.uploadBusy) return toast(TEXT.uploading);
    state.uploadBusy = true;
    var btn = $('.pps-avatar-upload', state.root);
    if (btn) btn.classList.add('is-uploading');
    toast(TEXT.uploading);
    uploadToNodeBB(file).then(function (url) {
      updateProfileAvatar(url);
      toast(TEXT.saveOk);
    }).catch(function (err) {
      console.warn('[peipe-swipe] avatar upload failed', err);
      toast((err && err.message) || TEXT.imageOnly);
    }).finally(function () {
      state.uploadBusy = false;
      if (btn) btn.classList.remove('is-uploading');
    });
  }

  function openAvatarCrop(file) {
    if (!file || file.size === 0) return toast(TEXT.imageOnly);
    if (!isImageFile(file)) return uploadAvatarPreparedFile(file);
    var type = mimeFromFile(file);
    if (/heic|heif|gif|svg/i.test(type) || /^(heic|heif|gif|svg)$/i.test(fileExt(file))) {
      return uploadAvatarPreparedFile(file);
    }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      state.avatarCrop = { file: file, url: url, image: img, naturalWidth: img.naturalWidth || img.width, naturalHeight: img.naturalHeight || img.height, zoom: 1.25, x: 0, y: 0, dragging: false };
      var old = $('.pps-crop-sheet', state.root);
      if (old) old.remove();
      var host = document.createElement('section');
      host.className = 'pps-crop-sheet is-open';
      host.innerHTML = '' +
        '<div class="pps-crop-panel">' +
          '<div class="pps-crop-title">' + escapeHtml(TEXT.cropAvatar || '裁切头像') + '</div>' +
          '<div class="pps-crop-tip">' + escapeHtml(TEXT.cropTip || '拖动图片调整位置，滑动缩放。') + '</div>' +
          '<div class="pps-crop-box"><img class="pps-crop-img" src="' + escapeHtml(url) + '" alt="avatar crop"></div>' +
          '<input class="pps-crop-range" type="range" min="1" max="3" step="0.01" value="1.25">' +
          '<div class="pps-crop-actions"><button type="button" class="pps-crop-cancel">' + escapeHtml(TEXT.cropCancel || '取消') + '</button><button type="button" class="pps-crop-use">' + escapeHtml(TEXT.cropUse || '上传头像') + '</button></div>' +
        '</div>';
      state.root.appendChild(host);
      updateAvatarCropTransform();
    };
    img.onerror = function () {
      try { URL.revokeObjectURL(url); } catch (e) {}
      uploadAvatarPreparedFile(file);
    };
    img.src = url;
  }

  function handleAvatarFile(file) {
    openAvatarCrop(file);
  }

  function renderChoiceSheet(name) {
    hideSettingsButton();
    var cfg = CHOICE_CONFIGS[name];
    if (!cfg) return;
    state.choiceContext = cfg;
    var input = $('.pps-choice-picker[data-name="' + name + '"] input[type="hidden"]', state.root);
    var draft = cfg.multiple ? normaliseCodeList(input && input.value, cfg.max || 5) : choiceValues(input && input.value, false, 1);
    state.choiceDraft = draft;
    var sheet = $('.pps-tag-sheet', state.root);
    var choices = (cfg.list || []).map(function (item) {
      var code = normalCode(item.value || item.code || item.label);
      if (!code) return '';
      var selected = draft.indexOf(code) !== -1;
      return '<button type="button" class="pps-choice-option ' + (selected ? 'is-selected' : '') + '" data-value="' + escapeHtml(code) + '">' + escapeHtml(optionText(item, cfg.type)) + '</button>';
    }).join('');
    sheet.dataset.mode = 'choice';
    sheet.innerHTML = '' +
      '<div class="pps-tag-panel pps-choice-panel">' +
        '<div class="pps-tag-scroll pps-choice-scroll">' +
          '<div class="pps-tag-head"><div><div class="pps-tag-title">' + escapeHtml(cfg.title || TEXT.chooseOption) + '</div>' +
          '<div class="pps-profile-subtitle">' + (cfg.multiple ? (escapeHtml(TEXT.selectedCount) + ' <span class="pps-choice-count">' + draft.length + '/' + cfg.max + '</span>') : escapeHtml(TEXT.chooseOption)) + '</div></div></div>' +
          '<div class="pps-choice-sheet-grid">' + choices + '</div>' +
        '</div>' +
        '<div class="pps-tag-actions"><button type="button" class="pps-choice-leave">' + escapeHtml(TEXT.leave) + '</button><button type="button" class="pps-choice-clear">' + escapeHtml(TEXT.tagClear) + '</button><button type="button" class="pps-choice-done">' + escapeHtml(TEXT.doneOption || TEXT.save) + '</button></div>' +
      '</div>';
    $('.pps-tag-backdrop', state.root).classList.add('is-open');
    sheet.classList.add('is-open');
  }

  function updateChoiceCount() {
    var el = $('.pps-choice-count', state.root);
    if (el && state.choiceContext) el.textContent = state.choiceDraft.length + '/' + state.choiceContext.max;
  }

  function toggleChoice(value, btn) {
    var cfg = state.choiceContext;
    if (!cfg) return;
    value = normalCode(value);
    if (!value) return;
    if (cfg.multiple) {
      var idx = state.choiceDraft.indexOf(value);
      if (idx !== -1) state.choiceDraft.splice(idx, 1);
      else if (state.choiceDraft.length < (cfg.max || 5)) state.choiceDraft.push(value);
      else return;
      if (btn) btn.classList.toggle('is-selected', state.choiceDraft.indexOf(value) !== -1);
    } else {
      state.choiceDraft = [value];
      $$('.pps-choice-option', state.root).forEach(function (node) { node.classList.toggle('is-selected', node === btn); });
    }
    updateChoiceCount();
  }

  function closeChoice(save) {
    if (save && state.choiceContext) updateChoicePicker(state.choiceContext.name, state.choiceDraft);
    state.choiceContext = null;
    state.choiceDraft = [];
    $('.pps-tag-backdrop', state.root).classList.remove('is-open');
    $('.pps-tag-sheet', state.root).classList.remove('is-open');
  }

  function renderTagSheet() {
    hideSettingsButton();
    state.tagDraft = Array.from(new Set(state.selectedTags)).slice(0, 12);
    var sheet = $('.pps-tag-sheet', state.root);
    var used = {};
    var groups = (state.tagCategories || []).map(function (cat) {
      var choices = (cat.tags || []).filter(function (tag) {
        if (!tag || !tag.key || used[tag.key]) return false;
        used[tag.key] = true;
        return true;
      }).map(function (tag) {
        var selected = state.tagDraft.indexOf(tag.key) !== -1;
        return '<button type="button" class="pps-tag-choice ' + (selected ? 'is-selected' : '') + '" data-key="' + escapeHtml(tag.key) + '">' + escapeHtml(TEXT[tag.labelKey] || tag.label || tag.key) + '</button>';
      }).join('');
      if (!choices) return '';
      return '<div class="pps-tag-category">' + escapeHtml(categoryLabel(cat)) + '</div><div class="pps-tag-grid">' + choices + '</div>';
    }).join('');

    sheet.innerHTML = '' +
      '<div class="pps-tag-panel">' +
        '<div class="pps-tag-scroll">' +
          '<div class="pps-tag-head"><div><div class="pps-tag-title">' + escapeHtml(TEXT.tagTitle) + '</div><div class="pps-profile-subtitle"><span class="pps-tag-count">' + escapeHtml(TEXT.selectedCount) + ' ' + state.tagDraft.length + '/12</span></div></div></div>' +
          groups +
        '</div>' +
        '<div class="pps-tag-actions"><button type="button" class="pps-tag-leave">' + escapeHtml(TEXT.leave) + '</button><button type="button" class="pps-tag-clear">' + escapeHtml(TEXT.tagClear) + '</button><button type="button" class="pps-tag-done">' + escapeHtml(TEXT.tagDone) + '</button></div>' +
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

  function isEditableTarget(el) {
    return !!(el && el.closest && el.closest('input, textarea, select, option, [contenteditable="true"], .composer, .write'));
  }

  function bindMobileSelectionGuard() {
    if (state.selectionGuardBound) return;
    state.selectionGuardBound = true;
    var root = state.root;
    if (!root) return;

    root.addEventListener('contextmenu', function (e) {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    }, true);

    root.addEventListener('selectstart', function (e) {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    }, true);

    root.addEventListener('dragstart', function (e) {
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
    }, true);
  }

  function bindEvents() {
    state.root.addEventListener('click', function (e) {
      var btn;
      if ((btn = e.target.closest('.pps-mode-tab'))) {
        e.preventDefault();
        e.stopPropagation();
        switchMode(btn.dataset.mode, true);
        return;
      }
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
      if (e.target.closest('.pps-profile-leave')) {
        e.preventDefault();
        if (state.requiredProfile && window.history && window.history.length > 1) window.history.back();
        else closeProfile(true);
        return;
      }
      if (e.target.closest('.pps-profile-close')) {
        e.preventDefault();
        closeProfile();
        return;
      }
      if ((btn = e.target.closest('.pps-choice-open'))) {
        e.preventDefault();
        renderChoiceSheet(btn.dataset.name);
        return;
      }
      if ((btn = e.target.closest('.pps-choice-option'))) {
        e.preventDefault();
        toggleChoice(btn.dataset.value, btn);
        return;
      }
      if (e.target.closest('.pps-choice-leave')) {
        e.preventDefault();
        closeChoice(false);
        return;
      }
      if (e.target.closest('.pps-choice-done')) {
        e.preventDefault();
        closeChoice(true);
        return;
      }
      if (e.target.closest('.pps-choice-clear')) {
        e.preventDefault();
        state.choiceDraft = [];
        $$('.pps-choice-option', state.root).forEach(function (node) { node.classList.remove('is-selected'); });
        updateChoiceCount();
        return;
      }
      if (e.target.closest('.pps-avatar-upload')) {
        e.preventDefault();
        var avatarInput = $('.pps-avatar-input', state.root);
        if (avatarInput) avatarInput.click();
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
      if (e.target.closest('.pps-tag-leave') || e.target.closest('.pps-tag-close')) {
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
      if (e.target.closest('.pps-crop-cancel')) {
        e.preventDefault();
        closeAvatarCrop();
        return;
      }
      if (e.target.closest('.pps-crop-use')) {
        e.preventDefault();
        var useBtn = e.target.closest('.pps-crop-use');
        if (useBtn) { useBtn.disabled = true; useBtn.textContent = TEXT.uploading; }
        cropAvatarToFile().then(function (file) {
          closeAvatarCrop();
          uploadAvatarPreparedFile(file);
        }).catch(function () {
          var original = state.avatarCrop && state.avatarCrop.file;
          closeAvatarCrop();
          uploadAvatarPreparedFile(original);
        });
        return;
      }
      if ((btn = e.target.closest('.pps-tag-choice'))) {
        e.preventDefault();
        toggleTag(btn.dataset.key, btn);
      }
    }, true);

    state.root.addEventListener('change', function (e) {
      if (e.target && e.target.classList.contains('pps-avatar-input')) {
        var avatarFiles = Array.prototype.slice.call(e.target.files || []);
        e.target.value = '';
        handleAvatarFile(avatarFiles[0]);
        return;
      }
      if (e.target && e.target.classList.contains('pps-photo-input')) {
        var files = Array.prototype.slice.call(e.target.files || []);
        e.target.value = '';
        handlePhotoFiles(files);
      }
    });

    state.root.addEventListener('input', function (e) {
      if (e.target && e.target.classList.contains('pps-crop-range') && state.avatarCrop) {
        state.avatarCrop.zoom = Number(e.target.value || 1.25) || 1.25;
        updateAvatarCropTransform();
      }
    });

    state.root.addEventListener('pointerdown', function (e) {
      if (!e.target.closest || !e.target.closest('.pps-mode-switcher')) return;
      state.modeGesture = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        active: true
      };
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) {}
    });

    state.root.addEventListener('pointermove', function (e) {
      if (!state.modeGesture || !state.modeGesture.active || state.modeGesture.pointerId !== e.pointerId) return;
      var dx = e.clientX - state.modeGesture.startX;
      var dy = e.clientY - state.modeGesture.startY;
      if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.35) e.preventDefault();
    });

    function finishModeGesture(e) {
      if (!state.modeGesture || state.modeGesture.pointerId !== e.pointerId) return;
      var g = state.modeGesture;
      state.modeGesture = null;
      var dx = e.clientX - g.startX;
      var dy = e.clientY - g.startY;
      if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      switchMode(dx < 0 ? 'nearby' : 'recommend', true);
    }

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
      state.root.addEventListener(name, finishModeGesture);
    });

    state.root.addEventListener('pointerdown', function (e) {
      if (!e.target.closest || !e.target.closest('.pps-crop-box') || !state.avatarCrop) return;
      state.avatarCrop.dragging = true;
      state.avatarCrop.startX = e.clientX;
      state.avatarCrop.startY = e.clientY;
      state.avatarCrop.baseX = state.avatarCrop.x || 0;
      state.avatarCrop.baseY = state.avatarCrop.y || 0;
      try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (err) {}
    });

    state.root.addEventListener('pointermove', function (e) {
      if (!state.avatarCrop || !state.avatarCrop.dragging) return;
      e.preventDefault();
      state.avatarCrop.x = (state.avatarCrop.baseX || 0) + e.clientX - state.avatarCrop.startX;
      state.avatarCrop.y = (state.avatarCrop.baseY || 0) + e.clientY - state.avatarCrop.startY;
      updateAvatarCropTransform();
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
      state.root.addEventListener(name, function () {
        if (state.avatarCrop) state.avatarCrop.dragging = false;
      });
    });
  }

  function enterFullScreenMode() {
    document.documentElement.classList.add('peipe-swipe-html');
    document.body.classList.add('peipe-swipe-mode');
  }

  function destroySwiper() {
    if (state.swiper) {
      try { state.swiper.destroy(true, true); } catch (e) {}
      state.swiper = null;
    }

    state.photoSwipers.forEach(function (sw) {
      try { sw && sw.destroy && sw.destroy(true, true); } catch (e) {}
    });
    state.photoSwipers.clear();
  }

  function init() {
    state.root = document.getElementById('peipe-swipe-app');
    if (!state.root || !isSwipeRoute()) {
      cleanupFullScreenMode();
      destroySwiper();
      return;
    }
    if (state.root.dataset.ppsReady === '1') return;

    state.root.dataset.ppsReady = '1';
    state.mode = currentMode();
    state.root.setAttribute('data-mode', state.mode);
    state.settingsVisible = true;
    state.nativeFeedBound = false;
    state.swiper = null;
    state.users = [];
    state.seenUids = {};
    state.done = false;
    state.loading = false;

    enterFullScreenMode();

    // First paint and first feed request must not wait for translator/options/profile/Swiper.
    buildChrome();
    bindEvents();
    bindMobileSelectionGuard();
    loadFeed(true);

    // 防止接口请求在少数 WebView 里无响应时一直停在“语伴加载中”
    setTimeout(function () {
      if (!state.root || !isSwipeRoute() || state.users.length || !state.loading) return;
      state.loading = false;
      showEmpty('语伴加载超时，请检查 /api/peipe-partners/swipe/feed 是否正常返回');
    }, 16000);

    // Background-only bootstrap. These should never block the first card.
    loadTranslations().catch(function () {});

    Promise.all([loadOptions(), loadTags()])
      .then(function () { return loadMe(); })
      .catch(function (err) { console.warn('[peipe-swipe] profile bootstrap failed', err); });

    ensureSwiper().then(function () {
      if (!state.root || !isSwipeRoute()) return;
      if (state.users && state.users.length) showFeed();
    });

    setTimeout(function () {
      syncLocationIfPossible(state.mode === 'nearby').then(function (updated) {
        if (updated && state.root && isSwipeRoute()) loadFeed(true);
      });
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('popstate', function () {
    if (!state.root || !isSwipeRoute()) return;
    var nextMode = currentMode();
    if (nextMode !== state.mode) switchMode(nextMode, false);
  });

  if (window.ajaxify && window.ajaxify.on) {
    window.ajaxify.on('action:ajaxify.start', function () {
      if (!isSwipeRoute()) {
        cleanupFullScreenMode();
        destroySwiper();
      }
    });
    window.ajaxify.on('action:ajaxify.end', function () {
      if (!isSwipeRoute()) {
        cleanupFullScreenMode();
        destroySwiper();
        return;
      }
      var root = document.getElementById('peipe-swipe-app');
      if (root) root.dataset.ppsReady = '0';
      init();
    });
  }
})();
