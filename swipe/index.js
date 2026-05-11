'use strict';

const user = require.main.require('./src/user');
const partner = require('../lib/partner');
const tagData = require('./tags');

const EXTRA_FIELDS = [
  'uid',
  'username',
  'userslug',
  'picture',
  'uploadedpicture',
  'bio',
  'signature',
  'age',
  'gender',
  'language_flag',
  'language_fluent',
  'language_learning',
  'peipe_partner_display_name',
  'peipe_partner_photo',
  'peipe_partner_photos',
  'peipe_partner_tags'
];

function cleanText(value, maxLength = 120) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanUrl(value) {
  const url = cleanText(value, 500);
  if (!url) {
    return '';
  }
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('/')) {
    return url;
  }
  return '';
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return text.split(/[\n,|]+/g);
  }
}

function normalisePhotos(value, fallbackPhoto) {
  const photos = [];
  const push = (item) => {
    const url = cleanUrl(item);
    if (url && !photos.includes(url)) {
      photos.push(url);
    }
  };

  parseJsonArray(value).forEach(push);
  push(fallbackPhoto);

  return photos.slice(0, 5);
}

function normaliseProfile(raw) {
  const accountPicture = cleanUrl(raw.picture || raw.uploadedpicture || '');
  const mainPhoto = cleanUrl(raw.peipe_partner_photo || accountPicture);
  const photos = normalisePhotos(raw.peipe_partner_photos, mainPhoto || accountPicture);
  const tags = tagData.normaliseSelectedTags(parseJsonArray(raw.peipe_partner_tags));

  return {
    uid: Number(raw.uid || 0),
    username: cleanText(raw.username, 80),
    userslug: cleanText(raw.userslug, 120),
    displayName: cleanText(raw.peipe_partner_display_name || raw.username, 40),
    picture: photos[0] || accountPicture || '',
    accountPicture,
    photos,
    tags,
    bio: cleanText(raw.bio || raw.signature || '', 140),
    gender: cleanText(raw.gender, 40),
    age: Number(raw.age || 0) || '',
    language_flag: cleanText(raw.language_flag, 40),
    language_fluent: cleanText(raw.language_fluent, 40),
    language_learning: cleanText(raw.language_learning, 40),
  };
}

function getMissing(profile) {
  const missing = [];
  if (!profile.displayName) missing.push('displayName');
  if (!profile.picture) missing.push('picture');
  if (!profile.language_flag) missing.push('language_flag');
  if (!profile.language_fluent) missing.push('language_fluent');
  if (!profile.language_learning) missing.push('language_learning');
  if (!profile.gender) missing.push('gender');
  if (!Number(profile.age)) missing.push('age');
  if (!profile.tags.length) missing.push('tags');
  return missing;
}

function decorateUser(baseUser, extra) {
  const profile = normaliseProfile(Object.assign({}, baseUser, extra, { uid: baseUser.uid || extra.uid }));
  return Object.assign({}, baseUser, {
    username: profile.displayName || baseUser.username,
    displayName: profile.displayName || baseUser.username,
    picture: profile.picture || baseUser.picture,
    photos: profile.photos.length ? profile.photos : [baseUser.picture].filter(Boolean),
    tags: profile.tags,
    bio: profile.bio || baseUser.bio || baseUser.signature || '',
    age: profile.age || baseUser.age || '',
    gender: profile.gender || baseUser.gender || '',
    nativeCode: baseUser.nativeCode || profile.language_fluent,
    learnCode: baseUser.learnCode || profile.language_learning,
    countryCode: baseUser.countryCode || profile.language_flag,
  });
}

async function getExtraUsersFields(users) {
  const uids = users
    .map((item) => Number(item && item.uid))
    .filter(Boolean);

  if (!uids.length) {
    return new Map();
  }

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
    users: users.map((item) => decorateUser(item, extras.get(Number(item.uid)) || {})),
  });
}

async function getMe(uid) {
  const raw = await user.getUserFields(uid, EXTRA_FIELDS);
  const profile = normaliseProfile(Object.assign({}, raw, { uid }));
  const missing = getMissing(profile);

  return {
    ok: true,
    complete: missing.length === 0,
    missing,
    profile,
    tagCategories: tagData.categories,
  };
}

async function saveMe(uid, body) {
  const current = await user.getUserFields(uid, EXTRA_FIELDS);

  const displayName = cleanText(body.displayName || body.username || current.peipe_partner_display_name || current.username, 40);
  const photo = cleanUrl(body.picture || body.photo || body.peipe_partner_photo || current.peipe_partner_photo || current.picture || current.uploadedpicture);
  const photos = normalisePhotos(body.photos || body.peipe_partner_photos, photo).slice(0, 5);
  const tags = tagData.normaliseSelectedTags(body.tags || body.peipe_partner_tags);
  const age = Math.max(0, Math.min(120, Number(body.age || current.age || 0) || 0));

  const fields = {
    peipe_partner_display_name: displayName,
    peipe_partner_photo: photo,
    peipe_partner_photos: JSON.stringify(photos),
    peipe_partner_tags: JSON.stringify(tags),
    bio: cleanText(body.bio || current.bio || '', 140),
    language_flag: cleanText(body.language_flag || body.country || current.language_flag, 40),
    language_fluent: cleanText(body.language_fluent || body.nativeLanguage || current.language_fluent, 40),
    language_learning: cleanText(body.language_learning || body.learningLanguage || current.language_learning, 40),
    gender: cleanText(body.gender || current.gender, 40),
    age,
  };

  await user.setUserFields(uid, fields);

  const profile = normaliseProfile(Object.assign({}, current, fields, { uid }));
  const missing = getMissing(profile);

  return {
    ok: missing.length === 0,
    complete: missing.length === 0,
    missing,
    profile,
  };
}

function tags() {
  return {
    ok: true,
    categories: tagData.categories,
  };
}

module.exports = {
  feed,
  getMe,
  saveMe,
  tags,
};

