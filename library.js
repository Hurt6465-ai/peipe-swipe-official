'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const partner = require('./lib/partner');
const swipe = require('./swipe');
const partnerReviews = require('./swipe/comments');
const user = require.main.require('./src/user');
const db = require.main.require('./src/database');

const plugin = {};

function asyncRoute(fn) {
  return function routeHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function json(res, payload) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.json(payload);
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
  return `${Math.round(km)}km`;
}

async function getViewerGeo(uid) {
  uid = Number(uid || 0);
  if (!uid) return null;
  const row = await user.getUserFields(uid, ['lat', 'lng', 'peipe_partner_lat', 'peipe_partner_lng']).catch(() => null);
  if (!row) return null;
  const lat = Number(row.lat || row.peipe_partner_lat);
  const lng = Number(row.lng || row.peipe_partner_lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function decorateFeedWithDistance(req, payload) {
  const users = Array.isArray(payload && payload.users) ? payload.users : [];
  if (!users.length) return payload;
  const viewerGeo = await getViewerGeo(req.uid);
  if (!viewerGeo) return payload;
  const uids = users.map(item => Number(item && item.uid)).filter(Boolean);
  const rows = await user.getUsersFields(uids, ['uid', 'lat', 'lng', 'peipe_partner_lat', 'peipe_partner_lng']).catch(() => []);
  const geo = new Map();
  rows.forEach((row) => {
    const lat = Number(row && (row.lat || row.peipe_partner_lat));
    const lng = Number(row && (row.lng || row.peipe_partner_lng));
    if (Number.isFinite(lat) && Number.isFinite(lng)) geo.set(Number(row.uid), { lat, lng });
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

plugin.init = async ({ router, middleware }) => {
  routeHelpers.setupPageRoute(router, '/partners', [], (req, res) => {
    res.render('peipe-partners', { uid: req.uid || 0 });
  });

  routeHelpers.setupPageRoute(router, '/nearby', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'nearby' });
  });

  routeHelpers.setupPageRoute(router, '/nearby/list', [], (req, res) => {
    res.render('peipe-nearby', { uid: req.uid || 0 });
  });

  routeHelpers.setupPageRoute(router, '/partners/swipe', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'recommend' });
  });

  routeHelpers.setupPageRoute(router, '/nearby/swipe', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'nearby' });
  });

  router.get('/api/peipe-partners', asyncRoute(async (req, res) => {
    json(res, await partner.list(req));
  }));

  router.get('/api/peipe-partners/options', asyncRoute(async (req, res) => {
    json(res, await partner.options(req));
  }));

  router.get('/api/peipe-partners/me/profile-status', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.profileStatus(req.uid));
  }));

  router.put('/api/peipe-partners/me/profile', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.saveProfile(req.uid, req.body || {}));
  }));

  router.put('/api/peipe-partners/location', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await saveLocation(req.uid, req.body || {}));
  }));

  router.post('/api/peipe-partners/me/chatted', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.markChatted(req.uid, req.body || {}));
  }));

  router.post('/api/peipe-partners/me/greet', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.greet(req.uid, req.body || {}));
  }));

  router.get('/api/peipe-partners/swipe/feed', asyncRoute(async (req, res) => {
    json(res, await decorateFeedWithDistance(req, await swipe.feed(req)));
  }));

  router.get('/api/peipe-partners/swipe/tags', asyncRoute(async (req, res) => {
    json(res, swipe.tags(req));
  }));

  router.get('/api/peipe-partners/swipe/me', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await swipe.getMe(req.uid));
  }));

  router.put('/api/peipe-partners/swipe/me', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await swipe.saveMe(req.uid, req.body || {}));
  }));

  router.get('/api/peipe-partners/comments/:uid', asyncRoute(async (req, res) => {
    json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  }));

  router.get('/api/peipe-partners/profile/:uid/comments', asyncRoute(async (req, res) => {
    json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  }));

  router.get('/api/peipe-partners/comments/:uid/eligibility', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.eligibility(req.uid, req.params.uid));
  }));

  router.post('/api/peipe-partners/comments/:uid', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.upsert(req));
  }));

  router.post('/api/peipe-partners/profile/:uid/comments', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.upsert(req));
  }));

  router.put('/api/peipe-partners/comments/item/:id', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.update(req));
  }));

  router.delete('/api/peipe-partners/comments/item/:id', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.remove(req));
  }));
};

plugin.addRoutes = async ({ router, middleware, helpers }) => {
  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.list(req));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/options', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.options(req));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/me/profile-status', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.profileStatus(req.uid));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/me/profile', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.saveProfile(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/location', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await saveLocation(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/me/chatted', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.markChatted(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/me/greet', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.greet(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/swipe/feed', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await decorateFeedWithDistance(req, await swipe.feed(req)));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/swipe/tags', [], async (req, res) => {
    helpers.formatApiResponse(200, res, swipe.tags(req));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/swipe/me', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await swipe.getMe(req.uid));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/swipe/me', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await swipe.saveMe(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/comments/:uid', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/profile/:uid/comments', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/comments/:uid/eligibility', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.eligibility(req.uid, req.params.uid));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/comments/:uid', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/profile/:uid/comments', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/comments/item/:id', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.update(req));
  });

  routeHelpers.setupApiRoute(router, 'delete', '/peipe-partners/comments/item/:id', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.remove(req));
  });
};

module.exports = plugin;
