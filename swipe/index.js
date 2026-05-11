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
    gender: cleanText(raw.gender, 40),
    age,
    birthday,
    language_flag: cleanText(raw.language_flag, 40),
    countryCode,
    flagEmoji: flagEmoji(countryCode),
    language_fluent: cleanText(raw.language_fluent, 40),
    language_learning: cleanText(raw.language_learning, 40),
  };
}

function getMissing(profile) {
  const missing = [];
  if (!profile.displayName) missing.push('displayName');
  if (!profile.photos.length) missing.push('picture');
  if (!profile.language_flag) missing.push('language_flag');
  if (!profile.language_fluent) missing.push('language_fluent');
  if (!profile.language_learning) missing.push('language_learning');
  if (!profile.gender) missing.push('gender');
  if (!profile.birthday) missing.push('birthday');
  if (!profile.tags.length) missing.push('tags');
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
    language_fluent: cleanText(body.language_fluent || body.nativeLanguage || current.language_fluent, 40),
    language_learning: cleanText(body.language_learning || body.learningLanguage || current.language_learning, 40),
    gender: cleanText(body.gender || current.gender, 40),
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
