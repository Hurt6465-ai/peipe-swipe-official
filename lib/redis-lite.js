'use strict';

const net = require('net');

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseRedisUrl() {
  const raw = String(process.env.PEIPE_REDIS_URL || '').trim();
  const host = String(process.env.PEIPE_REDIS_HOST || '').trim();
  if (!raw && !host) return null;

  if (raw) {
    try {
      const u = new URL(raw);
      return {
        host: u.hostname || '127.0.0.1',
        port: toInt(u.port || 6379, 6379),
        password: decodeURIComponent(u.password || ''),
        db: toInt((u.pathname || '').replace(/^\//, ''), 0),
      };
    } catch (err) {
      console.error('[peipe-redis] invalid PEIPE_REDIS_URL:', err.message);
      return null;
    }
  }

  return {
    host: host || '127.0.0.1',
    port: toInt(process.env.PEIPE_REDIS_PORT || 6379, 6379),
    password: String(process.env.PEIPE_REDIS_PASSWORD || ''),
    db: toInt(process.env.PEIPE_REDIS_DB || 2, 2),
  };
}

function encodeCommand(args) {
  const parts = [`*${args.length}\r\n`];
  args.forEach((arg) => {
    if (arg === undefined || arg === null) arg = '';
    const buf = Buffer.isBuffer(arg) ? arg : Buffer.from(String(arg));
    parts.push(`$${buf.length}\r\n`);
    parts.push(buf);
    parts.push('\r\n');
  });
  return Buffer.concat(parts.map(part => Buffer.isBuffer(part) ? part : Buffer.from(part)));
}

function parseLine(buffer, offset) {
  const end = buffer.indexOf('\r\n', offset, 'utf8');
  if (end < 0) return null;
  return { line: buffer.slice(offset, end).toString('utf8'), offset: end + 2 };
}

function parseResp(buffer, offset) {
  if (offset >= buffer.length) return null;
  const prefix = String.fromCharCode(buffer[offset]);
  const line = parseLine(buffer, offset + 1);
  if (!line) return null;

  if (prefix === '+') return { value: line.line, offset: line.offset };
  if (prefix === '-') {
    const err = new Error(line.line || 'redis-error');
    err.redis = true;
    return { error: err, offset: line.offset };
  }
  if (prefix === ':') return { value: Number(line.line), offset: line.offset };

  if (prefix === '$') {
    const len = Number(line.line);
    if (len < 0) return { value: null, offset: line.offset };
    const end = line.offset + len;
    if (buffer.length < end + 2) return null;
    return { value: buffer.slice(line.offset, end).toString('utf8'), offset: end + 2 };
  }

  if (prefix === '*') {
    const count = Number(line.line);
    if (count < 0) return { value: null, offset: line.offset };
    const arr = [];
    let pos = line.offset;
    for (let i = 0; i < count; i += 1) {
      const parsed = parseResp(buffer, pos);
      if (!parsed) return null;
      if (parsed.error) return parsed;
      arr.push(parsed.value);
      pos = parsed.offset;
    }
    return { value: arr, offset: pos };
  }

  const err = new Error(`unsupported-redis-response:${prefix}`);
  err.redis = true;
  return { error: err, offset: line.offset };
}

class RedisLite {
  constructor(config) {
    this.config = config;
    this.socket = null;
    this.connecting = null;
    this.ready = false;
    this.authed = false;
    this.selected = false;
    this.buffer = Buffer.alloc(0);
    this.pending = [];
  }

  enabled() {
    return !!this.config;
  }

  async connect() {
    if (!this.config) throw new Error('peipe-redis-not-configured');
    if (this.ready && this.socket && !this.socket.destroyed) return;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: this.config.host, port: this.config.port });
      let done = false;
      const finish = (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err); else resolve();
      };
      const timer = setTimeout(() => {
        socket.destroy(new Error('peipe-redis-connect-timeout'));
      }, 2500);
      socket.once('connect', () => {
        this.socket = socket;
        this.ready = true;
        this.authed = false;
        this.selected = false;
        finish();
      });
      socket.on('data', data => this.onData(data));
      socket.on('error', (err) => {
        this.failAll(err);
        if (!done) finish(err);
      });
      socket.on('close', () => {
        this.ready = false;
        this.socket = null;
        this.authed = false;
        this.selected = false;
      });
    }).finally(() => {
      this.connecting = null;
    });

    await this.connecting;
    if (this.config.password && !this.authed) {
      await this.send(['AUTH', this.config.password]);
      this.authed = true;
    }
    if (this.config.db && !this.selected) {
      await this.send(['SELECT', this.config.db]);
      this.selected = true;
    }
  }

  onData(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.pending.length) {
      const parsed = parseResp(this.buffer, 0);
      if (!parsed) break;
      this.buffer = this.buffer.slice(parsed.offset);
      const item = this.pending.shift();
      clearTimeout(item.timer);
      if (parsed.error) item.reject(parsed.error); else item.resolve(parsed.value);
    }
  }

  failAll(err) {
    while (this.pending.length) {
      const item = this.pending.shift();
      clearTimeout(item.timer);
      item.reject(err);
    }
  }

  async send(args) {
    await this.connect();
    if (!this.socket || this.socket.destroyed) throw new Error('peipe-redis-socket-closed');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('peipe-redis-command-timeout'));
      }, 2500);
      this.pending.push({ resolve, reject, timer });
      this.socket.write(encodeCommand(args));
    });
  }

  async command(...args) {
    return await this.send(args);
  }

  async get(key) { return await this.command('GET', key); }
  async setex(key, seconds, value) { return await this.command('SETEX', key, seconds, value); }
  async set(key, value, mode, ttlMode, ttl) {
    const args = ['SET', key, value];
    if (mode) args.push(mode);
    if (ttlMode) args.push(ttlMode, ttl);
    return await this.command(...args);
  }
  async del(key) { return await this.command('DEL', key); }
  async sadd(key, values) {
    values = Array.isArray(values) ? values : [values];
    if (!values.length) return 0;
    return await this.command('SADD', key, ...values);
  }
  async smembers(key) { return await this.command('SMEMBERS', key); }
  async expire(key, seconds) { return await this.command('EXPIRE', key, seconds); }
  async incr(key) { return await this.command('INCR', key); }
  async mget(keys) {
    keys = Array.isArray(keys) ? keys : [];
    if (!keys.length) return [];
    return await this.command('MGET', ...keys);
  }
  async ping() { return await this.command('PING'); }
}

let client = null;
function getClient() {
  if (client) return client;
  client = new RedisLite(parseRedisUrl());
  return client;
}

function configured() {
  return !!parseRedisUrl();
}

async function safe(fn, fallback) {
  try {
    const c = getClient();
    if (!c.enabled()) return fallback;
    return await fn(c);
  } catch (err) {
    console.error('[peipe-redis] disabled for this operation:', err.message);
    return fallback;
  }
}

async function getJson(key, fallback) {
  return await safe(async (c) => {
    const raw = await c.get(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (err) { return fallback; }
  }, fallback);
}

async function setJson(key, value, seconds) {
  return await safe(c => c.setex(key, seconds, JSON.stringify(value)), null);
}

async function getManyJson(keys) {
  return await safe(async (c) => {
    const values = await c.mget(keys);
    return (values || []).map((raw) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (err) { return null; }
    });
  }, keys.map(() => null));
}

async function addShown(key, uids, seconds) {
  return await safe(async (c) => {
    await c.sadd(key, uids.map(String));
    await c.expire(key, seconds);
    return true;
  }, false);
}

async function getSet(key) {
  return await safe(async (c) => {
    const vals = await c.smembers(key);
    return new Set((vals || []).map(String));
  }, new Set());
}

async function incrExpire(key, seconds) {
  return await safe(async (c) => {
    const n = await c.incr(key);
    if (Number(n) === 1) await c.expire(key, seconds);
    return Number(n) || 0;
  }, 0);
}

async function setLock(key, seconds) {
  return await safe(async (c) => {
    const ret = await c.set(key, '1', 'NX', 'EX', seconds);
    return String(ret || '').toUpperCase() === 'OK';
  }, false);
}

module.exports = {
  configured,
  safe,
  getJson,
  setJson,
  getManyJson,
  addShown,
  getSet,
  incrExpire,
  setLock,
};
