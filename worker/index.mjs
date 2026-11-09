import { DurableObject } from 'cloudflare:workers';

const MAX_VALID_SCORE = 5_000_000;
const MAX_VALID_STARS = 150;

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

        CREATE TABLE IF NOT EXISTS campaign_stars (
          player_id TEXT PRIMARY KEY,
          nickname TEXT NOT NULL,
          stars INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_campaign_stars_desc
        ON campaign_stars (stars DESC, updated_at ASC);

        CREATE TABLE IF NOT EXISTS player_nicknames (
          player_id TEXT PRIMARY KEY,
          nickname TEXT NOT NULL UNIQUE COLLATE NOCASE,
          updated_at INTEGER NOT NULL
        );

        -- Backfill player_nicknames from existing endless_scores
        INSERT OR IGNORE INTO player_nicknames (player_id, nickname, updated_at)
        SELECT player_id, nickname, updated_at
        FROM endless_scores
        WHERE TRIM(nickname) != '';

        -- Backfill campaign_stars for existing endless players so historical users appear on both boards
        INSERT OR IGNORE INTO campaign_stars (player_id, nickname, stars, updated_at)
        SELECT
          player_id,
          nickname,
          MAX(18, MIN(150, CAST(score / 120 AS INT))),
          updated_at
        FROM endless_scores
        WHERE TRIM(nickname) != '' AND score > 0;
      `);
    });
  }

  buildSnapshot(playerId, type = 'endless') {
    const isStars = type === 'stars';
    const tableName = isStars ? 'campaign_stars' : 'endless_scores';
    const valCol = isStars ? 'stars' : 'score';

    const topRows = this.ctx.storage.sql
      .exec(
        `SELECT player_id, nickname, ${valCol} AS val, updated_at
         FROM ${tableName}
         WHERE ${valCol} > 0
         ORDER BY ${valCol} DESC, updated_at ASC
         LIMIT 10`
      )
      .toArray();

    const countRow = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) AS cnt FROM ${tableName} WHERE ${valCol} > 0`)
      .one();

    let playerRank = null;
    let playerValue = 0;
    if (playerId) {
      const meRows = this.ctx.storage.sql
        .exec(`SELECT ${valCol} AS val, updated_at FROM ${tableName} WHERE player_id = ?`, playerId)
        .toArray();
      if (meRows.length > 0 && meRows[0].val > 0) {
        playerValue = Number(meRows[0].val);
        const myTime = meRows[0].updated_at;
        const higherRow = this.ctx.storage.sql
          .exec(
            `SELECT COUNT(*) AS higher
             FROM ${tableName}
             WHERE ${valCol} > ? OR (${valCol} = ? AND updated_at < ?)`,
            playerValue,
            playerValue,
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
      score: Number(row.val),
      updatedAt: Number(row.updated_at),
    }));

    const top10Threshold = entries.length >= 10 ? entries[9].score : 0;

    return {
      ok: true,
      type: isStars ? 'stars' : 'endless',
      topScore: entries[0]?.score ?? 0,
      championName: entries[0]?.nickname ?? '虚位以待',
      totalPlayers: Number(countRow.cnt ?? 0),
      playerRank,
      playerValue,
      top10Threshold,
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
      const type = url.searchParams.get('type') === 'stars' ? 'stars' : 'endless';
      return jsonResponse(this.buildSnapshot(pid, type));
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
      const now = Date.now();

      // 1. Action: set_nickname with duplicate check
      if (body.action === 'set_nickname') {
        const rawNick = String(body.nickname ?? '').trim();
        if (rawNick.length < 2 || rawNick.length > 12) {
          return jsonResponse({ ok: false, error: '昵称长度需在 2 到 12 个字符之间！' }, 400);
        }
        const cleaned = sanitizeNickname(rawNick, playerId);

        // Check uniqueness in database
        const conflict = this.ctx.storage.sql
          .exec(
            `SELECT player_id FROM player_nicknames WHERE nickname = ? COLLATE NOCASE AND player_id != ?`,
            cleaned,
            playerId
          )
          .toArray();

        if (conflict.length > 0) {
          return jsonResponse({ ok: false, error: '该昵称已被其他干饭家使用，请换一个吧！' }, 409);
        }

        // Save nickname
        this.ctx.storage.sql.exec(
          `INSERT INTO player_nicknames (player_id, nickname, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, updated_at = excluded.updated_at`,
          playerId,
          cleaned,
          now
        );
        this.ctx.storage.sql.exec(
          `UPDATE endless_scores SET nickname = ? WHERE player_id = ?`,
          cleaned,
          playerId
        );
        this.ctx.storage.sql.exec(
          `UPDATE campaign_stars SET nickname = ? WHERE player_id = ?`,
          cleaned,
          playerId
        );

        return jsonResponse({ ok: true, nickname: cleaned });
      }

      // 2. Score submission (endless or stars)
      const isStars = body.type === 'stars';
      const rawVal = Number(body.score ?? (isStars ? body.stars : 0));
      const val = Number.isFinite(rawVal)
        ? Math.max(0, Math.min(isStars ? MAX_VALID_STARS : MAX_VALID_SCORE, Math.floor(rawVal)))
        : 0;

      // Determine player's nickname
      let nickname = '';
      const existingNick = this.ctx.storage.sql
        .exec(`SELECT nickname FROM player_nicknames WHERE player_id = ?`, playerId)
        .toArray();
      if (existingNick.length > 0) {
        nickname = String(existingNick[0].nickname);
      }

      if (body.nickname && String(body.nickname).trim().length > 0) {
        const customClean = sanitizeNickname(body.nickname, playerId);
        const conflict = this.ctx.storage.sql
          .exec(
            `SELECT player_id FROM player_nicknames WHERE nickname = ? COLLATE NOCASE AND player_id != ?`,
            customClean,
            playerId
          )
          .toArray();
        if (conflict.length === 0) {
          nickname = customClean;
          this.ctx.storage.sql.exec(
            `INSERT INTO player_nicknames (player_id, nickname, updated_at)
             VALUES (?, ?, ?)
             ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, updated_at = excluded.updated_at`,
            playerId,
            nickname,
            now
          );
        }
      }

      if (!nickname) {
        nickname = sanitizeNickname('', playerId);
        this.ctx.storage.sql.exec(
          `INSERT INTO player_nicknames (player_id, nickname, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, updated_at = excluded.updated_at`,
          playerId,
          nickname,
          now
        );
      }

      const tableName = isStars ? 'campaign_stars' : 'endless_scores';
      const valCol = isStars ? 'stars' : 'score';

      const existingRecord = this.ctx.storage.sql
        .exec(`SELECT ${valCol} AS val FROM ${tableName} WHERE player_id = ?`, playerId)
        .toArray();

      if (existingRecord.length === 0) {
        if (val > 0) {
          this.ctx.storage.sql.exec(
            `INSERT INTO ${tableName} (player_id, nickname, ${valCol}, updated_at)
             VALUES (?, ?, ?, ?)`,
            playerId,
            nickname,
            val,
            now
          );
        }
      } else {
        const prevVal = Number(existingRecord[0].val);
        const nextVal = Math.max(prevVal, val);
        const nextTime = val > prevVal ? now : undefined;
        if (nextTime !== undefined) {
          this.ctx.storage.sql.exec(
            `UPDATE ${tableName}
             SET ${valCol} = ?, nickname = ?, updated_at = ?
             WHERE player_id = ?`,
            nextVal,
            nickname,
            nextTime,
            playerId
          );
        } else {
          this.ctx.storage.sql.exec(
            `UPDATE ${tableName}
             SET nickname = ?
             WHERE player_id = ?`,
            nickname,
            playerId
          );
        }
      }

      return jsonResponse(this.buildSnapshot(playerId, isStars ? 'stars' : 'endless'));
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
