/**
 * Cloudflare Pages Functions fallback (`/api/leaderboard`).
 * Used automatically if the project is deployed via Cloudflare Pages instead of Cloudflare Workers (`wrangler.jsonc`).
 * Supports optional `LEADERBOARD_KV` namespace binding + Cloudflare Edge Cache API persistence.
 */
const MAX_VALID_SCORE = 5_000_000;
const KV_KEY = 'endless_leaderboard_v1';
const CACHE_URL = 'https://leaderboard.nailong.internal/endless_leaderboard_v1';

let memoryRecords = null;

function sanitizePlayerId(raw) {
  const s = String(raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
  return s.length >= 4 ? s : '';
}

function sanitizeNickname(raw, playerId) {
  const cleaned = String(raw ?? '')
    .replace(/[<>"'`&/\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
  if (cleaned.length > 0) return cleaned;
  const suffix = playerId ? playerId.slice(-4).toUpperCase() : '0001';
  return `干饭家#${suffix}`;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function loadRecords(env) {
  if (env && env.LEADERBOARD_KV) {
    try {
      const data = await env.LEADERBOARD_KV.get(KV_KEY, 'json');
      if (Array.isArray(data)) return data;
    } catch {
      // fall through
    }
  }
  if (typeof caches !== 'undefined' && caches.default) {
    try {
      const cached = await caches.default.match(CACHE_URL);
      if (cached) {
        const data = await cached.json();
        if (Array.isArray(data)) {
          memoryRecords = data;
          return data;
        }
      }
    } catch {
      // fall through
    }
  }
  return Array.isArray(memoryRecords) ? memoryRecords : [];
}

async function saveRecords(env, records) {
  memoryRecords = records;
  if (env && env.LEADERBOARD_KV) {
    try {
      await env.LEADERBOARD_KV.put(KV_KEY, JSON.stringify(records));
    } catch {
      // ignore
    }
  }
  if (typeof caches !== 'undefined' && caches.default) {
    try {
      const resp = new Response(JSON.stringify(records), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
      await caches.default.put(CACHE_URL, resp);
    } catch {
      // ignore
    }
  }
}

function buildSnapshot(records, playerId) {
  const valid = records
    .filter((r) => r && r.score > 0)
    .sort((a, b) => b.score - a.score || a.updatedAt - b.updatedAt);

  let playerRank = null;
  if (playerId) {
    const idx = valid.findIndex((r) => r.playerId === playerId);
    if (idx >= 0) playerRank = idx + 1;
  }

  const entries = valid.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    playerId: r.playerId,
    nickname: r.nickname,
    score: r.score,
    updatedAt: r.updatedAt,
  }));

  return {
    ok: true,
    topScore: entries[0]?.score ?? 0,
    championName: entries[0]?.nickname ?? '虚位以待',
    totalPlayers: valid.length,
    playerRank,
    entries,
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  const url = new URL(request.url);
  if (request.method === 'GET') {
    const pid = sanitizePlayerId(url.searchParams.get('playerId'));
    const records = await loadRecords(env);
    return jsonResponse(buildSnapshot(records, pid));
  }

  if (request.method === 'POST') {
    let body = {};
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
    }

    const playerId = sanitizePlayerId(body.playerId);
    if (!playerId) {
      return jsonResponse({ ok: false, error: 'Invalid playerId' }, 400);
    }

    const rawScore = Number(body.score ?? 0);
    const score = Number.isFinite(rawScore)
      ? Math.max(0, Math.min(MAX_VALID_SCORE, Math.floor(rawScore)))
      : 0;
    const hasCustomNick = String(body.nickname ?? '').trim().length > 0;
    const nickname = sanitizeNickname(body.nickname, playerId);
    const now = Date.now();

    const records = await loadRecords(env);
    const idx = records.findIndex((r) => r.playerId === playerId);
    if (idx === -1) {
      if (score > 0) {
        records.push({ playerId, nickname, score, updatedAt: now });
      }
    } else {
      const prev = records[idx];
      if (score > prev.score) {
        prev.score = score;
        prev.updatedAt = now;
      }
      if (hasCustomNick || !prev.nickname) {
        prev.nickname = nickname;
      }
    }
    records.sort((a, b) => b.score - a.score || a.updatedAt - b.updatedAt);
    await saveRecords(env, records.slice(0, 500));
    return jsonResponse(buildSnapshot(records, playerId));
  }

  return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
}
