'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const user = require.main.require('./src/user');
const db = require.main.require('./src/database');
const partner = require('./lib/partner');
const swipe = require('./swipe');
const partnerReviews = require('./swipe/comments');

const plugin = {};
const API_PREFIXES = ['/api/peipe-partners', '/api/peipe-swipe'];
const API_ROUTE_PREFIXES = ['/peipe-partners', '/peipe-swipe'];
const GREET_DAILY_LIMIT = 8;
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

async function markChatted(fromUid, toUid) {
  if (partner && typeof partner.markChatted === 'function') {
    await partner.markChatted(fromUid, { uid: toUid, toUid }).catch(() => {});
  }
}

function dayKey(ts) {
  const d = new Date(ts || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function pairValue(a, b) {
  a = Number(a || 0);
  b = Number(b || 0);
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function dailyGreetKey(uid, ts) {
  return `peipePartners:greet:daily:${Number(uid || 0)}:${dayKey(ts)}`;
}

async function getSortedScore(key, value) {
  value = String(value);
  if (db && typeof db.sortedSetScore === 'function') {
    return db.sortedSetScore(key, value).catch(() => null);
  }
  if (db && typeof db.getSortedSetScore === 'function') {
    return db.getSortedSetScore(key, value).catch(() => null);
  }
  if (db && typeof db.isSortedSetMember === 'function') {
    const ok = await db.isSortedSetMember(key, value).catch(() => false);
    return ok ? 1 : null;
  }
  return null;
}

async function getSortedCard(key) {
  if (db && typeof db.sortedSetCard === 'function') {
    return Number(await db.sortedSetCard(key).catch(() => 0) || 0);
  }
  if (db && typeof db.getSortedSetCard === 'function') {
    return Number(await db.getSortedSetCard(key).catch(() => 0) || 0);
  }
  if (db && typeof db.getSortedSetRange === 'function') {
    const rows = await db.getSortedSetRange(key, 0, -1).catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  }
  return 0;
}

async function expireKey(key, seconds) {
  if (db && typeof db.expire === 'function') return db.expire(key, seconds).catch(() => {});
  if (db && typeof db.pexpire === 'function') return db.pexpire(key, seconds * 1000).catch(() => {});
}

function relationLooksTrue(result) {
  if (result === true) return true;
  if (!result || typeof result !== 'object') return false;
  return !!(result.already || result.chatted || result.exists || result.has || result.ok === true && result.uid);
}

async function hasExistingPartnerRelation(fromUid, toUid) {
  if (!partner) return false;
  const names = ['hasChatted', 'hasGreeted', 'isChatted', 'alreadyChatted', 'hasRelationship'];
  for (const name of names) {
    if (typeof partner[name] !== 'function') continue;
    const byObject = await partner[name](fromUid, { uid: toUid, toUid }).catch(() => null);
    if (relationLooksTrue(byObject)) return true;
    const byUid = await partner[name](fromUid, toUid).catch(() => null);
    if (relationLooksTrue(byUid)) return true;
  }
  return false;
}

async function reserveWukongGreeting(fromUid, toUid, body) {
  const now = Date.now();
  const pair = pairValue(fromUid, toUid);
  const pairKey = 'peipePartners:greet:pairs';
  const dailyKey = dailyGreetKey(fromUid, now);
  const previous = await getSortedScore(pairKey, pair);
  const already = (previous !== null && previous !== undefined) || await hasExistingPartnerRelation(fromUid, toUid);

  if (already) {
    return {
      ok: true,
      already: true,
      limit: GREET_DAILY_LIMIT,
      remaining: Math.max(0, GREET_DAILY_LIMIT - await getSortedCard(dailyKey)),
      uid: toUid,
      text: body && body.text || '',
      chatUrl: wukongChatUrl(toUid),
    };
  }

  const count = await getSortedCard(dailyKey);
  if (count >= GREET_DAILY_LIMIT) {
    return {
      ok: false,
      error: 'daily-limit',
      message: `今天陌生人打招呼次数已用完（${GREET_DAILY_LIMIT} 次）`,
      limit: GREET_DAILY_LIMIT,
      remaining: 0,
      uid: toUid,
      chatUrl: wukongChatUrl(toUid),
    };
  }

  await db.sortedSetAdd(dailyKey, now, String(toUid)).catch(() => {});
  await db.sortedSetAdd(pairKey, now, pair).catch(() => {});
  await expireKey(dailyKey, 3 * 24 * 60 * 60);

  await markChatted(fromUid, toUid);

  return {
    ok: true,
    already: false,
    limit: GREET_DAILY_LIMIT,
    remaining: Math.max(0, GREET_DAILY_LIMIT - count - 1),
    uid: toUid,
    text: body && body.text || '',
    chatUrl: wukongChatUrl(toUid),
  };
}


function wukongChatUrl(toUid) {
  return `/wukong/${encodeURIComponent(String(toUid))}`;
}

async function prepareWukongChatRoute(req) {
  const fromUid = Number(req.uid || 0);
  const toUid = Number(req.body && (req.body.uid || req.body.toUid || req.body.targetUid));
  if (!fromUid) return { ok: false, error: 'login-required' };
  if (!toUid || toUid === fromUid) return { ok: false, error: 'invalid-user' };

  return {
    ok: true,
    mode: 'wukong-standalone',
    uid: toUid,
    chatUrl: wukongChatUrl(toUid),
  };
}

async function sendPrivateGreeting(req) {
  const fromUid = Number(req.uid || 0);
  const toUid = Number(req.body && (req.body.uid || req.body.toUid || req.body.targetUid));
  if (!fromUid) return { ok: false, error: 'login-required' };
  if (!toUid || toUid === fromUid) return { ok: false, error: 'invalid-user' };

  // 悟空独立版前端通过 SDK 发送贴纸消息；后端只做全站限额、陌生人去重和关系记录。
  const reserved = await reserveWukongGreeting(fromUid, toUid, req.body || {});
  if (!reserved.ok) return reserved;

  return {
    ok: true,
    mode: 'wukong-standalone',
    already: !!reserved.already,
    limit: reserved.limit,
    remaining: reserved.remaining,
    uid: toUid,
    content: reserved.text || '',
    text: reserved.text || '',
    chatUrl: reserved.chatUrl,
  };
}

function registerJsonRoutes(router, middleware) {
  API_PREFIXES.forEach((apiPrefix) => {
    router.get(`${apiPrefix}/options`, asyncRoute(async (req, res) => {
      json(res, await partner.options(req));
    }));

    router.put(`${apiPrefix}/location`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await saveLocation(req.uid, req.body || {}));
    }));

    router.post(`${apiPrefix}/me/greet`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await sendPrivateGreeting(req));
    }));

    router.post(`${apiPrefix}/me/wukong-greet`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await sendPrivateGreeting(req));
    }));

    router.post(`${apiPrefix}/me/chat-route`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await prepareWukongChatRoute(req));
    }));

    router.get(`${apiPrefix}/swipe/feed`, asyncRoute(async (req, res) => {
      json(res, await decorateFeedWithDistance(req, await swipe.feed(req)));
    }));

    router.get(`${apiPrefix}/swipe/tags`, asyncRoute(async (req, res) => {
      json(res, swipe.tags(req));
    }));

    router.get(`${apiPrefix}/swipe/me`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await swipe.getMe(req.uid));
    }));

    router.put(`${apiPrefix}/swipe/me`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await swipe.saveMe(req.uid, req.body || {}));
    }));

    router.get(`${apiPrefix}/comments/:uid`, asyncRoute(async (req, res) => {
      json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
    }));

    router.get(`${apiPrefix}/profile/:uid/comments`, asyncRoute(async (req, res) => {
      json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
    }));

    router.get(`${apiPrefix}/comments/:uid/eligibility`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await partnerReviews.eligibility(req.uid, req.params.uid));
    }));

    router.post(`${apiPrefix}/comments/:uid`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await partnerReviews.upsert(req));
    }));

    router.post(`${apiPrefix}/profile/:uid/comments`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await partnerReviews.upsert(req));
    }));

    router.put(`${apiPrefix}/comments/item/:id`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await partnerReviews.update(req));
    }));

    router.delete(`${apiPrefix}/comments/item/:id`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await partnerReviews.remove(req));
    }));
  });
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
  API_ROUTE_PREFIXES.forEach((apiRoutePrefix) => {
    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/options`, [], async (req, res) => {
      helpers.formatApiResponse(200, res, await partner.options(req));
    });

    routeHelpers.setupApiRoute(router, 'put', `${apiRoutePrefix}/location`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await saveLocation(req.uid, req.body || {}));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/me/greet`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await sendPrivateGreeting(req));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/me/wukong-greet`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await sendPrivateGreeting(req));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/me/chat-route`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await prepareWukongChatRoute(req));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/swipe/feed`, [], async (req, res) => {
      helpers.formatApiResponse(200, res, await decorateFeedWithDistance(req, await swipe.feed(req)));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/swipe/tags`, [], async (req, res) => {
      helpers.formatApiResponse(200, res, swipe.tags(req));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/swipe/me`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await swipe.getMe(req.uid));
    });

    routeHelpers.setupApiRoute(router, 'put', `${apiRoutePrefix}/swipe/me`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await swipe.saveMe(req.uid, req.body || {}));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/comments/:uid`, [], async (req, res) => {
      helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/profile/:uid/comments`, [], async (req, res) => {
      helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/comments/:uid/eligibility`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await partnerReviews.eligibility(req.uid, req.params.uid));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/comments/:uid`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/profile/:uid/comments`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
    });

    routeHelpers.setupApiRoute(router, 'put', `${apiRoutePrefix}/comments/item/:id`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await partnerReviews.update(req));
    });

    routeHelpers.setupApiRoute(router, 'delete', `${apiRoutePrefix}/comments/item/:id`, [middleware.ensureLoggedIn], async (req, res) => {
      helpers.formatApiResponse(200, res, await partnerReviews.remove(req));
    });
  });
};

module.exports = plugin;
