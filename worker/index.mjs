import { DurableObject } from 'cloudflare:workers';

const MAX_VALID_SCORE = 5_000_000;

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

export class LeaderboardDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS endless_scores (
          player_id TEXT PRIMARY KEY,
          nickname TEXT NOT NULL,
          score INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_endless_score_desc
        ON endless_scores (score DESC, updated_at ASC);
      `);
    });
  }

  buildSnapshot(playerId) {
    const topRows = this.ctx.storage.sql
      .exec(
        `SELECT player_id, nickname, score, updated_at
         FROM endless_scores
         WHERE score > 0
         ORDER BY score DESC, updated_at ASC
         LIMIT 10`
      )
      .toArray();

    const countRow = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) AS cnt FROM endless_scores WHERE score > 0`)
      .one();

    let playerRank = null;
    if (playerId) {
      const meRows = this.ctx.storage.sql
        .exec(`SELECT score, updated_at FROM endless_scores WHERE player_id = ?`, playerId)
        .toArray();
      if (meRows.length > 0 && meRows[0].score > 0) {
        const myScore = meRows[0].score;
        const myTime = meRows[0].updated_at;
        const higherRow = this.ctx.storage.sql
          .exec(
            `SELECT COUNT(*) AS higher
             FROM endless_scores
             WHERE score > ? OR (score = ? AND updated_at < ?)`,
            myScore,
            myScore,
            myTime
          )
          .one();
        playerRank = Number(higherRow.higher ?? 0) + 1;
      }
    }

    const entries = topRows.map((row, idx) => ({
      rank: idx + 1,
      playerId: String(row.player_id),
      nickname: String(row.nickname),
      score: Number(row.score),
      updatedAt: Number(row.updated_at),
    }));

    return {
      ok: true,
      topScore: entries[0]?.score ?? 0,
      championName: entries[0]?.nickname ?? '虚位以待',
      totalPlayers: Number(countRow.cnt ?? 0),
      playerRank,
      entries,
    };
  }

  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return jsonResponse({ ok: true });
    }

    const url = new URL(request.url);
    if (request.method === 'GET') {
      const pid = sanitizePlayerId(url.searchParams.get('playerId'));
      return jsonResponse(this.buildSnapshot(pid));
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

      const existing = this.ctx.storage.sql
        .exec(`SELECT score, nickname FROM endless_scores WHERE player_id = ?`, playerId)
        .toArray();

      if (existing.length === 0) {
        if (score > 0) {
          this.ctx.storage.sql.exec(
            `INSERT INTO endless_scores (player_id, nickname, score, updated_at)
             VALUES (?, ?, ?, ?)`,
            playerId,
            nickname,
            score,
            now
          );
        }
      } else {
        const prevScore = Number(existing[0].score);
        const prevNick = String(existing[0].nickname);
        const nextScore = Math.max(prevScore, score);
        const nextNick = hasCustomNick ? nickname : prevNick || nickname;
        const nextTime = score > prevScore ? now : undefined;
        if (nextTime !== undefined) {
          this.ctx.storage.sql.exec(
            `UPDATE endless_scores
             SET score = ?, nickname = ?, updated_at = ?
             WHERE player_id = ?`,
            nextScore,
            nextNick,
            nextTime,
            playerId
          );
        } else if (nextNick !== prevNick) {
          this.ctx.storage.sql.exec(
            `UPDATE endless_scores
             SET nickname = ?
             WHERE player_id = ?`,
            nextNick,
            playerId
          );
        }
      }

      return jsonResponse(this.buildSnapshot(playerId));
    }

    return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/leaderboard') {
      const id = env.LEADERBOARD_DO.idFromName('global-endless-v1');
      const stub = env.LEADERBOARD_DO.get(id);
      return stub.fetch(request);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
