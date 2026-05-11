'use strict';

const user = require.main.require('./src/user');
const partner = require('../lib/partner');
const tagData = require('./tags');
const comments = require('./comments');

const EXTRA_FIELDS = [
  'uid', 'username', 'userslug', 'picture', 'uploadedpicture', 'location', 'lat', 'lng', 'languagePartnerGeoUpdatedAt', 'languagePartnerGeoExpiresAt',
  'bio', 'aboutme', 'signature',
  'age', 'birthday', 'birthdate', 'peipe_partner_birthday',
  'gender', 'language_flag', 'language_fluent', 'language_learning',
  'peipe_partner_display_name', 'peipe_partner_photo', 'peipe_partner_photos', 'peipe_partner_tags',
  'peipe_partner_height', 'peipe_partner_weight', 'peipe_partner_education', 'peipe_partner_occupation',
  'peipe_partner_relationship', 'relationship_status', 'peipe_partner_location',
];

const COUNTRY_TO_FLAG = {
  CN: 'cn', MM: 'mm', VN: 'vn', VI: 'vn', TH: 'th', US: 'us', GB: 'gb', UK: 'gb', JP: 'jp', JA: 'jp', KR: 'kr', KO: 'kr', EN: 'gb',
};

const LANG_TO_CODE = {
  cn: 'CN', zh: 'CN', 'zh-cn': 'CN', chinese: 'CN', '中文': 'CN', '汉语': 'CN', '普通话': 'CN',
  en: 'EN', us: 'EN', uk: 'EN', gb: 'EN', english: 'EN', '英语': 'EN',
  mm: 'MM', my: 'MM', burmese: 'MM', myanmar: 'MM', '缅甸语': 'MM', '缅甸': 'MM',
  vi: 'VI', vn: 'VI', vietnamese: 'VI', vietnam: 'VI', '越南语': 'VI', '越南': 'VI',
  th: 'TH', thai: 'TH', thailand: 'TH', '泰语': 'TH', '泰国': 'TH',
  jp: 'JP', ja: 'JP', japanese: 'JP', japan: 'JP', '日语': 'JP', '日本语': 'JP', '日本': 'JP',
  kr: 'KR', ko: 'KR', korean: 'KR', korea: 'KR', '韩语': 'KR', '韩国语': 'KR', '韩国': 'KR'
};

function cleanText(value, maxLength = 120) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanUrl(value) {
  const url = cleanText(value, 500);
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('/')) return url;
  return '';
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  const text = String(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return text.split(/[\n,，|]+/g);
  }
}

function cleanLangValue(value) {
  const arr = parseJsonArray(value).map(item => cleanText(item, 40)).filter(Boolean);
  const raw = cleanText(arr[0] || value, 40);
  if (!raw) return '';
  const key = raw.toLowerCase();
  return LANG_TO_CODE[key] || LANG_TO_CODE[raw] || raw.toUpperCase();
}

function cleanLangValues(value, max = 5) {
  const result = [];
  const seen = new Set();
  parseJsonArray(value).forEach((item) => {
    const code = cleanLangValue(item);
    if (!code || seen.has(code)) return;
    seen.add(code);
    result.push(code);
  });
  if (!result.length) {
    const code = cleanLangValue(value);
    if (code) result.push(code);
  }
  return result.slice(0, max);
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


function cleanNumber(value, min, max) {
  const num = Number(String(value == null ? '' : value).replace(/[^0-9.]/g, '')) || 0;
  if (!Number.isFinite(num) || num < min || num > max) return 0;
  return Math.round(num * 10) / 10;
}

function jsonArrayString(value) {
  return JSON.stringify(cleanLangValues(value, 5));
}

function isJsonArrayText(value) {
  if (Array.isArray(value)) return true;
  const text = String(value == null ? '' : value).trim();
  if (!text) return true;
  try {
    return Array.isArray(JSON.parse(text));
  } catch (err) {
    return false;
  }
}

async function repairJsonLanguageFields(uid, raw) {
  if (!uid || !raw) return raw;
  const patch = {};
  if (!isJsonArrayText(raw.language_fluent)) patch.language_fluent = jsonArrayString(raw.language_fluent);
  if (!isJsonArrayText(raw.language_learning)) patch.language_learning = jsonArrayString(raw.language_learning);
  if (!Object.keys(patch).length) return raw;
  await user.setUserFields(uid, patch).catch(() => {});
  return Object.assign({}, raw, patch);
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

function normalisePhotos(value, mainPhoto) {
  const photos = [];
  const push = (item) => {
    const url = cleanUrl(item);
    if (url && !photos.includes(url)) photos.push(url);
  };
  parseJsonArray(value).forEach(push);
  push(mainPhoto);
  return photos.slice(0, 5);
}

function flagEmoji(countryCode) {
  const code = String(countryCode || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return code.replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function normaliseCountryCode(value) {
  const raw = cleanText(value, 40).toUpperCase();
  if (!raw) return '';
  return COUNTRY_TO_FLAG[raw] || raw.toLowerCase();
}

function normaliseProfile(raw) {
  const accountPicture = cleanUrl(raw.picture || raw.uploadedpicture || raw.avatar || '');
  const mainPhoto = cleanUrl(raw.peipe_partner_photo || '');
  const photos = normalisePhotos(raw.peipe_partner_photos, mainPhoto);
  const tags = tagData.normaliseSelectedTags(parseJsonArray(raw.peipe_partner_tags));
  const birthday = cleanDate(raw.peipe_partner_birthday || raw.birthday || raw.birthdate || '');
  const age = normaliseAge(raw.age, birthday);
  const countryCode = normaliseCountryCode(raw.language_flag || '');
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);

  return {
    uid: Number(raw.uid || 0),
    username: cleanText(raw.username, 80),
    userslug: cleanText(raw.userslug, 120),
    displayName: cleanText(raw.peipe_partner_display_name || raw.username, 40),
    avatar: accountPicture,
    accountPicture,
    picture: photos[0] || '',
    photos,
    tags,
    bio: cleanText(raw.aboutme || raw.bio || raw.signature || '', 180),
    gender: cleanGender(raw.gender),
    age,
    birthday,
    language_flag: cleanText(raw.language_flag, 40),
    countryCode,
    flagEmoji: flagEmoji(countryCode),
    language_fluent: cleanLangValues(raw.language_fluent, 5),
    language_learning: cleanLangValues(raw.language_learning, 5),
    heightCm: cleanNumber(raw.peipe_partner_height, 60, 260),
    weightKg: cleanNumber(raw.peipe_partner_weight, 20, 300),
    education: cleanText(raw.peipe_partner_education || '', 40),
    occupation: cleanText(raw.peipe_partner_occupation || '', 60),
    relationship: cleanText(raw.peipe_partner_relationship || raw.relationship_status || '', 40),
    locationText: cleanText(raw.peipe_partner_location || raw.location || '', 60),
    location: cleanText(raw.peipe_partner_location || raw.location || '', 60),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function toRad(value) {
  return Number(value || 0) * Math.PI / 180;
}

function distanceKmBetween(a, b) {
  if (!a || !b) return 0;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDistance(km) {
  km = Number(km || 0);
  if (!Number.isFinite(km) || km <= 0) return '';
  if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)}m`;
  if (km < 10) return `${km.toFixed(1).replace(/\.0$/, '')}km`;
  return `${Math.round(km)}km`;
}

function getMissing(profile) {
  const missing = [];
  if (!profile.displayName) missing.push('displayName');
  if (!profile.language_flag) missing.push('language_flag');
  if (!profile.language_fluent || !profile.language_fluent.length) missing.push('language_fluent');
  if (!profile.language_learning || !profile.language_learning.length) missing.push('language_learning');
  if (!profile.gender) missing.push('gender');
  if (!profile.birthday) missing.push('birthday');
  return missing;
}

function decorateUser(baseUser, extra, viewerGeo) {
  const profile = normaliseProfile(Object.assign({}, baseUser, extra, { uid: baseUser.uid || extra.uid }));
  const distanceKm = distanceKmBetween(viewerGeo, profile);
  const distanceText = formatDistance(distanceKm);
  const photos = profile.photos.length ? profile.photos : [];
  return Object.assign({}, baseUser, {
    username: profile.displayName || baseUser.username,
    displayName: profile.displayName || baseUser.username,
    avatar: profile.avatar || baseUser.avatar || baseUser.picture || '',
    accountPicture: profile.accountPicture || baseUser.avatar || baseUser.picture || '',
    picture: photos[0] || '',
    photos,
    tags: profile.tags,
    bio: profile.bio || baseUser.bio || baseUser.aboutme || baseUser.signature || '',
    age: profile.age || baseUser.age || '',
    ageText: profile.age ? `${profile.age}岁` : (baseUser.ageText || ''),
    birthday: profile.birthday || baseUser.birthday || '',
    gender: profile.gender || baseUser.gender || '',
    genderCode: profile.gender || baseUser.genderCode || baseUser.gender || '',
    nativeCode: (profile.language_fluent && profile.language_fluent[0]) || baseUser.nativeCode || '',
    nativeCodes: profile.language_fluent || baseUser.nativeCodes || [],
    learnCode: (profile.language_learning && profile.language_learning[0]) || baseUser.learnCode || '',
    learnCodes: profile.language_learning || baseUser.learnCodes || [],
    countryCode: profile.countryCode || baseUser.countryCode || '',
    flagEmoji: profile.flagEmoji || baseUser.flagEmoji || '',
    heightCm: profile.heightCm || baseUser.heightCm || 0,
    weightKg: profile.weightKg || baseUser.weightKg || 0,
    education: profile.education || baseUser.education || '',
    occupation: profile.occupation || baseUser.occupation || '',
    relationship: profile.relationship || baseUser.relationship || baseUser.relationshipStatus || '',
    locationText: profile.locationText || baseUser.locationText || baseUser.location || '',
    location: profile.locationText || baseUser.location || '',
    lat: profile.lat,
    lng: profile.lng,
    distanceKm,
    distanceText,
  });
}

async function getViewerGeo(req) {
  const uid = Number(req && req.uid);
  if (!uid) return null;
  const row = await user.getUserFields(uid, ['lat', 'lng']).catch(() => null);
  if (!row) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function getExtraUsersFields(users) {
  const uids = users.map(item => Number(item && item.uid)).filter(Boolean);
  if (!uids.length) return new Map();
  const rows = await user.getUsersFields(uids, EXTRA_FIELDS);
  const map = new Map();
  rows.forEach((row, index) => {
    const uid = Number(row && row.uid) || uids[index];
    map.set(uid, Object.assign({}, row, { uid }));
  });
  return map;
}

async function feed(req) {
  const payload = await partner.list(req);
  const users = Array.isArray(payload && payload.users) ? payload.users : [];
  const [extras, viewerGeo, floatComments] = await Promise.all([
    getExtraUsersFields(users),
    getViewerGeo(req),
    comments.floatForTargets(users.map(item => Number(item && item.uid)).filter(Boolean), 6),
  ]);
  return Object.assign({}, payload, {
    users: users.map((item) => {
      const decorated = decorateUser(item, extras.get(Number(item.uid)) || {}, viewerGeo);
      decorated.floatComments = floatComments.get(Number(item.uid)) || [];
      return decorated;
    }),
  });
}

async function getMe(uid) {
  let raw = await user.getUserFields(uid, EXTRA_FIELDS);
  raw = await repairJsonLanguageFields(uid, raw || {});
  const profile = normaliseProfile(Object.assign({}, raw, { uid }));
  const missing = getMissing(profile);
  return { ok: true, complete: missing.length === 0, missing, profile, tagCategories: tagData.categories };
}

async function saveMe(uid, body) {
  let current = await user.getUserFields(uid, EXTRA_FIELDS);
  current = await repairJsonLanguageFields(uid, current || {});
  const displayName = cleanText(body.displayName || body.username || current.peipe_partner_display_name || current.username, 40);
  const submittedPhotos = normalisePhotos(body.photos || body.peipe_partner_photos, body.picture || body.photo || body.peipe_partner_photo);
  const photos = submittedPhotos.slice(0, 5);
  const photo = photos[0] || '';
  const tags = tagData.normaliseSelectedTags(body.tags || body.peipe_partner_tags);
  const birthday = cleanDate(body.birthday || body.birthdate || body.peipe_partner_birthday || current.peipe_partner_birthday || current.birthday || current.birthdate || '');
  const age = normaliseAge(body.age || current.age, birthday);
  const bio = cleanText(body.bio || body.aboutme || current.aboutme || current.bio || '', 180);
  const avatar = cleanUrl(body.avatar || body.picture || body.uploadedpicture || current.picture || current.uploadedpicture || '');
  const locationText = cleanText(body.locationText || body.location || current.peipe_partner_location || current.location || '', 60);

  const fields = {
    peipe_partner_display_name: displayName,
    peipe_partner_photo: photo,
    peipe_partner_photos: JSON.stringify(photos),
    picture: avatar,
    uploadedpicture: avatar,
    peipe_partner_location: locationText,
    location: locationText,
    peipe_partner_tags: JSON.stringify(tags),
    aboutme: bio,
    bio,
    language_flag: cleanText(body.language_flag || body.country || current.language_flag, 40),
    language_fluent: jsonArrayString(body.language_fluent || body.nativeLanguage || current.language_fluent),
    language_learning: jsonArrayString(body.language_learning || body.learningLanguage || current.language_learning),
    gender: cleanGender(body.gender || current.gender),
    birthday,
    birthdate: birthday,
    peipe_partner_birthday: birthday,
    age,
    relationship_status: cleanText(body.relationship || body.relationship_status || current.relationship_status || '', 40),
    peipe_partner_relationship: cleanText(body.relationship || body.relationship_status || current.peipe_partner_relationship || current.relationship_status || '', 40),
    peipe_partner_height: cleanNumber(body.heightCm || body.height || current.peipe_partner_height, 60, 260),
    peipe_partner_weight: cleanNumber(body.weightKg || body.weight || current.peipe_partner_weight, 20, 300),
    peipe_partner_education: cleanText(body.education || current.peipe_partner_education || '', 40),
    peipe_partner_occupation: cleanText(body.occupation || body.job || current.peipe_partner_occupation || '', 60),
  };

  await user.setUserFields(uid, fields);
  const profile = normaliseProfile(Object.assign({}, current, fields, { uid }));
  const missing = getMissing(profile);
  return { ok: missing.length === 0, complete: missing.length === 0, missing, profile };
}

function tags() {
  return { ok: true, categories: tagData.categories };
}

module.exports = { feed, getMe, saveMe, tags };

