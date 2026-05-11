'use strict';

const db = require.main.require('./src/database');
const user = require.main.require('./src/user');
const groups = require.main.require('./src/groups');

const CONFIG = {
  maxScan: 800,
  defaultLimit: 20,
  maxLimit: 50,
  seenTtlMs: 24 * 60 * 60 * 1000,
  dailyGreetLimit: 8,
  vipDailyGreetLimit: 30,
  vipGroups: ['vip', 'VIP', 'Vip', 'premium', 'Premium', 'VIP会员', '会员'],
};

const USER_FIELDS = [
  'uid', 'username', 'userslug', 'picture', 'uploadedpicture', 'status', 'lastonline', 'banned', 'deleted',
  'aboutme', 'signature', 'bio',
  'countryCode', 'country_code', 'country', 'country_name', 'nationality', 'region', 'location',
  'language_flag', 'language_fluent', 'native_language', 'language_learning', 'target_language',
  'gender', 'sex', 'age', 'birthday', 'birthdate', 'peipe_partner_birthday',
  'relationship_status', 'lat', 'lng', 'languagePartnerGeoUpdatedAt', 'languagePartnerGeoExpiresAt',
  'peipe_partner_display_name', 'peipe_partner_photo', 'peipe_partner_photos', 'peipe_partner_tags',
];

const PROFILE_FIELDS = [
  'uid', 'username', 'userslug', 'picture', 'uploadedpicture',
  'bio', 'aboutme', 'signature',
  'language_flag', 'language_fluent', 'language_learning',
  'gender', 'age', 'birthday', 'birthdate', 'peipe_partner_birthday',
  'relationship_status', 'peipe_partner_display_name', 'peipe_partner_photo', 'peipe_partner_photos', 'peipe_partner_tags',
];

const OPTIONS = {
  countries: [
    { value: 'CN', code: 'cn', label: '中国' },
    { value: 'MM', code: 'mm', label: '缅甸' },
    { value: 'VN', code: 'vn', label: '越南' },
    { value: 'TH', code: 'th', label: '泰国' },
    { value: 'US', code: 'us', label: '美国' },
    { value: 'GB', code: 'gb', label: '英国' },
    { value: 'JP', code: 'jp', label: '日本' },
    { value: 'KR', code: 'kr', label: '韩国' },
  ],
  languages: [
    { value: 'CN', code: 'cn', label: '中文' },
    { value: 'EN', code: 'gb', label: 'English' },
    { value: 'MM', code: 'mm', label: 'မြန်မာ' },
    { value: 'VI', code: 'vn', label: 'Tiếng Việt' },
    { value: 'TH', code: 'th', label: 'ภาษาไทย' },
    { value: 'JP', code: 'jp', label: '日本語' },
    { value: 'KR', code: 'kr', label: '한국어' },
  ],
  genders: [
    { value: 'male', label: '男' },
    { value: 'female', label: '女' },
    { value: 'private', label: '保密' },
    { value: 'other', label: '其他' },
  ],
  relationships: [
    { value: '保密', label: '保密' },
    { value: '单身', label: '单身' },
    { value: '热恋', label: '热恋' },
    { value: '已婚', label: '已婚' },
  ],
};

const LANG_MAP = {
  cn: 'CN', zh: 'CN', 'zh-cn': 'CN', china: 'CN', chinese: 'CN', '中文': 'CN', '汉语': 'CN',
  en: 'EN', us: 'EN', uk: 'EN', gb: 'EN', english: 'EN', '英语': 'EN',
  mm: 'MM', my: 'MM', myanmar: 'MM', burmese: 'MM', '缅甸': 'MM', '缅甸语': 'MM',
  vi: 'VI', vn: 'VI', vietnam: 'VI', vietnamese: 'VI', '越南': 'VI', '越南语': 'VI',
  th: 'TH', thai: 'TH', thailand: 'TH', '泰语': 'TH',
  jp: 'JP', ja: 'JP', japan: 'JP', japanese: 'JP', '日语': 'JP',
  kr: 'KR', ko: 'KR', korea: 'KR', korean: 'KR', '韩语': 'KR',
};

const COUNTRY_MAP = {
  cn: 'cn', china: 'cn', '中国': 'cn',
  mm: 'mm', myanmar: 'mm', burma: 'mm', '缅甸': 'mm',
  vn: 'vn', vi: 'vn', vietnam: 'vn', '越南': 'vn',
  th: 'th', thailand: 'th', '泰国': 'th',
  us: 'us', usa: 'us', '美国': 'us',
  gb: 'gb', uk: 'gb', england: 'gb', '英国': 'gb',
  jp: 'jp', ja: 'jp', japan: 'jp', '日本': 'jp',
  kr: 'kr', ko: 'kr', korea: 'kr', '韩国': 'kr',
};

function now() {
  return Date.now();
}

function cleanText(value, maxLength) {
  const text = String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

function cleanUrl(value) {
  const url = cleanText(value, 500);
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('/')) return url;
  return '';
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  const text = String(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return Object.values(parsed);
    return [parsed];
  } catch (err) {
    return text.split(/[\n,，|/]+/g);
  }
}

function cleanLangValue(value) {
  const arr = parseArray(value).map(item => cleanText(item, 40)).filter(Boolean);
  const raw = cleanText(arr[0] || value, 40);
  if (!raw) return '';
  const key = raw.toLowerCase();
  return LANG_MAP[key] || LANG_MAP[raw] || raw.toUpperCase();
}

function cleanGender(value) {
  const raw = cleanText(value, 40);
  const key = raw.toLowerCase();
  if (!raw) return '';
  if (key === 'm' || key === 'male' || raw === '男') return 'male';
  if (key === 'f' || key === 'female' || raw === '女') return 'female';
  if (key === 'private' || raw === '保密' || raw === '秘密') return 'private';
  if (key === 'other' || raw === '其他') return 'other';
  return raw;
}

function cleanDate(value) {
  const text = cleanText(value, 20);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.replace(/\//g, '-');
  return '';
}

function ageFromBirthday(value) {
  const birthday = cleanDate(value);
  if (!birthday) return 0;
  const parts = birthday.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return 0;
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : 0;
}

function normaliseAge(rawAge, birthday) {
  const calculated = ageFromBirthday(birthday);
  if (calculated) return calculated;
  const age = Number(rawAge || 0) || 0;
  return age >= 0 && age <= 120 ? age : 0;
}

function toLangCode(value) {
  const text = cleanText(value, 40).toLowerCase();
  if (!text) return '';
  if (LANG_MAP[text]) return LANG_MAP[text];
  const key = Object.keys(LANG_MAP).find(item => text.includes(item));
  if (key) return LANG_MAP[key];
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

function toLangCodes(value) {
  const codes = parseArray(value).map(toLangCode).filter(Boolean);
  return Array.from(new Set(codes));
}

function countryCode(value, nativeCode) {
  const text = cleanText(value, 40).toLowerCase();
  if (text) {
    if (COUNTRY_MAP[text]) return COUNTRY_MAP[text];
    const key = Object.keys(COUNTRY_MAP).find(item => text.includes(item));
    if (key) return COUNTRY_MAP[key];
    if (/^[a-z]{2}$/i.test(text)) return text.toLowerCase();
  }
  const fallback = { CN: 'cn', MM: 'mm', VI: 'vn', TH: 'th', EN: 'gb', JP: 'jp', KR: 'kr' };
  return fallback[nativeCode] || '';
}

function flagEmoji(code) {
  const country = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return '';
  return country.replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function normalisePhotos(value, fallback) {
  const photos = [];
  parseArray(value).forEach((item) => {
    const url = cleanUrl(item);
    if (url && !photos.includes(url)) photos.push(url);
  });
  const fb = cleanUrl(fallback);
  if (fb && !photos.includes(fb)) photos.push(fb);
  return photos.slice(0, 5);
}

function profileLink(data) {
  return data.userslug ? `/user/${encodeURIComponent(data.userslug)}` : '#';
}

function decorateUser(data) {
  const uid = Number(data && data.uid);
  if (!uid || data.banned || data.deleted) return null;

  const nativeCodes = toLangCodes(data.language_fluent || data.native_language);
  const learnCodes = toLangCodes(data.language_learning || data.target_language);
  const nativeCode = nativeCodes[0] || '';
  const learnCode = learnCodes[0] || '';
  const cc = countryCode(data.language_flag || data.countryCode || data.country_code || data.country || data.nationality || data.region || data.location, nativeCode);
  const accountPicture = cleanUrl(data.picture || data.uploadedpicture || '');
  const mainPhoto = cleanUrl(data.peipe_partner_photo || '');
  const photos = normalisePhotos(data.peipe_partner_photos, mainPhoto);
  const rawBio = cleanText(data.aboutme || data.bio || data.signature || '', 180);
  const tags = parseArray(data.peipe_partner_tags).map(item => cleanText(item, 40)).filter(Boolean).slice(0, 12);
  const birthday = cleanDate(data.peipe_partner_birthday || data.birthday || data.birthdate || '');
  const age = normaliseAge(data.age, birthday);
  const lat = Number(data.lat);
  const lng = Number(data.lng);

  return {
    uid,
    username: cleanText(data.peipe_partner_display_name || data.username || `User ${uid}`, 80),
    displayName: cleanText(data.peipe_partner_display_name || data.username || `User ${uid}`, 80),
    userslug: cleanText(data.userslug || '', 120),
    avatar: accountPicture,
    picture: photos[0] || '',
    photos,
    tags,
    gender: cleanGender(data.gender || data.sex || ''),
    genderCode: cleanGender(data.gender || data.sex || ''),
    age,
    birthday,
    ageText: age ? `${age}岁` : '',
    bio: rawBio.length > 120 ? `${rawBio.slice(0, 120)}…` : rawBio,
    nativeCode,
    nativeCodes,
    learnCode,
    learnCodes,
    countryCode: cc,
    flagEmoji: flagEmoji(cc),
    flagSrc: cc ? `https://flagcdn.com/w40/${cc}.png` : '',
    relationshipStatus: cleanText(data.relationship_status || '', 40),
    relationshipKey: cleanText(data.relationship_status || '', 40),
    relationshipEmoji: '',
    lastonline: Number(data.lastonline || 0) || 0,
    status: data.status || '',
    isOnline: data.status === 'online',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    profileLink: profileLink(data),
    canChat: true,
  };
}

async function getSortedSet(key, limit) {
  try {
    if (typeof db.getSortedSetRevRange === 'function') return await db.getSortedSetRevRange(key, 0, limit - 1);
  } catch (err) {}
  return [];
}

async function getRecentSortedSet(key, limit) {
  try {
    if (typeof db.getSortedSetRevRangeByScore === 'function') return await db.getSortedSetRevRangeByScore(key, 0, limit - 1, '+inf', 0);
  } catch (err) {}
  return [];
}

async function getCandidateUids() {
  const set = new Set();
  const add = (items) => {
    (items || []).forEach((uid) => {
      uid = Number(uid);
      if (uid > 0) set.add(uid);
    });
  };
  add(await getRecentSortedSet('users:online', CONFIG.maxScan));
  add(await getRecentSortedSet('users:lastonline', CONFIG.maxScan));
  add(await getSortedSet('users:joindate', CONFIG.maxScan));
  return Array.from(set).slice(0, CONFIG.maxScan);
}

async function getSeenSet(uid, mode) {
  if (!uid) return new Set();
  const key = `peipePartners:seen:${mode || 'recommend'}:${uid}`;
  const cutoff = now() - CONFIG.seenTtlMs;
  try {
    const values = await db.getSortedSetRevRangeByScore(key, 0, CONFIG.maxScan - 1, '+inf', cutoff);
    return new Set((values || []).map(Number).filter(Boolean));
  } catch (err) {
    return new Set();
  }
}

async function markSeen(uid, mode, users) {
  if (!uid || !users.length || typeof db.sortedSetAdd !== 'function') return;
  const key = `peipePartners:seen:${mode || 'recommend'}:${uid}`;
  const score = now();
  await Promise.all(users.map(item => db.sortedSetAdd(key, score, String(item.uid)).catch(() => {})));
}

function scoreUser(viewer, item, seenSet) {
  let score = 0;
  if (item.isOnline) score += 40;
  if (item.picture) score += 20;
  if (item.bio) score += 10;
  if (item.tags && item.tags.length) score += 8;
  if (item.lastonline) score += Math.min(20, Math.max(0, (Date.now() - item.lastonline) / -3600000 + 20));
  if (seenSet.has(item.uid)) score -= 100;
  const viewerNative = toLangCodes(viewer && (viewer.language_fluent || viewer.native_language));
  const viewerLearn = toLangCodes(viewer && (viewer.language_learning || viewer.target_language));
  if (viewerLearn.includes(item.nativeCode)) score += 60;
  if (viewerNative.includes(item.learnCode)) score += 35;
  return score;
}

async function list(req) {
  const uid = Number(req && req.uid) || 0;
  const mode = cleanText(req && req.query && req.query.mode, 20) || 'recommend';
  const limit = Math.min(CONFIG.maxLimit, Math.max(1, Number(req && req.query && req.query.limit) || CONFIG.defaultLimit));
  const seenSet = await getSeenSet(uid, mode);
  const candidateUids = (await getCandidateUids()).filter(candidateUid => candidateUid !== uid);

  if (!candidateUids.length) return { ok: true, users: [], hasMore: false, mode, limit };

  const rows = await user.getUsersFields(candidateUids, USER_FIELDS);
  const viewer = uid ? await user.getUserFields(uid, PROFILE_FIELDS).catch(() => null) : null;
  const users = (rows || [])
    .map(row => decorateUser(row))
    .filter(Boolean)
    .map(item => Object.assign(item, { _score: scoreUser(viewer, item, seenSet) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map((item) => {
      delete item._score;
      return item;
    });

  await markSeen(uid, mode, users);
  return { ok: true, users, hasMore: candidateUids.length > limit, mode, limit };
}

async function options() {
  return Object.assign({ ok: true }, OPTIONS);
}

function missingFromProfile(profile) {
  const missing = [];
  if (!cleanText(profile.peipe_partner_display_name || profile.username)) missing.push('displayName');
  if (!cleanUrl(profile.peipe_partner_photo)) missing.push('picture');
  if (!cleanText(profile.language_flag)) missing.push('language_flag');
  if (!cleanLangValue(profile.language_fluent)) missing.push('language_fluent');
  if (!cleanLangValue(profile.language_learning)) missing.push('language_learning');
  if (!cleanGender(profile.gender)) missing.push('gender');
  if (!cleanDate(profile.peipe_partner_birthday || profile.birthday || profile.birthdate || '')) missing.push('birthday');
  return missing;
}

async function profileStatus(uid) {
  const profile = await user.getUserFields(uid, PROFILE_FIELDS);
  const missing = missingFromProfile(profile || {});
  return { ok: true, complete: missing.length === 0, missing, profile: profile || {} };
}

async function saveProfile(uid, body) {
  body = body || {};
  const current = await user.getUserFields(uid, PROFILE_FIELDS);
  const displayName = cleanText(body.displayName || body.username || body.peipe_partner_display_name || current.peipe_partner_display_name || current.username, 40);
  const photo = cleanUrl(body.picture || body.photo || body.peipe_partner_photo || current.peipe_partner_photo);
  const photos = normalisePhotos(body.photos || body.peipe_partner_photos || current.peipe_partner_photos, photo);
  const tags = parseArray(body.tags || body.peipe_partner_tags || current.peipe_partner_tags).map(item => cleanText(item, 40)).filter(Boolean).slice(0, 12);
  const birthday = cleanDate(body.birthday || body.birthdate || body.peipe_partner_birthday || current.peipe_partner_birthday || current.birthday || current.birthdate || '');
  const age = normaliseAge(body.age || current.age, birthday);
  const bio = cleanText(body.bio || body.aboutme || current.aboutme || current.bio || current.signature || '', 180);

  const fields = {
    peipe_partner_display_name: displayName,
    peipe_partner_photo: photo,
    peipe_partner_photos: JSON.stringify(photos),
    peipe_partner_tags: JSON.stringify(tags),
    aboutme: bio,
    bio,
    language_flag: cleanText(body.language_flag || body.country || current.language_flag, 40),
    language_fluent: cleanLangValue(body.language_fluent || body.nativeLanguage || current.language_fluent),
    language_learning: cleanLangValue(body.language_learning || body.learningLanguage || current.language_learning),
    gender: cleanGender(body.gender || current.gender),
    birthday,
    birthdate: birthday,
    peipe_partner_birthday: birthday,
    age,
    relationship_status: cleanText(body.relationship_status || current.relationship_status || '保密', 40),
  };

  await user.setUserFields(uid, fields);
  return profileStatus(uid);
}

async function saveLocation(uid, body) {
  body = body || {};
  const lat = Number(body.lat || body.latitude);
  const lng = Number(body.lng || body.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: 'invalid-location' };
  const timestamp = now();
  await user.setUserFields(uid, {
    lat,
    lng,
    languagePartnerGeoUpdatedAt: timestamp,
    languagePartnerGeoExpiresAt: timestamp + 7 * 24 * 60 * 60 * 1000,
  });
  return { ok: true, lat, lng };
}

async function markChatted(uid, body) {
  const targetUid = Number(body && (body.uid || body.toUid || body.targetUid));
  if (!uid || !targetUid || uid === targetUid) return { ok: false, error: 'invalid-uid' };
  const score = now();
  await Promise.all([
    db.sortedSetAdd(`peipePartners:chatted:${uid}`, score, String(targetUid)).catch(() => {}),
    db.sortedSetAdd(`peipePartners:chatted:${targetUid}`, score, String(uid)).catch(() => {}),
  ]);
  return { ok: true };
}

async function isVip(uid) {
  if (!uid || !groups || typeof groups.isMemberOfGroups !== 'function') return false;
  try {
    return await groups.isMemberOfGroups(uid, CONFIG.vipGroups);
  } catch (err) {
    return false;
  }
}

async function greet(uid, body) {
  const targetUid = Number(body && (body.uid || body.toUid || body.targetUid));
  if (!uid) return { ok: false, error: 'not-logged-in' };
  if (!targetUid || targetUid === Number(uid)) return { ok: false, error: 'invalid-uid' };

  const limit = await isVip(uid) ? CONFIG.vipDailyGreetLimit : CONFIG.dailyGreetLimit;
  const day = new Date().toISOString().slice(0, 10);
  const key = `peipePartners:greet:${uid}:${day}`;
  const pairKey = `peipePartners:greeted:${uid}:${targetUid}`;
  const pairState = await db.get(pairKey).catch(() => null);
  if (pairState) return { ok: true, already: true, remaining: Math.max(0, limit - (Number(await db.get(key).catch(() => 0)) || 0)) };

  const count = Number(await db.get(key).catch(() => 0)) || 0;
  if (count >= limit) return { ok: false, error: 'daily-limit', limit, count };

  await db.set(key, count + 1).catch(() => {});
  if (typeof db.expire === 'function') await db.expire(key, 36 * 60 * 60).catch(() => {});

  const message = cleanText(body.message || '你好，可以一起练语言吗？', 120);
  const payload = JSON.stringify({ fromUid: Number(uid), toUid: targetUid, message, createdAt: now(), status: 'sent' });
  await Promise.all([
    db.sortedSetAdd(`peipePartners:greetings:from:${uid}`, now(), payload).catch(() => {}),
    db.sortedSetAdd(`peipePartners:greetings:to:${targetUid}`, now(), payload).catch(() => {}),
    db.set(pairKey, payload).catch(() => {}),
  ]);
  if (typeof db.expire === 'function') await db.expire(pairKey, 30 * 24 * 60 * 60).catch(() => {});

  return { ok: true, remaining: Math.max(0, limit - count - 1), message, notified: false };
}

module.exports = {
  list,
  options,
  profileStatus,
  saveProfile,
  saveLocation,
  markChatted,
  greet,
  decorateUser,
};
