'use strict';

const db = require.main.require('./src/database');
const user = require.main.require('./src/user');

const CONFIG = {
  maxCommentLength: 80,
  listLimit: 30,
  floatLimit: 6,
  authorFields: ['uid', 'username', 'userslug', 'picture', 'uploadedpicture'],
  targetFields: ['uid', 'deleted', 'banned'],
};

function now() {
  return Date.now();
}

function cleanText(value, max = CONFIG.maxCommentLength) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function commentKey(id) {
  return `peipePartners:comment:${id}`;
}

function targetKey(targetUid) {
  return `peipePartners:comments:target:${Number(targetUid)}`;
}

function uniqueKey(targetUid, authorUid) {
  return `peipePartners:comments:unique:${Number(targetUid)}:${Number(authorUid)}`;
}

async function nextId() {
  try {
    return await db.incrObjectField('global', 'nextPeipePartnerCommentId');
  } catch (err) {
    return String(now()) + Math.floor(Math.random() * 100000);
  }
}

function isVisible(row) {
  return row && row.status !== 'deleted' && row.status !== 'hidden';
}

function publicComment(row, author) {
  row = row || {};
  author = author || {};
  return {
    id: String(row.id || ''),
    targetUid: Number(row.targetUid || 0),
    authorUid: Number(row.authorUid || 0),
    authorName: String(author.username || row.authorName || 'User'),
    authorSlug: String(author.userslug || row.authorSlug || ''),
    authorAvatar: String(author.picture || author.uploadedpicture || row.authorAvatar || ''),
    content: cleanText(row.content || ''),
    createdAt: Number(row.createdAt || 0),
    updatedAt: Number(row.updatedAt || 0),
    mine: false,
  };
}

async function getTarget(targetUid) {
  targetUid = Number(targetUid || 0);
  if (!targetUid) return null;
  const target = await user.getUserFields(targetUid, CONFIG.targetFields).catch(() => null);
  if (!target || !Number(target.uid) || target.deleted || target.banned) return null;
  return target;
}

async function hydrateComments(rows, viewerUid) {
  rows = (rows || []).filter(isVisible);
  const authorUids = Array.from(new Set(rows.map(row => Number(row.authorUid || 0)).filter(Boolean)));
  let authors = [];
  if (authorUids.length) {
    authors = await user.getUsersFields(authorUids, CONFIG.authorFields).catch(() => []);
  }
  const authorMap = new Map();
  authors.forEach((author, index) => {
    const uid = Number(author && author.uid) || authorUids[index];
    authorMap.set(uid, author || { uid });
  });
  return rows.map((row) => {
    const item = publicComment(row, authorMap.get(Number(row.authorUid)) || {});
    item.mine = Number(viewerUid || 0) === Number(item.authorUid);
    return item;
  });
}

async function getCommentById(id) {
  if (!id) return null;
  const row = await db.getObject(commentKey(id)).catch(() => null);
  return row && row.id ? row : null;
}

async function listForTarget(targetUid, viewerUid, limit) {
  targetUid = Number(targetUid || 0);
  limit = Math.min(Math.max(Number(limit || CONFIG.listLimit), 1), CONFIG.listLimit);
  if (!targetUid) return { ok: false, error: 'invalid-target', comments: [] };
  const ids = await db.getSortedSetRevRange(targetKey(targetUid), 0, limit - 1).catch(() => []);
  const rows = ids.length ? await db.getObjects(ids.map(commentKey)).catch(() => []) : [];
  const comments = await hydrateComments((rows || []).filter(Boolean), viewerUid);
  let viewerComment = null;
  if (viewerUid) {
    const existingId = await db.get(uniqueKey(targetUid, viewerUid)).catch(() => null);
    if (existingId) {
      const existing = await getCommentById(existingId);
      if (existing && existing.status !== 'deleted') {
        const hydrated = await hydrateComments([existing], viewerUid);
        viewerComment = hydrated[0] || null;
      }
    }
  }
  return { ok: true, targetUid, comments, viewerComment };
}

async function floatForTargets(targetUids, limit) {
  const result = new Map();
  targetUids = Array.from(new Set((targetUids || []).map(Number).filter(Boolean)));
  limit = Math.min(Math.max(Number(limit || CONFIG.floatLimit), 1), CONFIG.floatLimit);
  for (const targetUid of targetUids) {
    const ids = await db.getSortedSetRevRange(targetKey(targetUid), 0, limit * 2 - 1).catch(() => []);
    const rows = ids.length ? await db.getObjects(ids.map(commentKey)).catch(() => []) : [];
    const visible = (rows || []).filter(Boolean).filter(isVisible).filter(row => cleanText(row.content || '').length <= CONFIG.maxCommentLength);
    const hydrated = await hydrateComments(visible.slice(0, limit), 0);
    result.set(Number(targetUid), hydrated);
  }
  return result;
}

async function upsert(req) {
  const authorUid = Number(req.uid || 0);
  const targetUid = Number((req.params && req.params.uid) || (req.body && (req.body.targetUid || req.body.uid)) || 0);
  if (!authorUid) return { ok: false, error: 'login-required' };
  if (!targetUid || targetUid === authorUid) return { ok: false, error: 'invalid-target' };
  const target = await getTarget(targetUid);
  if (!target) return { ok: false, error: 'invalid-target' };
  const content = cleanText(req.body && req.body.content, CONFIG.maxCommentLength);
  if (!content || content.length < 2) return { ok: false, error: 'empty-comment' };

  let id = await db.get(uniqueKey(targetUid, authorUid)).catch(() => null);
  const timestamp = now();
  let row = id ? await getCommentById(id) : null;
  if (!row || row.status === 'deleted') {
    id = String(await nextId());
    row = { id, targetUid, authorUid, createdAt: timestamp };
  }

  Object.assign(row, {
    id: String(id),
    targetUid: Number(targetUid),
    authorUid: Number(authorUid),
    content,
    status: 'visible',
    updatedAt: timestamp,
  });

  await db.setObject(commentKey(id), row);
  await db.set(uniqueKey(targetUid, authorUid), String(id));
  await db.sortedSetAdd(targetKey(targetUid), Number(row.createdAt || timestamp), String(id));
  const comments = await hydrateComments([row], authorUid);
  return { ok: true, comment: comments[0] };
}

async function update(req) {
  const uid = Number(req.uid || 0);
  const id = String((req.params && req.params.id) || '');
  if (!uid) return { ok: false, error: 'login-required' };
  const row = await getCommentById(id);
  if (!row || row.status === 'deleted') return { ok: false, error: 'not-found' };
  if (Number(row.authorUid) !== uid) return { ok: false, error: 'no-privileges' };
  const content = cleanText(req.body && req.body.content, CONFIG.maxCommentLength);
  if (!content || content.length < 2) return { ok: false, error: 'empty-comment' };
  row.content = content;
  row.status = 'visible';
  row.updatedAt = now();
  await db.setObject(commentKey(id), row);
  const comments = await hydrateComments([row], uid);
  return { ok: true, comment: comments[0] };
}

async function remove(req) {
  const uid = Number(req.uid || 0);
  const id = String((req.params && req.params.id) || '');
  if (!uid) return { ok: false, error: 'login-required' };
  const row = await getCommentById(id);
  if (!row || row.status === 'deleted') return { ok: true };
  if (Number(row.authorUid) === uid) {
    row.status = 'deleted';
    row.updatedAt = now();
    await db.setObject(commentKey(id), row);
    await db.delete(uniqueKey(row.targetUid, row.authorUid)).catch(() => {});
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
};

