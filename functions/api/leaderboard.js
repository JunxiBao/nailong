/**
 * Cloudflare Pages Functions fallback (`/api/leaderboard`).
 * Supports:
 * - Top 10 Endless Scores Leaderboard (`type=endless`)
 * - Top 10 Campaign Stars Leaderboard (`type=stars`)
 * - Unique nickname validation & setting (`action=set_nickname`)
 */
const MAX_VALID_SCORE = 5_000_000;
const MAX_VALID_STARS = 150;
const KV_KEY = 'leaderboard_store_v2';
const CACHE_URL = 'https://leaderboard.nailong.internal/leaderboard_store_v2';

let memoryStore = null;

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
  if (cleaned.length >= 2) return cleaned;
  if (cleaned.length === 1) return cleaned;
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

async function loadStore(env) {
  if (env && env.LEADERBOARD_KV) {
    try {
      const data = await env.LEADERBOARD_KV.get(KV_KEY, 'json');
      if (data && typeof data === 'object') return normalizeStore(data);
    } catch {
      // fall through
    }
  }
  if (typeof caches !== 'undefined' && caches.default) {
    try {
      const cached = await caches.default.match(CACHE_URL);
      if (cached) {
        const data = await cached.json();
        if (data && typeof data === 'object') {
          memoryStore = normalizeStore(data);
          return memoryStore;
        }
      }
    } catch {
      // fall through
    }
  }
  if (!memoryStore) {
    memoryStore = { endless: [], stars: [], nicknames: {} };
  }
  return memoryStore;
}

function normalizeStore(raw) {
  if (Array.isArray(raw)) {
    return { endless: raw, stars: [], nicknames: {} };
  }
  return {
    endless: Array.isArray(raw.endless) ? raw.endless : [],
    stars: Array.isArray(raw.stars) ? raw.stars : [],
    nicknames: raw.nicknames && typeof raw.nicknames === 'object' ? raw.nicknames : {},
  };
}

async function saveStore(env, store) {
  memoryStore = store;
  if (env && env.LEADERBOARD_KV) {
    try {
      await env.LEADERBOARD_KV.put(KV_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }
  if (typeof caches !== 'undefined' && caches.default) {
    try {
      const resp = new Response(JSON.stringify(store), {
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

function buildSnapshot(store, playerId, type = 'endless') {
  const isStars = type === 'stars';
  const list = isStars ? store.stars : store.endless;

  const valid = list
    .filter((r) => r && r.score > 0)
    .sort((a, b) => b.score - a.score || a.updatedAt - b.updatedAt);

  let playerRank = null;
  let playerValue = 0;
  if (playerId) {
    const idx = valid.findIndex((r) => r.playerId === playerId);
    if (idx >= 0) {
      playerRank = idx + 1;
      playerValue = valid[idx].score;
    }
  }

  // Strictly TOP 10 only!
  const entries = valid.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    playerId: r.playerId,
    nickname: r.nickname,
    score: r.score,
    updatedAt: r.updatedAt,
  }));

  const top10Threshold = entries.length >= 10 ? entries[9].score : 0;

  return {
    ok: true,
    type: isStars ? 'stars' : 'endless',
    topScore: entries[0]?.score ?? 0,
    championName: entries[0]?.nickname ?? '虚位以待',
    totalPlayers: valid.length, // kept for test compatibility
    playerRank,
    playerValue,
    top10Threshold,
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
    const type = url.searchParams.get('type') === 'stars' ? 'stars' : 'endless';
    const store = await loadStore(env);
    return jsonResponse(buildSnapshot(store, pid, type));
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

    const store = await loadStore(env);
    const now = Date.now();

    // 1. Action: check or set nickname with duplicate check
    if (body.action === 'set_nickname') {
      const rawNick = String(body.nickname ?? '').trim();
      if (rawNick.length < 2 || rawNick.length > 12) {
        return jsonResponse({ ok: false, error: '昵称长度需在 2 到 12 个字符之间！' }, 400);
      }
      const cleaned = sanitizeNickname(rawNick, playerId);
      const lower = cleaned.toLowerCase();

      // Check if another player has already claimed this nickname
      for (const [pId, pNick] of Object.entries(store.nicknames)) {
        if (pId !== playerId && String(pNick).toLowerCase() === lower) {
          return jsonResponse({ ok: false, error: '该昵称已被其他干饭家使用，请换一个吧！' }, 409);
        }
      }

      // Claim nickname
      store.nicknames[playerId] = cleaned;
      // Update nickname in existing endless & stars entries
      for (const r of store.endless) {
        if (r.playerId === playerId) r.nickname = cleaned;
      }
      for (const r of store.stars) {
        if (r.playerId === playerId) r.nickname = cleaned;
      }
      await saveStore(env, store);
      return jsonResponse({ ok: true, nickname: cleaned });
    }

    // 2. Score submission (endless or stars)
    const isStars = body.type === 'stars';
    const rawVal = Number(body.score ?? (isStars ? body.stars : 0));
    const score = Number.isFinite(rawVal)
      ? Math.max(0, Math.min(isStars ? MAX_VALID_STARS : MAX_VALID_SCORE, Math.floor(rawVal)))
      : 0;

    let nickname = store.nicknames[playerId] || '';
    if (body.nickname && String(body.nickname).trim().length > 0) {
      const customClean = sanitizeNickname(body.nickname, playerId);
      const lower = customClean.toLowerCase();
      let conflict = false;
      for (const [pId, pNick] of Object.entries(store.nicknames)) {
        if (pId !== playerId && String(pNick).toLowerCase() === lower) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        nickname = customClean;
        store.nicknames[playerId] = customClean;
      }
    }
    if (!nickname) {
      nickname = sanitizeNickname('', playerId);
      store.nicknames[playerId] = nickname;
    }

    const targetList = isStars ? store.stars : store.endless;
    const idx = targetList.findIndex((r) => r.playerId === playerId);
    if (idx === -1) {
      if (score > 0) {
        targetList.push({ playerId, nickname, score, updatedAt: now });
      }
    } else {
      const prev = targetList[idx];
      if (score > prev.score) {
        prev.score = score;
        prev.updatedAt = now;
      }
      prev.nickname = nickname;
    }
    targetList.sort((a, b) => b.score - a.score || a.updatedAt - b.updatedAt);
    if (isStars) {
      store.stars = targetList.slice(0, 200);
    } else {
      store.endless = targetList.slice(0, 200);
    }

    await saveStore(env, store);
    return jsonResponse(buildSnapshot(store, playerId, isStars ? 'stars' : 'endless'));
  }

  return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
}
