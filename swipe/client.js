'use strict';

const user = require.main.require('./src/user');
const partner = require('../lib/partner');
const tagData = require('./tags');

const EXTRA_FIELDS = [
  'uid', 'username', 'userslug', 'picture', 'uploadedpicture',
  'bio', 'aboutme', 'signature',
  'age', 'birthday', 'birthdate', 'peipe_partner_birthday',
  'gender', 'language_flag', 'language_fluent', 'language_learning',
  'peipe_partner_display_name', 'peipe_partner_photo', 'peipe_partner_photos', 'peipe_partner_tags',
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
  const accountPicture = cleanUrl(raw.picture || raw.uploadedpicture || '');
  const mainPhoto = cleanUrl(raw.peipe_partner_photo || '');
  const photos = normalisePhotos(raw.peipe_partner_photos, mainPhoto);
  const tags = tagData.normaliseSelectedTags(parseJsonArray(raw.peipe_partner_tags));
  const birthday = cleanDate(raw.peipe_partner_birthday || raw.birthday || raw.birthdate || '');
  const age = normaliseAge(raw.age, birthday);
  const countryCode = normaliseCountryCode(raw.language_flag || '');

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
    language_fluent: cleanLangValue(raw.language_fluent),
    language_learning: cleanLangValue(raw.language_learning),
  };
}

function getMissing(profile) {
  const missing = [];
  if (!profile.displayName) missing.push('displayName');
  if (!profile.photos.length) missing.push('photos');
  if (!profile.language_flag) missing.push('language_flag');
  if (!profile.language_fluent) missing.push('language_fluent');
  if (!profile.language_learning) missing.push('language_learning');
  if (!profile.gender) missing.push('gender');
  if (!profile.birthday) missing.push('birthday');
  return missing;
}

function decorateUser(baseUser, extra) {
  const profile = normaliseProfile(Object.assign({}, baseUser, extra, { uid: baseUser.uid || extra.uid }));
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
    nativeCode: profile.language_fluent || baseUser.nativeCode || '',
    learnCode: profile.language_learning || baseUser.learnCode || '',
    countryCode: profile.countryCode || baseUser.countryCode || '',
    flagEmoji: profile.flagEmoji || baseUser.flagEmoji || '',
  });
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
  const extras = await getExtraUsersFields(users);
  return Object.assign({}, payload, {
    users: users.map(item => decorateUser(item, extras.get(Number(item.uid)) || {})),
  });
}

async function getMe(uid) {
  const raw = await user.getUserFields(uid, EXTRA_FIELDS);
  const profile = normaliseProfile(Object.assign({}, raw, { uid }));
  const missing = getMissing(profile);
  return { ok: true, complete: missing.length === 0, missing, profile, tagCategories: tagData.categories };
}

async function saveMe(uid, body) {
  const current = await user.getUserFields(uid, EXTRA_FIELDS);
  const displayName = cleanText(body.displayName || body.username || current.peipe_partner_display_name || current.username, 40);
  const submittedPhotos = normalisePhotos(body.photos || body.peipe_partner_photos, body.picture || body.photo || body.peipe_partner_photo);
  const photos = submittedPhotos.slice(0, 5);
  const photo = photos[0] || '';
  const tags = tagData.normaliseSelectedTags(body.tags || body.peipe_partner_tags);
  const birthday = cleanDate(body.birthday || body.birthdate || body.peipe_partner_birthday || current.peipe_partner_birthday || current.birthday || current.birthdate || '');
  const age = normaliseAge(body.age || current.age, birthday);
  const bio = cleanText(body.bio || body.aboutme || current.aboutme || current.bio || '', 180);

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
