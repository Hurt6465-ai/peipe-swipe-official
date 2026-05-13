'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const user = require.main.require('./src/user');
const db = require.main.require('./src/database');
const partner = require('./lib/partner');
const swipe = require('./swipe');
const partnerReviews = require('./swipe/comments');

let messaging = null;
try {
  messaging = require.main.require('./src/messaging');
} catch (err) {
  messaging = null;
}

const plugin = {};
const API_PREFIX = '/api/peipe-swipe';
const API_ROUTE_PREFIX = '/peipe-swipe';
const GREET_STICKERS = [
  'hello-01', 'hello-02', 'hello-03', 'hello-04', 'hello-05',
  'hello-06', 'hello-07', 'hello-08', 'hello-09', 'hello-10',
];

function asyncRoute(fn) {
  return function routeHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function json(res, payload) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.json(payload);
}

function toRad(value) {
  return Number(value || 0) * Math.PI / 180;
}

function distanceKm(a, b) {
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
  if (km < 0.5) return '500米内';
  if (km < 1) return `${Math.round(km * 1000)}米`;
  if (km > 1000) return '1000km外';
  return `${Math.round(km)}km`;
}

function parseGeoRow(row) {
  if (!row) return null;
  const expiresAt = Number(row.peipe_partner_location_expires_at || row.location_expires_at || 0);
  if (expiresAt && expiresAt < Date.now()) return null;
  const lat = Number(row.lat || row.peipe_partner_lat);
  const lng = Number(row.lng || row.peipe_partner_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;
  return { lat, lng };
}

async function getViewerGeo(uid) {
  uid = Number(uid || 0);
  if (!uid) return null;
  const row = await user.getUserFields(uid, ['lat', 'lng', 'peipe_partner_lat', 'peipe_partner_lng', 'peipe_partner_location_expires_at']).catch(() => null);
  return parseGeoRow(row);
}

async function decorateFeedWithDistance(req, payload) {
  const users = Array.isArray(payload && payload.users) ? payload.users : [];
  if (!users.length) return payload;
  const viewerGeo = await getViewerGeo(req.uid);
  if (!viewerGeo) return payload;

  const uids = users.map(item => Number(item && item.uid)).filter(Boolean);
  const rows = await user.getUsersFields(uids, ['uid', 'lat', 'lng', 'peipe_partner_lat', 'peipe_partner_lng', 'peipe_partner_location_expires_at']).catch(() => []);
  const geo = new Map();
  rows.forEach((row) => {
    const point = parseGeoRow(row);
    if (point) geo.set(Number(row.uid), point);
  });

  payload.users = users.map((item) => {
    const targetGeo = geo.get(Number(item.uid));
    const km = distanceKm(viewerGeo, targetGeo);
    if (km > 0) {
      item.distanceKm = km;
      item.distanceText = formatDistance(km);
    }
    return item;
  });
  return payload;
}

async function saveLocation(uid, body) {
  if (partner && typeof partner.saveLocation === 'function') {
    return partner.saveLocation(uid, body || {});
  }

  uid = Number(uid || 0);
  const lat = Number(body && body.lat);
  const lng = Number(body && body.lng);
  const accuracy = Number(body && body.accuracy) || 0;
  if (!uid || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, error: 'invalid-location' };
  }

  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
  await user.setUserFields(uid, {
    lat,
    lng,
    peipe_partner_lat: lat,
    peipe_partner_lng: lng,
    peipe_partner_location_accuracy: accuracy,
    peipe_partner_location_updated_at: now,
    peipe_partner_location_expires_at: expiresAt,
  });
  await db.sortedSetAdd('peipePartners:location:updated', now, uid).catch(() => {});
  return { ok: true, lat, lng, accuracy, updatedAt: now, expiresAt };
}

function randomWaveMessage() {
  const name = GREET_STICKERS[Math.floor(Math.random() * GREET_STICKERS.length)];
  return name ? `[peipe-greet:${name}]` : '';
}

async function markChatted(fromUid, toUid) {
  if (partner && typeof partner.markChatted === 'function') {
    await partner.markChatted(fromUid, { uid: toUid, toUid }).catch(() => {});
  }
}

async function prepareWukongChatRoute(req) {
  const fromUid = Number(req.uid || 0);
  const toUid = Number(req.body && (req.body.uid || req.body.toUid || req.body.targetUid));
  if (!fromUid) return { ok: false, error: 'login-required' };
  if (!toUid || toUid === fromUid) return { ok: false, error: 'invalid-user' };

  let roomId = '';
  if (messaging && typeof messaging.hasPrivateChat === 'function') {
    await messaging.canMessageUser(fromUid, toUid).catch(() => {});
    roomId = await messaging.hasPrivateChat(fromUid, toUid).catch(() => '') || '';
    if (!roomId && typeof messaging.newRoom === 'function') {
      roomId = await messaging.newRoom(fromUid, { uids: [String(toUid)] }).catch(() => '') || '';
    }
  }

  let userslug = '';
  try {
    const row = await user.getUserFields(toUid, ['userslug', 'username']);
    userslug = row && (row.userslug || row.username) || '';
  } catch (err) {}

  await markChatted(fromUid, toUid);
  const chatUrl = userslug ? (`/user/${encodeURIComponent(userslug)}/chats${roomId ? `/${encodeURIComponent(roomId)}` : ''}`) : '';
  return { ok: true, mode: 'wukong', roomId, uid: toUid, userslug, chatUrl };
}

async function sendPrivateGreeting(req) {
  const fromUid = Number(req.uid || 0);
  const toUid = Number(req.body && (req.body.uid || req.body.toUid || req.body.targetUid));
  if (!fromUid) return { ok: false, error: 'login-required' };
  if (!toUid || toUid === fromUid) return { ok: false, error: 'invalid-user' };

  if (!messaging || typeof messaging.hasPrivateChat !== 'function') {
    if (partner && typeof partner.greet === 'function') return partner.greet(fromUid, req.body || {});
    await markChatted(fromUid, toUid);
    return { ok: true, mode: 'mark-only', uid: toUid };
  }

  await messaging.canMessageUser(fromUid, toUid);
  let roomId = await messaging.hasPrivateChat(fromUid, toUid);
  if (!roomId) roomId = await messaging.newRoom(fromUid, { uids: [String(toUid)] });

  const content = randomWaveMessage();
  const message = await messaging.sendMessage({ uid: fromUid, roomId, content });
  if (message && typeof messaging.notifyUsersInRoom === 'function') {
    await messaging.notifyUsersInRoom(fromUid, roomId, message).catch(() => {});
  }
  await markChatted(fromUid, toUid);
  return { ok: true, mode: 'chat', roomId, message, content };
}

function registerJsonRoutes(router, middleware) {
  router.get(`${API_PREFIX}/options`, asyncRoute(async (req, res) => {
    json(res, await partner.options(req));
  }));

  router.put(`${API_PREFIX}/location`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await saveLocation(req.uid, req.body || {}));
  }));

  router.post(`${API_PREFIX}/me/greet`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await sendPrivateGreeting(req));
  }));

  router.post(`${API_PREFIX}/me/chat-route`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await prepareWukongChatRoute(req));
  }));

  router.get(`${API_PREFIX}/swipe/feed`, asyncRoute(async (req, res) => {
    json(res, await decorateFeedWithDistance(req, await swipe.feed(req)));
  }));

  router.get(`${API_PREFIX}/swipe/tags`, asyncRoute(async (req, res) => {
    json(res, swipe.tags(req));
  }));

  router.get(`${API_PREFIX}/swipe/me`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await swipe.getMe(req.uid));
  }));

  router.put(`${API_PREFIX}/swipe/me`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await swipe.saveMe(req.uid, req.body || {}));
  }));

  router.get(`${API_PREFIX}/comments/:uid`, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  }));

  router.get(`${API_PREFIX}/profile/:uid/comments`, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  }));

  router.get(`${API_PREFIX}/comments/:uid/eligibility`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.eligibility(req.uid, req.params.uid));
  }));

  router.post(`${API_PREFIX}/comments/:uid`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.upsert(req));
  }));

  router.post(`${API_PREFIX}/profile/:uid/comments`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.upsert(req));
  }));

  router.put(`${API_PREFIX}/comments/item/:id`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.update(req));
  }));

  router.delete(`${API_PREFIX}/comments/item/:id`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.remove(req));
  }));
}

plugin.init = async ({ router, middleware }) => {
  routeHelpers.setupPageRoute(router, '/partners/swipe', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'recommend' });
  });

  routeHelpers.setupPageRoute(router, '/nearby/swipe', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'nearby' });
  });

  registerJsonRoutes(router, middleware);
};

plugin.addRoutes = async ({ router, middleware, helpers }) => {
  routeHelpers.setupApiRoute(router, 'get', `${API_ROUTE_PREFIX}/options`, [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.options(req));
  });

  routeHelpers.setupApiRoute(router, 'put', `${API_ROUTE_PREFIX}/location`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await saveLocation(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'post', `${API_ROUTE_PREFIX}/me/greet`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await sendPrivateGreeting(req));
  });

  routeHelpers.setupApiRoute(router, 'post', `${API_ROUTE_PREFIX}/me/chat-route`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await prepareWukongChatRoute(req));
  });

  routeHelpers.setupApiRoute(router, 'get', `${API_ROUTE_PREFIX}/swipe/feed`, [], async (req, res) => {
    helpers.formatApiResponse(200, res, await decorateFeedWithDistance(req, await swipe.feed(req)));
  });

  routeHelpers.setupApiRoute(router, 'get', `${API_ROUTE_PREFIX}/swipe/tags`, [], async (req, res) => {
    helpers.formatApiResponse(200, res, swipe.tags(req));
  });

  routeHelpers.setupApiRoute(router, 'get', `${API_ROUTE_PREFIX}/swipe/me`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await swipe.getMe(req.uid));
  });

  routeHelpers.setupApiRoute(router, 'put', `${API_ROUTE_PREFIX}/swipe/me`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await swipe.saveMe(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'get', `${API_ROUTE_PREFIX}/comments/:uid`, [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  });

  routeHelpers.setupApiRoute(router, 'get', `${API_ROUTE_PREFIX}/profile/:uid/comments`, [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  });

  routeHelpers.setupApiRoute(router, 'get', `${API_ROUTE_PREFIX}/comments/:uid/eligibility`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.eligibility(req.uid, req.params.uid));
  });

  routeHelpers.setupApiRoute(router, 'post', `${API_ROUTE_PREFIX}/comments/:uid`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
  });

  routeHelpers.setupApiRoute(router, 'post', `${API_ROUTE_PREFIX}/profile/:uid/comments`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
  });

  routeHelpers.setupApiRoute(router, 'put', `${API_ROUTE_PREFIX}/comments/item/:id`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.update(req));
  });

  routeHelpers.setupApiRoute(router, 'delete', `${API_ROUTE_PREFIX}/comments/item/:id`, [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.remove(req));
  });
};

module.exports = plugin;
