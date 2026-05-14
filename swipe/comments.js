'use strict';

const db = require.main.require('./src/database');
const user = require.main.require('./src/user');

const CONFIG = {
  minChatMs: 24 * 60 * 60 * 1000,
  maxCommentLength: 240,
  listLimit: 40,
  metricKeys: ['language', 'reply', 'friendly', 'patient'],
  reasonTexts: {
    'login-required': '请先登录后评价',
    'invalid-target': '这个用户暂时不能评价',
    'chat-under-24h': '聊天超过 24 小时后才能评价',
    'rating-required': '请先选择 1-5 星评分',
    'empty-comment': '请至少写 2 个字',
    'no-privileges': '没有权限操作这条评价',
    'not-found': '评价不存在'
  },
  authorFields: ['uid', 'username', 'userslug', 'picture', 'uploadedpicture'],
  targetFields: ['uid', 'deleted', 'banned'],
};

function now() {
  return Date.now();
}

function n(v) {
  const x = Number(v || 0);
  return Number.isFinite(x) ? x : 0;
}

function cleanText(value, max = CONFIG.maxCommentLength) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function average(arr) {
  const nums = (arr || []).map(Number).filter(v => Number.isFinite(v) && v > 0);
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function clampRating(v) {
  const x = Math.round(Number(v || 0) * 2) / 2;
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(5, x));
}

function normalizeRatings(input) {
  input = input || {};

  if (typeof input === 'number' || typeof input === 'string') {
    const rating = clampRating(input);
    const out = {};
    CONFIG.metricKeys.forEach((key) => {
      out[key] = rating;
    });
    return out;
  }

  const fallback = clampRating(input.overall || input.rating || input.star || input.stars);
  const out = {};
  CONFIG.metricKeys.forEach((key) => {
    out[key] = clampRating(input[key] || fallback);
  });
  return out;
}

function overallFromRatings(ratings) {
  const vals = CONFIG.metricKeys.map(k => ratings && ratings[k]).filter(v => Number(v) > 0);
  return average(vals);
}

function commentKey(id) {
  return `peipePartners:review:${id}`;
}

function targetKey(targetUid) {
  return `peipePartners:reviews:target:${Number(targetUid)}`;
}

function uniqueKey(targetUid, authorUid) {
  return `peipePartners:reviews:unique:${Number(targetUid)}:${Number(authorUid)}`;
}

function pairId(a, b) {
  a = Number(a);
  b = Number(b);
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

async function safe(promise, fallback = null) {
  try {
    const value = await promise;
    return value == null ? fallback : value;
  } catch (err) {
    return fallback;
  }
}

async function nextId() {
  const id = await safe(db.incrObjectField('global', 'nextPeipePartnerReviewId'), null);
  return id || `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

async function getTarget(targetUid) {
  targetUid = Number(targetUid || 0);
  if (!targetUid) return null;

  const target = await safe(user.getUserFields(targetUid, CONFIG.targetFields), null);
  if (!target || !Number(target.uid) || target.deleted || target.banned) return null;

  return target;
}

async function getChatTimes(a, b) {
  a = Number(a || 0);
  b = Number(b || 0);
  if (!a || !b) return { firstAt: 0, lastAt: 0, durationMs: 0 };

  const p = pairId(a, b);

  const [
    chatPair,
    chatAB,
    chatBA,
    firstPair,
    firstAB,
    firstBA,
    lastPair,
    lastAB,
    lastBA,
    scoreAB1,
    scoreBA1,
    scoreAB2,
    scoreBA2,
  ] = await Promise.all([
    safe(db.getObject(`peipePartners:chat:${p}`), null),
    safe(db.getObject(`peipePartners:chat:${a}:${b}`), null),
    safe(db.getObject(`peipePartners:chat:${b}:${a}`), null),

    safe(db.get(`peipePartners:chat:first:${p}`), 0),
    safe(db.get(`peipePartners:chat:first:${a}:${b}`), 0),
    safe(db.get(`peipePartners:chat:first:${b}:${a}`), 0),

    safe(db.get(`peipePartners:chat:last:${p}`), 0),
    safe(db.get(`peipePartners:chat:last:${a}:${b}`), 0),
    safe(db.get(`peipePartners:chat:last:${b}:${a}`), 0),

    safe(db.sortedSetScore(`peipePartners:chatted:${a}`, String(b)), 0),
    safe(db.sortedSetScore(`peipePartners:chatted:${b}`, String(a)), 0),
    safe(db.sortedSetScore(`peipe:partners:chatted:${a}`, String(b)), 0),
    safe(db.sortedSetScore(`peipe:partners:chatted:${b}`, String(a)), 0),
  ]);

  let firstAt = Math.max(n(firstPair), n(firstAB), n(firstBA));
  let lastAt = Math.max(n(lastPair), n(lastAB), n(lastBA));

  [chatPair, chatAB, chatBA].forEach((row) => {
    if (!row) return;

    const first = n(row.firstAt || row.firstMessageAt || row.createdAt || row.startAt || row.startedAt);
    const last = n(row.lastAt || row.lastMessageAt || row.updatedAt || row.lastChatAt || row.lastSeenAt);

    if (first && (!firstAt || first < firstAt)) firstAt = first;
    if (last && last > lastAt) lastAt = last;
  });

  const lastScore = Math.max(n(scoreAB1), n(scoreBA1), n(scoreAB2), n(scoreBA2));
  if (lastScore > lastAt) lastAt = lastScore;
  if (!firstAt && lastScore) firstAt = lastScore;

  const durationMs = firstAt && lastAt ? Math.max(0, lastAt - firstAt) : 0;
  return { firstAt, lastAt, durationMs };
}


function reasonText(reason) {
  return CONFIG.reasonTexts[reason] || reason || '';
}

function decorateEligibility(result) {
  result = result || {};
  const durationMs = n(result.durationMs);
  const remainingMs = Math.max(0, CONFIG.minChatMs - durationMs);
  return Object.assign({ reasonText: reasonText(result.reason) }, result, { remainingMs });
}

async function eligibility(authorUid, targetUid) {
  authorUid = Number(authorUid || 0);
  targetUid = Number(targetUid || 0);

  if (!authorUid) {
    return decorateEligibility({ ok: false, eligible: false, reason: 'login-required' });
  }

  if (!targetUid || targetUid === authorUid) {
    return decorateEligibility({ ok: false, eligible: false, reason: 'invalid-target' });
  }

  const [target, chat] = await Promise.all([
    getTarget(targetUid),
    getChatTimes(authorUid, targetUid),
  ]);

  if (!target) {
    return decorateEligibility({ ok: false, eligible: false, reason: 'invalid-target' });
  }

  const eligible = chat.durationMs >= CONFIG.minChatMs;

  return decorateEligibility(Object.assign(
    { ok: true, eligible, minChatHours: 24 },
    chat,
    eligible ? {} : { reason: 'chat-under-24h' }
  ));
}

function isVisible(row) {
  return row && row.status !== 'deleted' && row.status !== 'hidden';
}

function parseRatings(row) {
  if (!row) return normalizeRatings({});

  if (row.ratings && typeof row.ratings === 'object') {
    return normalizeRatings(row.ratings);
  }

  try {
    return normalizeRatings(JSON.parse(row.ratings || '{}'));
  } catch (err) {
    return normalizeRatings({});
  }
}

function isAnonymous(row) {
  return row && (
    row.anonymous === true ||
    row.anonymous === 'true' ||
    row.anonymous === 1 ||
    row.anonymous === '1'
  );
}

function publicReview(row, author, viewerUid) {
  row = row || {};
  author = author || {};

  const ratings = parseRatings(row);
  const anonymous = isAnonymous(row);
  const mine = Number(viewerUid || 0) === Number(row.authorUid || 0);
  const hideAuthor = anonymous && !mine;

  return {
    id: String(row.id || ''),
    targetUid: Number(row.targetUid || 0),
    authorUid: hideAuthor ? 0 : Number(row.authorUid || 0),
    authorName: hideAuthor ? '匿名用户' : String(author.username || row.authorName || 'User'),
    authorSlug: hideAuthor ? '' : String(author.userslug || row.authorSlug || ''),
    authorAvatar: hideAuthor ? '' : String(author.picture || author.uploadedpicture || row.authorAvatar || ''),
    content: cleanText(row.content || ''),
    ratings,
    overall: clampRating(row.overall || overallFromRatings(ratings)),
    anonymous,
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    mine,
  };
}

async function hydrateReviews(rows, viewerUid) {
  rows = (rows || []).filter(isVisible);

  const authorUids = Array.from(new Set(
    rows
      .filter(row => !isAnonymous(row) || Number(row.authorUid || 0) === Number(viewerUid || 0))
      .map(row => Number(row.authorUid || 0))
      .filter(Boolean)
  ));

  const authors = authorUids.length
    ? await safe(user.getUsersFields(authorUids, CONFIG.authorFields), [])
    : [];

  const map = new Map();
  (authors || []).forEach((author, i) => {
    map.set(Number(author && author.uid) || authorUids[i], author || {});
  });

  return rows.map(row => publicReview(row, map.get(Number(row.authorUid)) || {}, viewerUid));
}

function buildSummary(reviews) {
  reviews = reviews || [];

  const visible = reviews.filter(item => item && item.overall > 0);
  const summary = {
    count: visible.length,
    overall: average(visible.map(item => item.overall)),
    metrics: {},
  };

  CONFIG.metricKeys.forEach((key) => {
    const vals = visible.map(item => item.ratings && item.ratings[key]).filter(v => Number(v) > 0);
    summary.metrics[key] = { avg: average(vals), count: vals.length };
  });

  return summary;
}

async function getReviewById(id) {
  if (!id) return null;

  const row = await safe(db.getObject(commentKey(id)), null);
  return row && row.id ? row : null;
}

async function listForTarget(targetUid, viewerUid, limit) {
  targetUid = Number(targetUid || 0);
  viewerUid = Number(viewerUid || 0);
  limit = Math.min(Math.max(Number(limit || CONFIG.listLimit), 1), CONFIG.listLimit);

  if (!targetUid) {
    return {
      ok: false,
      error: 'invalid-target',
      comments: [],
      reviews: [],
      viewerComment: null,
      summary: buildSummary([]),
      canReview: decorateEligibility({ ok: false, eligible: false, reason: 'invalid-target' }),
    };
  }

  const ids = await safe(db.getSortedSetRevRange(targetKey(targetUid), 0, limit - 1), []);
  const rowsPromise = ids.length ? safe(db.getObjects(ids.map(commentKey)), []) : Promise.resolve([]);

  const existingIdPromise = viewerUid
    ? safe(db.get(uniqueKey(targetUid, viewerUid)), null)
    : Promise.resolve(null);

  const canReviewPromise = viewerUid
    ? eligibility(viewerUid, targetUid)
    : Promise.resolve(decorateEligibility({ ok: false, eligible: false, reason: 'login-required' }));

  const [rows, existingId, canReview] = await Promise.all([
    rowsPromise,
    existingIdPromise,
    canReviewPromise,
  ]);

  const visibleRows = (rows || []).filter(Boolean);
  const reviews = await hydrateReviews(visibleRows, viewerUid);

  let viewerComment = null;
  if (existingId) {
    const existing = await getReviewById(existingId);
    if (existing && existing.status !== 'deleted') {
      const hydrated = await hydrateReviews([existing], viewerUid);
      viewerComment = hydrated[0] || null;
    }
  }

  return {
    ok: true,
    targetUid,
    comments: reviews,
    reviews,
    viewerComment,
    summary: buildSummary(reviews),
    canReview,
  };
}

/*
 * Keep this intentionally fast.
 * Full-screen swipe feed calls this for many users. Returning an empty Map avoids
 * extra DB reads during first card load. Review details still load through
 * listForTarget().
 */
function floatForTargets() {
  return Promise.resolve(new Map());
}

async function upsert(req) {
  const authorUid = Number(req.uid || 0);
  const targetUid = Number(
    (req.params && req.params.uid) ||
    (req.body && (req.body.targetUid || req.body.uid)) ||
    0
  );

  const can = await eligibility(authorUid, targetUid);
  if (!can.eligible) {
    return Object.assign({ ok: false, error: can.reason || 'not-eligible', message: can.reasonText || reasonText(can.reason) }, can);
  }

  const content = cleanText(req.body && req.body.content, CONFIG.maxCommentLength);
  const rawRating = req.body && (req.body.ratings || req.body.overall || req.body.rating || req.body.stars);
  const ratings = normalizeRatings(rawRating);
  const overall = overallFromRatings(ratings);
  const anonymous = !!(req.body && req.body.anonymous);

  if (overall <= 0) return { ok: false, error: 'rating-required', message: reasonText('rating-required') };
  if (!content || content.length < 2) return { ok: false, error: 'empty-comment', message: reasonText('empty-comment') };

  let id = await safe(db.get(uniqueKey(targetUid, authorUid)), null);
  const timestamp = now();
  let row = id ? await getReviewById(id) : null;

  if (!row || row.status === 'deleted') {
    id = String(await nextId());
    row = { id, targetUid, authorUid, createdAt: timestamp };
  }

  Object.assign(row, {
    id: String(id),
    targetUid: Number(targetUid),
    authorUid: Number(authorUid),
    content,
    ratings: JSON.stringify(ratings),
    overall,
    anonymous: anonymous ? 'true' : 'false',
    status: 'visible',
    updatedAt: timestamp,
  });

  await Promise.all([
    db.setObject(commentKey(id), row),
    db.set(uniqueKey(targetUid, authorUid), String(id)),
    db.sortedSetAdd(targetKey(targetUid), Number(row.createdAt || timestamp), String(id)),
  ]);

  const reviews = await hydrateReviews([row], authorUid);

  return {
    ok: true,
    comment: reviews[0],
    review: reviews[0],
    canReview: can,
  };
}

async function update(req) {
  const uid = Number(req.uid || 0);
  const id = String((req.params && req.params.id) || '');

  if (!uid) return { ok: false, error: 'login-required' };

  const row = await getReviewById(id);
  if (!row || row.status === 'deleted') return { ok: false, error: 'not-found' };
  if (Number(row.authorUid) !== uid) return { ok: false, error: 'no-privileges' };

  req.params = Object.assign({}, req.params, { uid: row.targetUid });
  return await upsert(req);
}

async function remove(req) {
  const uid = Number(req.uid || 0);
  const id = String((req.params && req.params.id) || '');

  if (!uid) return { ok: false, error: 'login-required' };

  const row = await getReviewById(id);
  if (!row || row.status === 'deleted') return { ok: true };

  if (Number(row.authorUid) === uid) {
    row.status = 'deleted';
    row.updatedAt = now();

    await Promise.all([
      db.setObject(commentKey(id), row),
      safe(db.delete(uniqueKey(row.targetUid, row.authorUid)), null),
    ]);

    return { ok: true, deleted: true };
  }

  if (Number(row.targetUid) === uid) {
    row.status = 'hidden';
    row.updatedAt = now();
    await db.setObject(commentKey(id), row);

    return { ok: true, hidden: true };
  }

  return { ok: false, error: 'no-privileges' };
}

module.exports = {
  listForTarget,
  floatForTargets,
  upsert,
  update,
  remove,
  eligibility,
};
