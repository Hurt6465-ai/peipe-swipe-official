'use strict';

const db = require.main.require('./src/database');
const user = require.main.require('./src/user');

const CONFIG = {
  minChatMs: 24 * 60 * 60 * 1000,
  maxCommentLength: 240,
  listLimit: 40,
  metricKeys: ['language', 'reply', 'friendly', 'patient'],
  authorFields: ['uid', 'username', 'userslug', 'picture', 'uploadedpicture'],
  targetFields: ['uid', 'deleted', 'banned'],
};

function now() { return Date.now(); }
function n(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
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
  const out = {};
  CONFIG.metricKeys.forEach((key) => { out[key] = clampRating(input[key]); });
  return out;
}
function overallFromRatings(ratings) {
  const vals = CONFIG.metricKeys.map(k => ratings && ratings[k]).filter(v => Number(v) > 0);
  return average(vals);
}
function commentKey(id) { return `peipePartners:review:${id}`; }
function targetKey(targetUid) { return `peipePartners:reviews:target:${Number(targetUid)}`; }
function uniqueKey(targetUid, authorUid) { return `peipePartners:reviews:unique:${Number(targetUid)}:${Number(authorUid)}`; }
function pairId(a, b) { a = Number(a); b = Number(b); return a < b ? `${a}:${b}` : `${b}:${a}`; }

async function nextId() {
  try { return await db.incrObjectField('global', 'nextPeipePartnerReviewId'); }
  catch (err) { return `${Date.now()}${Math.floor(Math.random() * 100000)}`; }
}
async function getTarget(targetUid) {
  targetUid = Number(targetUid || 0);
  if (!targetUid) return null;
  const target = await user.getUserFields(targetUid, CONFIG.targetFields).catch(() => null);
  if (!target || !Number(target.uid) || target.deleted || target.banned) return null;
  return target;
}
async function getObjectSafe(key) { return await db.getObject(key).catch(() => null); }
async function getSafe(key) { return await db.get(key).catch(() => null); }
async function getScoreSafe(key, member) {
  const score = await db.sortedSetScore(key, String(member)).catch(() => null);
  return n(score);
}

async function getChatTimes(a, b) {
  a = Number(a || 0); b = Number(b || 0);
  if (!a || !b) return { firstAt: 0, lastAt: 0, durationMs: 0 };
  const p = pairId(a, b);
  const candidates = [];

  // Current/expected keys for this plugin family.
  candidates.push(await getObjectSafe(`peipePartners:chat:${p}`));
  candidates.push(await getObjectSafe(`peipePartners:chat:${a}:${b}`));
  candidates.push(await getObjectSafe(`peipePartners:chat:${b}:${a}`));

  const explicitFirst = Math.max(
    n(await getSafe(`peipePartners:chat:first:${p}`)),
    n(await getSafe(`peipePartners:chat:first:${a}:${b}`)),
    n(await getSafe(`peipePartners:chat:first:${b}:${a}`))
  );
  const explicitLast = Math.max(
    n(await getSafe(`peipePartners:chat:last:${p}`)),
    n(await getSafe(`peipePartners:chat:last:${a}:${b}`)),
    n(await getSafe(`peipePartners:chat:last:${b}:${a}`))
  );

  let firstAt = explicitFirst || 0;
  let lastAt = explicitLast || 0;
  for (const row of candidates) {
    if (!row) continue;
    const f = n(row.firstAt || row.firstMessageAt || row.createdAt || row.startAt || row.startedAt);
    const l = n(row.lastAt || row.lastMessageAt || row.updatedAt || row.lastChatAt || row.lastSeenAt);
    if (f && (!firstAt || f < firstAt)) firstAt = f;
    if (l && l > lastAt) lastAt = l;
  }

  // Compatibility with older markChatted-style sorted sets: this only proves contact, not 24h duration.
  const lastScore = Math.max(
    n(await getScoreSafe(`peipePartners:chatted:${a}`, b)),
    n(await getScoreSafe(`peipePartners:chatted:${b}`, a)),
    n(await getScoreSafe(`peipe:partners:chatted:${a}`, b)),
    n(await getScoreSafe(`peipe:partners:chatted:${b}`, a))
  );
  if (lastScore > lastAt) lastAt = lastScore;
  if (!firstAt && lastScore) firstAt = lastScore;

  const durationMs = firstAt && lastAt ? Math.max(0, lastAt - firstAt) : 0;
  return { firstAt, lastAt, durationMs };
}

async function eligibility(authorUid, targetUid) {
  authorUid = Number(authorUid || 0); targetUid = Number(targetUid || 0);
  if (!authorUid) return { ok: false, eligible: false, reason: 'login-required' };
  if (!targetUid || targetUid === authorUid) return { ok: false, eligible: false, reason: 'invalid-target' };
  const target = await getTarget(targetUid);
  if (!target) return { ok: false, eligible: false, reason: 'invalid-target' };
  const chat = await getChatTimes(authorUid, targetUid);
  const eligible = chat.durationMs >= CONFIG.minChatMs;
  return Object.assign({ ok: true, eligible, minChatHours: 24 }, chat, eligible ? {} : { reason: 'chat-under-24h' });
}

function isVisible(row) { return row && row.status !== 'deleted' && row.status !== 'hidden'; }
function parseRatings(row) {
  if (!row) return normalizeRatings({});
  if (row.ratings && typeof row.ratings === 'object') return normalizeRatings(row.ratings);
  try { return normalizeRatings(JSON.parse(row.ratings || '{}')); }
  catch (err) { return normalizeRatings({}); }
}
function publicReview(row, author, viewerUid) {
  row = row || {}; author = author || {};
  const ratings = parseRatings(row);
  const anonymous = row.anonymous === true || row.anonymous === 'true' || row.anonymous === 1 || row.anonymous === '1';
  return {
    id: String(row.id || ''),
    targetUid: Number(row.targetUid || 0),
    authorUid: anonymous ? 0 : Number(row.authorUid || 0),
    authorName: anonymous ? '匿名用户' : String(author.username || row.authorName || 'User'),
    authorSlug: anonymous ? '' : String(author.userslug || row.authorSlug || ''),
    authorAvatar: anonymous ? '' : String(author.picture || author.uploadedpicture || row.authorAvatar || ''),
    content: cleanText(row.content || ''),
    ratings,
    overall: clampRating(row.overall || overallFromRatings(ratings)),
    anonymous,
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    mine: Number(viewerUid || 0) === Number(row.authorUid || 0),
  };
}
async function hydrateReviews(rows, viewerUid) {
  rows = (rows || []).filter(isVisible);
  const authorUids = Array.from(new Set(rows.map(row => Number(row.authorUid || 0)).filter(Boolean)));
  const authors = authorUids.length ? await user.getUsersFields(authorUids, CONFIG.authorFields).catch(() => []) : [];
  const map = new Map();
  authors.forEach((author, i) => map.set(Number(author && author.uid) || authorUids[i], author || {}));
  return rows.map(row => publicReview(row, map.get(Number(row.authorUid)) || {}, viewerUid));
}
function buildSummary(reviews) {
  reviews = reviews || [];
  const visible = reviews.filter(item => item && item.overall > 0);
  const count = visible.length;
  const summary = {
    count,
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
  const row = await db.getObject(commentKey(id)).catch(() => null);
  return row && row.id ? row : null;
}
async function listForTarget(targetUid, viewerUid, limit) {
  targetUid = Number(targetUid || 0);
  limit = Math.min(Math.max(Number(limit || CONFIG.listLimit), 1), CONFIG.listLimit);
  if (!targetUid) return { ok: false, error: 'invalid-target', comments: [], reviews: [], summary: buildSummary([]) };
  const ids = await db.getSortedSetRevRange(targetKey(targetUid), 0, limit - 1).catch(() => []);
  const rows = ids.length ? await db.getObjects(ids.map(commentKey)).catch(() => []) : [];
  const reviews = await hydrateReviews((rows || []).filter(Boolean), viewerUid);
  let viewerComment = null;
  if (viewerUid) {
    const existingId = await db.get(uniqueKey(targetUid, viewerUid)).catch(() => null);
    const existing = existingId ? await getReviewById(existingId) : null;
    if (existing && existing.status !== 'deleted') {
      const hydrated = await hydrateReviews([existing], viewerUid);
      viewerComment = hydrated[0] || null;
    }
  }
  const canReview = viewerUid ? await eligibility(viewerUid, targetUid) : { ok: false, eligible: false, reason: 'login-required' };
  return { ok: true, targetUid, comments: reviews, reviews, viewerComment, summary: buildSummary(reviews), canReview };
}
async function floatForTargets() { return new Map(); }

async function upsert(req) {
  const authorUid = Number(req.uid || 0);
  const targetUid = Number((req.params && req.params.uid) || (req.body && (req.body.targetUid || req.body.uid)) || 0);
  const can = await eligibility(authorUid, targetUid);
  if (!can.eligible) return Object.assign({ ok: false, error: can.reason || 'not-eligible' }, can);
  const content = cleanText(req.body && req.body.content, CONFIG.maxCommentLength);
  const ratings = normalizeRatings(req.body && req.body.ratings);
  const overall = overallFromRatings(ratings);
  const anonymous = !!(req.body && req.body.anonymous);
  if (overall <= 0) return { ok: false, error: 'rating-required' };
  if (!content || content.length < 2) return { ok: false, error: 'empty-comment' };

  let id = await db.get(uniqueKey(targetUid, authorUid)).catch(() => null);
  const timestamp = now();
  let row = id ? await getReviewById(id) : null;
  if (!row || row.status === 'deleted') {
    id = String(await nextId());
    row = { id, targetUid, authorUid, createdAt: timestamp };
  }
  Object.assign(row, {
    id: String(id), targetUid: Number(targetUid), authorUid: Number(authorUid),
    content, ratings: JSON.stringify(ratings), overall, anonymous: anonymous ? 'true' : 'false',
    status: 'visible', updatedAt: timestamp,
  });
  await db.setObject(commentKey(id), row);
  await db.set(uniqueKey(targetUid, authorUid), String(id));
  await db.sortedSetAdd(targetKey(targetUid), Number(row.createdAt || timestamp), String(id));
  const reviews = await hydrateReviews([row], authorUid);
  return { ok: true, comment: reviews[0], review: reviews[0], canReview: can };
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
    row.status = 'deleted'; row.updatedAt = now();
    await db.setObject(commentKey(id), row);
    await db.delete(uniqueKey(row.targetUid, row.authorUid)).catch(() => {});
    return { ok: true, deleted: true };
  }
  if (Number(row.targetUid) === uid) {
    row.status = 'hidden'; row.updatedAt = now();
    await db.setObject(commentKey(id), row);
    return { ok: true, hidden: true };
  }
  return { ok: false, error: 'no-privileges' };
}

module.exports = { listForTarget, floatForTargets, upsert, update, remove, eligibility };
