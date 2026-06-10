'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const user = require.main.require('./src/user');
const db = require.main.require('./src/database');
const http = require('http');
const https = require('https');

let groups = null;
try {
  groups = require.main.require('./src/groups');
} catch (err) {
  groups = null;
}

function safeRequire(path, fallback) {
  try {
    return require(path);
  } catch (err) {
    return fallback || null;
  }
}

const partner = safeRequire('./lib/partner', {});
const swipe = safeRequire('./swipe', {});
const partnerReviews = safeRequire('./swipe/comments', {});
const recRedis = safeRequire('./lib/redis-lite', null);

const plugin = {};
const API_PREFIXES = ['/api/peipe-partners', '/api/peipe-swipe'];
const API_ROUTE_PREFIXES = ['/peipe-partners', '/peipe-swipe'];

const VIP_GROUPS = ['vip', 'VIP', 'Vip', 'premium', 'Premium', 'VIP会员', '会员'];
const NORMAL_GREET_LIMIT = 8;
const VIP_GREET_LIMIT = 30;

// 现在先不强制个人主页打招呼 VIP 专属。要做会员权益时改成 true，前端再配合弹付费引导。
const PROFILE_GREET_REQUIRES_VIP = false;

const REC_CACHE = {
  queueSize: Math.max(30, Number(process.env.PEIPE_REC_QUEUE_SIZE || 300) || 300),
  queueTtlSec: Math.max(60, Number(process.env.PEIPE_REC_QUEUE_TTL_SEC || 6 * 60 * 60) || 6 * 60 * 60),
  cardTtlSec: Math.max(60, Number(process.env.PEIPE_REC_CARD_TTL_SEC || 30 * 60) || 30 * 60),
  shownTtlSec: Math.max(60, Number(process.env.PEIPE_REC_SHOWN_TTL_SEC || 60 * 60) || 60 * 60),
  rerankWindow: Math.max(18, Number(process.env.PEIPE_REC_RERANK_WINDOW || 80) || 80),
  maxLimit: Math.max(1, Number(process.env.PEIPE_MAX_LIMIT || 30) || 30),
  rateWindowSec: Math.max(10, Number(process.env.PEIPE_RATE_WINDOW_SEC || 30) || 30),
  rateMax: Math.max(1, Number(process.env.PEIPE_RATE_MAX || 12) || 12),
  locationTtlSec: Math.max(24 * 60 * 60, Number(process.env.PEIPE_LOCATION_TTL_SEC || 7 * 24 * 60 * 60) || 7 * 24 * 60 * 60),
};

// 悟空服务端 REST API。当前默认按悟空官方默认内网端口 5001 调用，
// 后期可以用环境变量覆盖：PEIPE_WUKONG_API_BASE=http://127.0.0.1:5001
const WUKONG_API_BASE = String(
  process.env.PEIPE_WUKONG_API_BASE ||
  process.env.WUKONG_API_BASE ||
  process.env.WUKONG_API_URL ||
  'http://127.0.0.1:5001'
).replace(/\/+$/, '');
const WUKONG_SERVER_SEND_ENABLED = String(process.env.PEIPE_WUKONG_SERVER_SEND || '1') !== '0';

function asyncRoute(fn) {
  return function routeHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function statusForPayload(payload) {
  if (!payload || payload.ok !== false) return 200;
  const error = String(payload.error || payload.reason || payload.message || '');
  if (/login|required-login|not-logged-in/.test(error)) return 401;
  if (/vip-required|no-privileges|forbidden/.test(error)) return 403;
  if (/daily-limit|rate-limit|too-many/.test(error)) return 429;
  if (/invalid|missing|bad-request/.test(error)) return 400;
  return 400;
}

function json(res, payload) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.status(statusForPayload(payload)).json(payload);
}

function apiResponse(helpers, res, payload) {
  helpers.formatApiResponse(statusForPayload(payload), res, payload);
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
  const expiresAt = Number(row.peipe_partner_location_expires_at || row.location_expires_at || row.languagePartnerGeoExpiresAt || 0);
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
  const fields = ['lat', 'lng', 'peipe_partner_lat', 'peipe_partner_lng', 'peipe_partner_location_expires_at', 'languagePartnerGeoExpiresAt'];
  const row = await user.getUserFields(uid, fields).catch(() => null);
  return parseGeoRow(row);
}

async function decorateFeedWithDistance(req, payload) {
  payload = payload || {};
  const users = Array.isArray(payload.users) ? payload.users : [];
  payload.users = users;
  if (!users.length) return payload;

  const viewerGeo = await getViewerGeo(req.uid).catch(() => null);
  if (!viewerGeo) return payload;

  const uids = users.map(item => Number(item && item.uid)).filter(Boolean);
  const fields = ['uid', 'lat', 'lng', 'peipe_partner_lat', 'peipe_partner_lng', 'peipe_partner_location_expires_at', 'languagePartnerGeoExpiresAt'];
  const rows = await user.getUsersFields(uids, fields).catch(() => []);
  const geo = new Map();
  (rows || []).forEach((row) => {
    const point = parseGeoRow(row);
    if (point) geo.set(Number(row.uid), point);
  });

  payload.users = users.map((item) => {
    const targetGeo = geo.get(Number(item && item.uid));
    const km = distanceKm(viewerGeo, targetGeo);
    if (km > 0) {
      item.distanceKm = km;
      item.distanceText = formatDistance(km);
    }
    return item;
  });
  return payload;
}

function getSwipeApiFunction(primary, fallback) {
  if (swipe && typeof swipe[primary] === 'function') return swipe[primary].bind(swipe);
  if (fallback && swipe && typeof swipe[fallback] === 'function') return swipe[fallback].bind(swipe);
  return null;
}

async function getSwipeOptions(req) {
  if (partner && typeof partner.options === 'function') return partner.options(req).catch(() => ({ ok: true }));
  const fn = getSwipeApiFunction('options');
  if (fn) return fn(req).catch(() => ({ ok: true }));
  return { ok: true };
}

async function getSwipeFeed(req) {
  const fn = getSwipeApiFunction('feed', 'list');
  if (!fn) return { ok: false, error: 'swipe-feed-missing', users: [], hasMore: false };
  try {
    const payload = await fn(req);
    if (!payload || typeof payload !== 'object') return { ok: true, users: [], hasMore: false };
    if (!Array.isArray(payload.users)) payload.users = [];
    if (payload.ok === undefined) payload.ok = true;
    return payload;
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'swipe-feed-failed', users: [], hasMore: false };
  }
}

async function getSwipeTags(req) {
  const fn = getSwipeApiFunction('tags');
  if (fn) return fn(req).catch(() => ({ ok: true, categories: [] }));
  return { ok: true, categories: [] };
}

async function getSwipeMe(uid) {
  const fn = getSwipeApiFunction('getMe', 'profileStatus');
  if (!fn) return { ok: true, complete: true, profile: {}, missing: [] };
  return fn(uid).catch(err => ({ ok: false, error: (err && err.message) || 'profile-load-failed', complete: true, profile: {}, missing: [] }));
}

async function invalidateRecCache(uid, mode) {
  if (!redisReady()) return;
  uid = Number(uid || 0);
  if (!uid) return;
  const modes = mode ? [mode] : ['recommend', 'nearby'];
  await Promise.all(modes.map(async (m) => {
    await recRedis.delKey(recKey('queue', m, uid));
    await recRedis.delKey(recKey('shown', m, uid));
  }));
}

async function cacheGeoLocation(uid, payload) {
  if (!redisReady()) return;
  uid = Number(uid || 0);
  const lat = Number(payload && payload.lat);
  const lng = Number(payload && payload.lng);
  if (!uid || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  const ttl = REC_CACHE.locationTtlSec;
  await recRedis.setJson(`peipe:geo:location:${uid}`, {
    uid,
    lat,
    lng,
    accuracy: Number(payload.accuracy || 0) || 0,
    updatedAt: Number(payload.updatedAt || Date.now()) || Date.now(),
    expiresAt: Number(payload.expiresAt || (Date.now() + ttl * 1000)) || (Date.now() + ttl * 1000),
  }, ttl);
  // Redis GEO 没有单个成员 TTL，所以用 peipe:geo:location:{uid} 判断是否过期。
  await recRedis.command(['GEOADD', 'peipe:geo:users', String(lng), String(lat), String(uid)], null);
}

async function saveSwipeMe(uid, body) {
  const fn = getSwipeApiFunction('saveMe', 'saveProfile');
  if (!fn) return { ok: false, error: 'swipe-save-missing' };
  const payload = await fn(uid, body || {}).catch(err => ({ ok: false, error: (err && err.message) || 'profile-save-failed' }));
  if (payload && payload.ok !== false) {
    // 语言、头像、标签、资料完整度变化后，不能等 6 小时 TTL，直接让下次访问重算队列。
    await invalidateRecCache(uid);
  }
  return payload;
}

async function saveLocation(uid, body) {
  let payload;
  if (partner && typeof partner.saveLocation === 'function') {
    payload = await partner.saveLocation(uid, body || {}).catch(err => ({ ok: false, error: (err && err.message) || 'location-save-failed' }));
  } else {
    uid = Number(uid || 0);
    const lat = Number(body && (body.lat || body.latitude));
    const lng = Number(body && (body.lng || body.longitude));
    const accuracy = Number(body && body.accuracy) || 0;
    if (!uid || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { ok: false, error: 'invalid-location' };
    }

    const ts = Date.now();
    const expiresAt = ts + REC_CACHE.locationTtlSec * 1000;
    await user.setUserFields(uid, {
      lat,
      lng,
      peipe_partner_lat: lat,
      peipe_partner_lng: lng,
      peipe_partner_location_accuracy: accuracy,
      peipe_partner_location_updated_at: ts,
      peipe_partner_location_expires_at: expiresAt,
      languagePartnerGeoUpdatedAt: ts,
      languagePartnerGeoExpiresAt: expiresAt,
    });
    await db.sortedSetAdd('peipePartners:location:updated', ts, String(uid)).catch(() => {});
    payload = { ok: true, lat, lng, accuracy, updatedAt: ts, expiresAt };
  }

  if (payload && payload.ok !== false) {
    await cacheGeoLocation(uid, payload);
    await invalidateRecCache(uid, 'nearby');
  }
  return payload;
}

function dateKey(ts) {
  const d = new Date(ts || Date.now());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function wukongChatUrl(toUid) {
  return `/wukong/${encodeURIComponent(String(toUid))}`;
}

function targetUidFromReq(req) {
  return Number(req && (
    (req.body && (req.body.uid || req.body.toUid || req.body.targetUid)) ||
    (req.params && (req.params.uid || req.params.toUid || req.params.targetUid))
  )) || 0;
}

function greetSource(req) {
  return String(req && req.body && (req.body.source || req.body.from || req.body.scene) || '').toLowerCase();
}

async function isVip(uid) {
  uid = Number(uid || 0);
  if (!uid || !groups || typeof groups.isMemberOfGroups !== 'function') return false;
  try {
    return !!(await groups.isMemberOfGroups(uid, VIP_GROUPS));
  } catch (err) {
    return false;
  }
}

async function greetLimitFor(uid) {
  return await isVip(uid) ? VIP_GREET_LIMIT : NORMAL_GREET_LIMIT;
}

function greetedKey(uid) {
  return `peipePartners:greeted:${Number(uid || 0)}`;
}

function greetedByKey(uid) {
  return `peipePartners:greetedBy:${Number(uid || 0)}`;
}

function dailyGreetKey(uid, ts) {
  return `peipePartners:greet:daily:${dateKey(ts)}:${Number(uid || 0)}`;
}

function chattedKey(uid) {
  return `peipePartners:chatted:${Number(uid || 0)}`;
}

async function sortedSetScore(key, value) {
  value = String(value);
  if (db && typeof db.sortedSetScore === 'function') return db.sortedSetScore(key, value).catch(() => null);
  if (db && typeof db.getSortedSetScore === 'function') return db.getSortedSetScore(key, value).catch(() => null);
  if (db && typeof db.isSortedSetMember === 'function') {
    const ok = await db.isSortedSetMember(key, value).catch(() => false);
    return ok ? 1 : null;
  }
  return null;
}

async function sortedSetCard(key) {
  if (db && typeof db.sortedSetCard === 'function') return Number(await db.sortedSetCard(key).catch(() => 0) || 0);
  if (db && typeof db.getSortedSetCard === 'function') return Number(await db.getSortedSetCard(key).catch(() => 0) || 0);
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

async function isSortedMember(key, value) {
  const score = await sortedSetScore(key, value);
  return score !== null && score !== undefined;
}

function relationLooksTrue(result) {
  if (result === true) return true;
  if (!result || typeof result !== 'object') return false;
  return !!(result.already || result.chatted || result.exists || result.has || result.ok === true && result.uid);
}

async function hasPartnerRelation(methods, fromUid, toUid) {
  if (!partner) return false;
  for (const name of methods) {
    if (typeof partner[name] !== 'function') continue;
    const byObject = await partner[name](fromUid, { uid: toUid, toUid }).catch(() => null);
    if (relationLooksTrue(byObject)) return true;
    const byUid = await partner[name](fromUid, toUid).catch(() => null);
    if (relationLooksTrue(byUid)) return true;
  }
  return false;
}

async function hasChatted(fromUid, toUid) {
  if (await isSortedMember(chattedKey(fromUid), toUid)) return true;
  return hasPartnerRelation(['hasChatted', 'isChatted', 'alreadyChatted', 'hasRelationship'], fromUid, toUid);
}

async function hasGreeted(fromUid, toUid) {
  if (await isSortedMember(greetedKey(fromUid), toUid)) return true;
  return hasPartnerRelation(['hasGreeted', 'alreadyGreeted'], fromUid, toUid);
}

async function markGreeted(fromUid, toUid, ts, body) {
  const text = String((body && (body.text || body.message || body.content)) || '');
  await Promise.all([
    db.sortedSetAdd(greetedKey(fromUid), ts, String(toUid)).catch(() => {}),
    db.sortedSetAdd(greetedByKey(toUid), ts, String(fromUid)).catch(() => {}),
    db.sortedSetAdd('peipePartners:greet:events', ts, JSON.stringify({ fromUid, toUid, text, ts })).catch(() => {}),
  ]);

  // partner.js 如果以后实现 markGreeted，这里会同步一份；没有也不影响当前 Mongo 版。
  if (partner && typeof partner.markGreeted === 'function') {
    await partner.markGreeted(fromUid, { uid: toUid, toUid, text }).catch(() => {});
  }
}


function randomGreetText() {
  const idx = Math.floor(Math.random() * 10) + 1;
  return `[peipe-greet:hello-${idx < 10 ? `0${idx}` : String(idx)}]`;
}

function safeText(value, fallback) {
  const text = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return text || fallback || randomGreetText();
}

function makeClientMsgNo(fromUid, toUid) {
  return `pps_greet_${fromUid}_${toUid}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function postJson(url, payload, timeoutMs) {
  timeoutMs = Number(timeoutMs || 5000);
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(new Error(`invalid-url: ${url}`));
      return;
    }

    const body = Buffer.from(JSON.stringify(payload || {}));
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: `${parsed.pathname || '/'}${parsed.search || ''}`,
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        accept: 'application/json',
        'content-length': body.length,
      },
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data = {};
        if (raw) {
          try { data = JSON.parse(raw); } catch (err) { data = { raw }; }
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const msg = (data && (data.msg || data.error || data.message || data.reason || data.raw)) || `wukong-http-${res.statusCode}`;
          const error = new Error(msg);
          error.statusCode = res.statusCode;
          error.response = data;
          error.raw = raw;
          reject(error);
          return;
        }
        resolve(data);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('wukong-send-timeout'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function wukongPayloadBase64(text) {
  // 悟空 /message/send 的 payload 是 base64 后的消息体。
  // 文本消息推荐结构是 { type: 1, content: '...' }，不要把 client_msg_no 塞进 payload，client_msg_no 放顶层。
  const payload = {
    type: 1,
    content: text,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

async function sendWukongServerMessage(fromUid, toUid, text) {
  if (!WUKONG_SERVER_SEND_ENABLED) {
    return { ok: false, skipped: true, error: 'wukong-server-send-disabled' };
  }
  if (!WUKONG_API_BASE) {
    return { ok: false, skipped: true, error: 'wukong-api-base-missing' };
  }

  const clientMsgNo = makeClientMsgNo(fromUid, toUid);
  const url = `${WUKONG_API_BASE}/message/send`;
  const payload = {
    header: {
      no_persist: 0,
      red_dot: 1,
      sync_once: 0,
    },
    client_msg_no: clientMsgNo,
    from_uid: String(fromUid),
    stream_no: '',
    channel_id: String(toUid),
    channel_type: 1,
    expire: 0,
    payload: wukongPayloadBase64(text),
  };

  const data = await postJson(url, payload, 6000);
  return { ok: true, clientMsgNo, response: data };
}

async function rollbackGreetingReservation(fromUid, toUid, ts) {
  const dailyKey = dailyGreetKey(fromUid, ts);
  const value = String(toUid);
  const tasks = [];
  if (db && typeof db.sortedSetRemove === 'function') {
    tasks.push(db.sortedSetRemove(dailyKey, value).catch(() => {}));
    tasks.push(db.sortedSetRemove(greetedKey(fromUid), value).catch(() => {}));
    tasks.push(db.sortedSetRemove(greetedByKey(toUid), String(fromUid)).catch(() => {}));
  } else if (db && typeof db.sortedSetRemoveRangeByScore === 'function') {
    // 没有按 member 删除时不强行清理，避免误删。
  }
  await Promise.all(tasks);
}

async function reserveWukongGreeting(req) {
  const fromUid = Number(req.uid || 0);
  const toUid = targetUidFromReq(req);
  const source = greetSource(req);
  const body = Object.assign({}, req.body || {}, { uid: toUid });
  body.text = safeText(body.text || body.message || body.content);

  if (!fromUid) return { ok: false, error: 'login-required', message: '请先登录' };
  if (!toUid || toUid === fromUid) return { ok: false, error: 'invalid-user', message: '无效用户' };

  const vip = await isVip(fromUid);
  if (PROFILE_GREET_REQUIRES_VIP && source === 'profile' && !vip) {
    return {
      ok: false,
      error: 'vip-required',
      message: '个人主页主动打招呼是 VIP 权益',
      uid: toUid,
      chatUrl: wukongChatUrl(toUid),
    };
  }

  const limit = vip ? VIP_GREET_LIMIT : NORMAL_GREET_LIMIT;
  const now = Date.now();
  const dailyKey = dailyGreetKey(fromUid, now);
  const chatted = await hasChatted(fromUid, toUid);
  const greeted = chatted ? false : await hasGreeted(fromUid, toUid);
  const count = await sortedSetCard(dailyKey);

  if (chatted || greeted) {
    return {
      ok: true,
      already: true,
      alreadyChatted: chatted,
      alreadyGreeted: greeted,
      vip,
      limit,
      remaining: Math.max(0, limit - count),
      uid: toUid,
      chatUrl: wukongChatUrl(toUid),
      text: body.text,
      mode: 'wukong-standalone',
    };
  }

  if (count >= limit) {
    return {
      ok: false,
      error: 'daily-limit',
      message: `今天陌生人打招呼次数已用完（${limit} 次）`,
      vip,
      limit,
      remaining: 0,
      uid: toUid,
      chatUrl: wukongChatUrl(toUid),
    };
  }

  // 当前 Mongo/NodeBB DB 版本：非 Lua 原子。后期接 Redis 后把这段替换为 Lua。
  await db.sortedSetAdd(dailyKey, now, String(toUid)).catch(() => {});
  await expireKey(dailyKey, 3 * 24 * 60 * 60);
  await markGreeted(fromUid, toUid, now, body);

  return {
    ok: true,
    already: false,
    vip,
    limit,
    remaining: Math.max(0, limit - count - 1),
    uid: toUid,
    chatUrl: wukongChatUrl(toUid),
    text: body.text,
    mode: 'wukong-standalone',
    reserved: true,
    reservedAt: now,
  };
}

async function sendPrivateGreeting(req) {
  const fromUid = Number(req.uid || 0);
  const result = await reserveWukongGreeting(req);
  if (!result.ok) return result;

  const toUid = Number(result.uid || targetUidFromReq(req));
  const text = safeText(result.text || (req.body && (req.body.text || req.body.message || req.body.content)));
  const forceSend = !!(req.body && (req.body.forceSend || req.body.force_send || req.body.resend));
  const shouldSend = !result.already || forceSend;
  let wukong = { ok: false, skipped: true, reason: 'already' };

  if (shouldSend) {
    try {
      wukong = await sendWukongServerMessage(fromUid, toUid, text);
    } catch (err) {
      // 如果这次是新扣次数，但悟空服务端发送失败，尽量回滚，避免“已扣次数但对方看不到”。
      if (result.reserved && result.reservedAt) {
        await rollbackGreetingReservation(fromUid, toUid, result.reservedAt).catch(() => {});
      }
      return {
        ok: false,
        error: 'wukong-send-failed',
        message: `悟空消息发送失败：${(err && err.message) || err || 'unknown'}`,
        uid: toUid,
        chatUrl: result.chatUrl || wukongChatUrl(toUid),
        text,
        wukongSent: false,
        wukongError: (err && err.message) || String(err || ''),
        wukongStatus: err && err.statusCode || 0,
        wukongResponse: err && err.response || null,
      };
    }
  }

  return {
    ok: true,
    mode: 'wukong-standalone',
    already: !!result.already,
    alreadyChatted: !!result.alreadyChatted,
    alreadyGreeted: !!result.alreadyGreeted,
    vip: !!result.vip,
    limit: result.limit,
    remaining: result.remaining,
    uid: toUid,
    content: text,
    text,
    chatUrl: result.chatUrl || wukongChatUrl(toUid),
    wukongSent: !!(wukong && wukong.ok),
    wukongSkipped: !!(wukong && wukong.skipped),
    clientMsgNo: wukong && wukong.clientMsgNo || '',
  };
}

async function prepareWukongChatRoute(req) {
  const fromUid = Number(req.uid || 0);
  const toUid = targetUidFromReq(req);
  if (!fromUid) return { ok: false, error: 'login-required', message: '请先登录' };
  if (!toUid || toUid === fromUid) return { ok: false, error: 'invalid-user', message: '无效用户' };

  // 悟空独立版：打开聊天页不创建 NodeBB 私聊房间，也不扣打招呼次数。
  return {
    ok: true,
    mode: 'wukong-standalone',
    uid: toUid,
    chatUrl: wukongChatUrl(toUid),
  };
}

async function mapLimit(items, limit, iterator) {
  const list = Array.isArray(items) ? items : [];
  const ret = new Array(list.length);
  let index = 0;
  async function worker() {
    while (index < list.length) {
      const i = index;
      index += 1;
      ret[i] = await iterator(list[i], i).catch(() => null);
    }
  }
  const workers = [];
  const n = Math.min(Math.max(1, Number(limit || 1)), list.length || 1);
  for (let i = 0; i < n; i += 1) workers.push(worker());
  await Promise.all(workers);
  return ret;
}

function reviewSummaryFromPayload(payload) {
  const summary = payload && payload.summary || {};
  const overall = Number(summary.overall || summary.score || summary.avg || 0) || 0;
  const count = Number(summary.count || summary.total || 0) || 0;
  return { overall, count };
}

async function getReviewSummaryFor(uid, viewerUid) {
  if (!partnerReviews || typeof partnerReviews.listForTarget !== 'function') return { overall: 0, count: 0 };
  const payload = await partnerReviews.listForTarget(uid, viewerUid, 1).catch(() => null);
  return reviewSummaryFromPayload(payload);
}

function reviewBoost(summary) {
  summary = summary || {};
  const overall = Math.max(0, Math.min(5, Number(summary.overall || 0)));
  const count = Math.max(0, Number(summary.count || 0));
  if (!overall || !count) return 0;
  return Math.min(25, overall * 4 + Math.min(5, count));
}

function distanceBoost(item, mode) {
  if (String(mode || '').toLowerCase() !== 'nearby') return 0;
  const km = Number(item && item.distanceKm || 0);
  if (!km) return 0;
  if (km <= 1) return 30;
  if (km <= 5) return 24;
  if (km <= 20) return 18;
  if (km <= 50) return 10;
  if (km <= 100) return 5;
  return 0;
}

async function decorateFeedWithRecommendationSignals(req, payload) {
  payload = payload || {};
  const users = Array.isArray(payload.users) ? payload.users : [];
  payload.users = users;
  if (!users.length) return payload;

  const mode = String((req.query && req.query.mode) || payload.mode || 'recommend');
  const viewerUid = Number(req.uid || 0);

  const decorated = await mapLimit(users, 5, async (item, index) => {
    item = item || {};
    const uid = Number(item.uid || 0);
    const vip = uid ? await isVip(uid) : false;
    const summary = uid ? await getReviewSummaryFor(uid, viewerUid) : { overall: 0, count: 0 };
    const baseOrder = Math.max(0, users.length - index) * 2;
    const vipBoost = vip ? 25 : 0;
    const rb = reviewBoost(summary);
    const dbs = distanceBoost(item, mode);
    const stableJitter = stableJitterScore(viewerUid, uid, 'review') * 4;
    const score = baseOrder + vipBoost + rb + dbs + stableJitter;

    item.isVip = !!vip;
    item.vipBoost = vipBoost;
    item.reviewScore = summary.overall;
    item.reviewCount = summary.count;
    item.recommendScore = Math.round(score * 100) / 100;
    return item;
  });

  payload.users = decorated.filter(Boolean).sort((a, b) => Number(b.recommendScore || 0) - Number(a.recommendScore || 0));
  return payload;
}


function recMode(req) {
  const raw = String((req && req.query && req.query.mode) || 'recommend').toLowerCase();
  return raw === 'nearby' ? 'nearby' : 'recommend';
}

function recLimit(req) {
  return Math.min(REC_CACHE.maxLimit, Math.max(1, Number(req && req.query && req.query.limit) || 18));
}

function redisReady() {
  return !!(recRedis && typeof recRedis.configured === 'function' && recRedis.configured());
}

function recKey(name, mode, uid) {
  return `peipe:rec:${name}:${mode}:${uid}`;
}

function stableHash(text) {
  text = String(text || '');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function stableJitterScore(viewerUid, targetUid, salt) {
  const bucket = new Date().toISOString().slice(0, 10);
  const n = stableHash(`${viewerUid}:${targetUid}:${salt || ''}:${bucket}`) % 1000;
  return n / 1000;
}

function activityBoost(row) {
  const online = row && row.status === 'online';
  if (online) return 25;
  const last = Number(row && row.lastonline || 0);
  if (!last) return 0;
  const ageMs = Date.now() - last;
  if (ageMs <= 5 * 60 * 1000) return 20;
  if (ageMs <= 30 * 60 * 1000) return 15;
  if (ageMs <= 24 * 60 * 60 * 1000) return 8;
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) return 4;
  if (ageMs > 30 * 24 * 60 * 60 * 1000) return -50;
  return -10;
}

function exposurePenalty(count1m, count10m) {
  count1m = Number(count1m || 0);
  count10m = Number(count10m || 0);
  if (count1m > 30) return 35;
  if (count1m > 15) return 20;
  if (count10m > 80) return 30;
  if (count10m > 50) return 25;
  if (count10m > 20) return 10;
  return 0;
}

async function redisRateLimit(req) {
  if (!redisReady()) return null;
  const uid = Number(req && req.uid || 0);
  if (!uid) return { ok: false, error: 'login-required', message: '请先登录' };
  const key = `peipe:rate:feed:user:${uid}`;
  const n = await recRedis.incrExpire(key, REC_CACHE.rateWindowSec);
  if (n > REC_CACHE.rateMax) {
    return { ok: false, error: 'rate-limit', message: '请求太快，请稍后再试', retryAfter: REC_CACHE.rateWindowSec };
  }
  return null;
}

async function cacheCards(users) {
  if (!redisReady() || !Array.isArray(users) || !users.length) return;
  await Promise.all(users.map((item) => {
    const uid = Number(item && item.uid || 0);
    if (!uid) return null;
    return recRedis.setJson(`peipe:rec:card:${uid}`, item, REC_CACHE.cardTtlSec);
  }));
}

async function getCardsByUids(uids) {
  uids = (uids || []).map(Number).filter(Boolean);
  if (!uids.length) return [];
  const keys = uids.map(uid => `peipe:rec:card:${uid}`);
  const cached = redisReady() ? await recRedis.getManyJson(keys) : keys.map(() => null);
  const byUid = new Map();
  const missing = [];
  cached.forEach((item, index) => {
    const uid = uids[index];
    if (item && Number(item.uid)) byUid.set(Number(item.uid), item);
    else missing.push(uid);
  });

  if (missing.length && partner && typeof partner.getUsersByUids === 'function') {
    const fresh = await partner.getUsersByUids(missing).catch(() => []);
    (fresh || []).forEach((item) => {
      if (item && item.uid) byUid.set(Number(item.uid), item);
    });
    await cacheCards(fresh || []);
  }

  return uids.map(uid => byUid.get(Number(uid))).filter(Boolean);
}

async function refreshActivityFor(users) {
  const ids = (users || []).map(item => Number(item && item.uid)).filter(Boolean);
  if (!ids.length) return users || [];
  const rows = await user.getUsersFields(ids, ['uid', 'status', 'lastonline']).catch(() => []);
  const map = new Map();
  (rows || []).forEach(row => map.set(Number(row.uid), row));
  return (users || []).map((item) => {
    const row = map.get(Number(item.uid));
    if (row) {
      item.status = row.status || item.status || '';
      item.isOnline = row.status === 'online';
      item.lastonline = Number(row.lastonline || item.lastonline || 0) || 0;
      item._onlineBoost = activityBoost(row);
    } else {
      item._onlineBoost = activityBoost(item);
    }
    return item;
  });
}

async function getExposureFor(uids) {
  if (!redisReady() || !uids.length) return new Map();
  const keys = [];
  uids.forEach((uid) => {
    keys.push(`peipe:rec:exposure:1m:${uid}`);
    keys.push(`peipe:rec:exposure:10m:${uid}`);
  });
  const vals = await recRedis.safe(async c => c.mget(keys), keys.map(() => null));
  const map = new Map();
  uids.forEach((uid, index) => {
    map.set(Number(uid), {
      oneMinute: Number(vals[index * 2] || 0) || 0,
      tenMinutes: Number(vals[index * 2 + 1] || 0) || 0,
    });
  });
  return map;
}

async function touchExposure(uids) {
  if (!redisReady()) return;
  await Promise.all((uids || []).map(async (uid) => {
    uid = Number(uid || 0);
    if (!uid) return;
    await recRedis.incrExpire(`peipe:rec:exposure:1m:${uid}`, 60);
    await recRedis.incrExpire(`peipe:rec:exposure:10m:${uid}`, 10 * 60);
  }));
}

function cloneReqForQueue(req, mode) {
  const child = Object.create(req || {});
  child.query = Object.assign({}, req && req.query || {}, { mode, limit: REC_CACHE.queueSize });
  child._peipeInternalQueue = true;
  child._peipeSkipMarkSeen = true;
  return child;
}

async function generateRedisQueue(req, mode) {
  if (!redisReady()) return [];
  const uid = Number(req && req.uid || 0);
  if (!uid) return [];
  const lockKey = recKey('lock', mode, uid);
  const queueKey = recKey('queue', mode, uid);
  const gotLock = await recRedis.setLock(lockKey, 30);
  if (!gotLock) return [];

  const payload = await getSwipeFeed(cloneReqForQueue(req, mode));
  const users = Array.isArray(payload && payload.users) ? payload.users : [];
  const uids = Array.from(new Set(users.map(item => Number(item && item.uid)).filter(Boolean))).slice(0, REC_CACHE.queueSize);
  await recRedis.setJson(queueKey, uids, REC_CACHE.queueTtlSec);
  await cacheCards(users);
  return uids;
}

async function buildRedisFeedPayload(req) {
  if (!redisReady()) return null;
  const uid = Number(req && req.uid || 0);
  if (!uid) return { ok: false, error: 'login-required', message: '请先登录', users: [] };

  const limited = await redisRateLimit(req);
  if (limited) return Object.assign({ users: [] }, limited);

  const mode = recMode(req);
  const limit = recLimit(req);
  const queueKey = recKey('queue', mode, uid);
  const shownKey = recKey('shown', mode, uid);

  let queue = await recRedis.getJson(queueKey, null);
  let hadQueue = Array.isArray(queue) && queue.length > 0;
  if (!hadQueue) {
    queue = await generateRedisQueue(req, mode);
    hadQueue = Array.isArray(queue) && queue.length > 0;
  }
  if (!Array.isArray(queue) || !queue.length) return null;

  const shown = await recRedis.getSet(shownKey);
  const candidates = [];
  const seenCandidate = new Set();
  const pushCandidate = (targetUid) => {
    targetUid = Number(targetUid || 0);
    if (!targetUid || targetUid === uid) return;
    if (shown.has(String(targetUid))) return;
    if (seenCandidate.has(targetUid)) return;
    seenCandidate.add(targetUid);
    candidates.push(targetUid);
  };

  for (let i = 0; i < queue.length && candidates.length < REC_CACHE.rerankWindow; i += 1) {
    pushCandidate(queue[i]);
  }

  if (candidates.length < limit) {
    const freshQueue = await generateRedisQueue(req, mode);
    if (freshQueue && freshQueue.length) {
      freshQueue.forEach((targetUid) => {
        if (candidates.length < REC_CACHE.rerankWindow) pushCandidate(targetUid);
      });
    }
  }

  if (!candidates.length) {
    // 稳定推荐队列版：队列存在但本会话已展示完时，不再回退旧实时 feed，避免又返回同一批人。
    // 前端可根据 exhausted/hasMore=false 展示“今天推荐看得差不多了”。
    return { ok: true, users: [], hasMore: false, exhausted: true, mode, limit, source: 'redis-cache' };
  }
  let users = await getCardsByUids(candidates.slice(0, REC_CACHE.rerankWindow));
  users = await refreshActivityFor(users);
  const exposure = await getExposureFor(users.map(item => Number(item.uid)));
  const order = new Map();
  candidates.forEach((candidateUid, index) => order.set(Number(candidateUid), index));

  users.forEach((item) => {
    const uidNum = Number(item.uid || 0);
    const exp = exposure.get(uidNum) || {};
    const queueOrderScore = Math.max(0, REC_CACHE.rerankWindow - (order.get(uidNum) || 0));
    const online = Number(item._onlineBoost || 0);
    const fatigue = exposurePenalty(exp.oneMinute, exp.tenMinutes);
    const jitter = stableJitterScore(req.uid, uidNum, mode) * 3;
    item.recommendScore = Math.round((queueOrderScore + online - fatigue + jitter) * 100) / 100;
    delete item._onlineBoost;
  });

  users = users.sort((a, b) => Number(b.recommendScore || 0) - Number(a.recommendScore || 0)).slice(0, limit);
  const selectedUids = users.map(item => String(item.uid)).filter(Boolean);
  if (selectedUids.length) {
    await recRedis.addShown(shownKey, selectedUids, REC_CACHE.shownTtlSec);
    await touchExposure(selectedUids);
  }

  return { ok: true, users, hasMore: candidates.length > limit, mode, limit, source: 'redis-cache' };
}

async function buildFeedPayload(req) {
  const cached = await buildRedisFeedPayload(req).catch((err) => {
    console.error('[peipe-rec-cache] fallback:', err.message);
    return null;
  });
  if (cached) {
    if (cached.ok === false) return cached;
    let payload = await decorateFeedWithDistance(req, cached);
    payload = await decorateFeedWithRecommendationSignals(req, payload);
    return payload;
  }

  let payload = await getSwipeFeed(req);
  payload = await decorateFeedWithDistance(req, payload);
  payload = await decorateFeedWithRecommendationSignals(req, payload);
  return payload;
}

async function listCommentsForTarget(targetUid, viewerUid, limit) {
  if (!partnerReviews || typeof partnerReviews.listForTarget !== 'function') {
    return { ok: true, comments: [], reviews: [], summary: { count: 0, overall: 0 }, canReview: { eligible: false, reason: 'comments-unavailable' } };
  }
  return partnerReviews.listForTarget(targetUid, viewerUid, limit).catch(err => ({ ok: false, error: (err && err.message) || 'comments-load-failed', comments: [], reviews: [] }));
}

async function commentEligibility(viewerUid, targetUid) {
  if (!partnerReviews || typeof partnerReviews.eligibility !== 'function') return { ok: true, eligible: false, reason: 'comments-unavailable' };
  return partnerReviews.eligibility(viewerUid, targetUid).catch(err => ({ ok: false, eligible: false, error: (err && err.message) || 'comments-eligibility-failed' }));
}

async function upsertComment(req) {
  if (!partnerReviews || typeof partnerReviews.upsert !== 'function') return { ok: false, error: 'comments-unavailable' };
  return partnerReviews.upsert(req).catch(err => ({ ok: false, error: (err && err.message) || 'comments-save-failed' }));
}

async function updateComment(req) {
  if (!partnerReviews || typeof partnerReviews.update !== 'function') return { ok: false, error: 'comments-unavailable' };
  return partnerReviews.update(req).catch(err => ({ ok: false, error: (err && err.message) || 'comments-update-failed' }));
}

async function removeComment(req) {
  if (!partnerReviews || typeof partnerReviews.remove !== 'function') return { ok: false, error: 'comments-unavailable' };
  return partnerReviews.remove(req).catch(err => ({ ok: false, error: (err && err.message) || 'comments-remove-failed' }));
}

function withParamUid(req, uid, source) {
  req.body = Object.assign({}, req.body || {}, { uid, targetUid: uid, source: source || (req.body && req.body.source) || '' });
  return req;
}

function registerJsonRoutes(router, middleware) {
  API_PREFIXES.forEach((apiPrefix) => {
    router.get(`${apiPrefix}/options`, asyncRoute(async (req, res) => {
      json(res, await getSwipeOptions(req));
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

    router.post(`${apiPrefix}/profile/:uid/greet`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await sendPrivateGreeting(withParamUid(req, req.params.uid, 'profile')));
    }));

    router.post(`${apiPrefix}/me/chat-route`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await prepareWukongChatRoute(req));
    }));

    router.get(`${apiPrefix}/swipe/feed`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await buildFeedPayload(req));
    }));

    router.get(`${apiPrefix}/swipe/tags`, asyncRoute(async (req, res) => {
      json(res, await getSwipeTags(req));
    }));

    router.get(`${apiPrefix}/swipe/me`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await getSwipeMe(req.uid));
    }));

    router.put(`${apiPrefix}/swipe/me`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await saveSwipeMe(req.uid, req.body || {}));
    }));

    router.get(`${apiPrefix}/comments/:uid`, asyncRoute(async (req, res) => {
      json(res, await listCommentsForTarget(req.params.uid, req.uid, req.query.limit));
    }));

    router.get(`${apiPrefix}/profile/:uid/comments`, asyncRoute(async (req, res) => {
      json(res, await listCommentsForTarget(req.params.uid, req.uid, req.query.limit));
    }));

    router.get(`${apiPrefix}/comments/:uid/eligibility`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await commentEligibility(req.uid, req.params.uid));
    }));

    router.post(`${apiPrefix}/comments/:uid`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await upsertComment(req));
    }));

    router.post(`${apiPrefix}/profile/:uid/comments`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await upsertComment(req));
    }));

    router.put(`${apiPrefix}/comments/item/:id`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await updateComment(req));
    }));

    router.delete(`${apiPrefix}/comments/item/:id`, middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
      json(res, await removeComment(req));
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
      apiResponse(helpers, res, await getSwipeOptions(req));
    });

    routeHelpers.setupApiRoute(router, 'put', `${apiRoutePrefix}/location`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await saveLocation(req.uid, req.body || {}));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/me/greet`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await sendPrivateGreeting(req));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/me/wukong-greet`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await sendPrivateGreeting(req));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/profile/:uid/greet`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await sendPrivateGreeting(withParamUid(req, req.params.uid, 'profile')));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/me/chat-route`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await prepareWukongChatRoute(req));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/swipe/feed`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await buildFeedPayload(req));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/swipe/tags`, [], async (req, res) => {
      apiResponse(helpers, res, await getSwipeTags(req));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/swipe/me`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await getSwipeMe(req.uid));
    });

    routeHelpers.setupApiRoute(router, 'put', `${apiRoutePrefix}/swipe/me`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await saveSwipeMe(req.uid, req.body || {}));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/comments/:uid`, [], async (req, res) => {
      apiResponse(helpers, res, await listCommentsForTarget(req.params.uid, req.uid, req.query.limit));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/profile/:uid/comments`, [], async (req, res) => {
      apiResponse(helpers, res, await listCommentsForTarget(req.params.uid, req.uid, req.query.limit));
    });

    routeHelpers.setupApiRoute(router, 'get', `${apiRoutePrefix}/comments/:uid/eligibility`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await commentEligibility(req.uid, req.params.uid));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/comments/:uid`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await upsertComment(req));
    });

    routeHelpers.setupApiRoute(router, 'post', `${apiRoutePrefix}/profile/:uid/comments`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await upsertComment(req));
    });

    routeHelpers.setupApiRoute(router, 'put', `${apiRoutePrefix}/comments/item/:id`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await updateComment(req));
    });

    routeHelpers.setupApiRoute(router, 'delete', `${apiRoutePrefix}/comments/item/:id`, [middleware.ensureLoggedIn], async (req, res) => {
      apiResponse(helpers, res, await removeComment(req));
    });
  });
};

module.exports = plugin;
