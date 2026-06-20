'use strict';

const user = require.main.require('./src/user');
const partner = require('../lib/partner');
const tagData = require('./tags');

const GEO_FIELDS = [
  'uid',
  'lat', 'lng',
  'peipe_partner_lat', 'peipe_partner_lng',
  'peipe_partner_location_expires_at',
  'languagePartnerGeoExpiresAt',
];

function toRad(value) {
  return Number(value || 0) * Math.PI / 180;
}

function distanceKmBetween(a, b) {
  const lat1 = Number(a && a.lat);
  const lng1 = Number(a && a.lng);
  const lat2 = Number(b && b.lat);
  const lng2 = Number(b && b.lng);
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
  if (km < 1) return '1km 内';
  if (km < 5) return '5km 内';
  if (km < 20) return '20km 内';
  if (km < 50) return '50km 内';
  if (km < 100) return '100km 内';
  return `${Math.round(km)}km`;
}

function parseGeoRow(row) {
  if (!row) return null;
  const expiresAt = Number(row.peipe_partner_location_expires_at || row.languagePartnerGeoExpiresAt || 0);
  if (expiresAt && expiresAt < Date.now()) return null;
  const lat = Number(row.lat || row.peipe_partner_lat);
  const lng = Number(row.lng || row.peipe_partner_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;
  return { lat, lng };
}

async function getViewerGeo(uid) {
  uid = Number(uid || 0);
  if (!uid) return null;
  const row = await user.getUserFields(uid, GEO_FIELDS).catch(() => null);
  return parseGeoRow(row);
}

function publicCard(item) {
  item = Object.assign({}, item || {});
  delete item.lat;
  delete item.lng;
  delete item.peipe_partner_lat;
  delete item.peipe_partner_lng;
  delete item.birthday;
  delete item.birthdate;
  delete item.peipe_partner_birthday;
  return item;
}

async function decorateDistances(uid, payload) {
  payload = payload || {};
  const users = Array.isArray(payload.users) ? payload.users : [];
  payload.users = users.map(publicCard);
  if (!users.length) return payload;

  const viewerGeo = await getViewerGeo(uid).catch(() => null);
  if (!viewerGeo) return payload;

  const uids = users.map(item => Number(item && item.uid)).filter(Boolean);
  const rows = await user.getUsersFields(uids, GEO_FIELDS).catch(() => []);
  const geo = new Map();
  (rows || []).forEach((row) => {
    const point = parseGeoRow(row);
    if (point) geo.set(Number(row.uid), point);
  });

  payload.users = payload.users.map((item) => {
    const targetGeo = geo.get(Number(item && item.uid));
    const km = distanceKmBetween(viewerGeo, targetGeo);
    if (km > 0) {
      item.distanceKm = Math.round(km * 100) / 100;
      item.distanceText = formatDistance(km);
    }
    return item;
  });
  return payload;
}

function profileFromRaw(raw) {
  raw = raw || {};
  const decorated = partner.decorateUser(raw) || {};
  return Object.assign({}, raw, decorated, {
    displayName: decorated.displayName || raw.peipe_partner_display_name || raw.fullname || raw.name || raw.nickname || raw.username || '',
    avatar: decorated.avatar || raw.picture || raw.uploadedpicture || '',
    accountPicture: decorated.avatar || raw.picture || raw.uploadedpicture || '',
    photos: decorated.photos || [],
    tags: decorated.tags || [],
    bio: decorated.bio || raw.bio || raw.aboutme || raw.signature || '',
    language_flag: raw.language_flag || decorated.countryCode || '',
    language_fluent: decorated.nativeCodes || [],
    language_learning: decorated.learnCodes || [],
    gender: decorated.genderCode || decorated.gender || raw.gender || '',
    birthday: raw.peipe_partner_birthday || raw.birthday || raw.birthdate || '',
    heightCm: decorated.heightCm || raw.peipe_partner_height || '',
    weightKg: decorated.weightKg || raw.peipe_partner_weight || '',
    education: decorated.education || raw.peipe_partner_education || '',
    occupation: decorated.occupation || raw.peipe_partner_occupation || '',
    relationship: decorated.relationshipStatus || raw.peipe_partner_relationship || raw.relationship_status || '',
    location: raw.peipe_partner_location || raw.location || '',
    locationText: raw.peipe_partner_location || raw.location || '',
  });
}

async function feed(req) {
  const payload = await partner.list(req);
  return decorateDistances(req && req.uid, payload);
}

async function getMe(uid) {
  if (!partner || typeof partner.profileStatus !== 'function') {
    return { ok: false, error: 'profile-status-missing', complete: true, missing: [], profile: {}, tagCategories: tagData.categories };
  }
  const payload = await partner.profileStatus(uid);
  return Object.assign({}, payload, {
    ok: payload && payload.ok !== false,
    profile: profileFromRaw(payload && payload.profile || {}),
    tagCategories: tagData.categories,
  });
}

async function saveMe(uid, body) {
  if (!partner || typeof partner.saveProfile !== 'function') return { ok: false, error: 'profile-save-missing' };
  const saved = await partner.saveProfile(uid, body || {});
  if (saved && saved.ok === false) return saved;
  return getMe(uid);
}

function tags() {
  return { ok: true, categories: tagData.categories };
}

module.exports = { feed, getMe, saveMe, tags };
