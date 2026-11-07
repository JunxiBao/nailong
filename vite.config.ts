import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

interface StoredRecord {
  playerId: string;
  nickname: string;
  score: number;
  updatedAt: number;
}

function localLeaderboardPlugin(): Plugin {
  const dbPath = path.resolve('.local-leaderboard.json');

  const readDb = (): StoredRecord[] => {
    try {
      if (!fs.existsSync(dbPath)) return [];
      const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeDb = (records: StoredRecord[]) => {
    try {
      fs.writeFileSync(dbPath, JSON.stringify(records, null, 2));
    } catch {
      // ignore
    }
  };

  const sanitizePid = (raw: unknown): string => {
    const s = String(raw ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    return s.length >= 4 ? s : '';
  };

  const sanitizeNick = (raw: unknown, pid: string): string => {
    const cleaned = String(raw ?? '')
      .replace(/[<>"'`&/\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 12);
    if (cleaned.length > 0) return cleaned;
    return `干饭家#${pid.slice(-4).toUpperCase()}`;
  };

  const buildSnapshot = (records: StoredRecord[], pid: string) => {
    const valid = records
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.updatedAt - b.updatedAt);
    const myIdx = pid ? valid.findIndex((r) => r.playerId === pid) : -1;
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
      playerRank: myIdx >= 0 ? myIdx + 1 : null,
      entries,
    };
  };

  return {
    name: 'local-endless-leaderboard-api',
    configureServer(server) {
      server.middlewares.use('/api/leaderboard', (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');

        const fullUrl = new URL(req.url ?? '/', 'http://localhost');
        if (req.method === 'GET') {
          const pid = sanitizePid(fullUrl.searchParams.get('playerId'));
          res.end(JSON.stringify(buildSnapshot(readDb(), pid)));
          return;
        }

        if (req.method === 'POST') {
          let rawBody = '';
          req.on('data', (chunk) => {
            rawBody += chunk;
          });
          req.on('end', () => {
            try {
              const body = JSON.parse(rawBody || '{}');
              const pid = sanitizePid(body.playerId);
              if (!pid) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: 'Invalid playerId' }));
                return;
              }
              const rawScore = Number(body.score ?? 0);
              const score = Number.isFinite(rawScore)
                ? Math.max(0, Math.min(5_000_000, Math.floor(rawScore)))
                : 0;
              const hasCustomNick = String(body.nickname ?? '').trim().length > 0;
              const nickname = sanitizeNick(body.nickname, pid);
              const now = Date.now();

              const records = readDb();
              const idx = records.findIndex((r) => r.playerId === pid);
              if (idx === -1) {
                if (score > 0) records.push({ playerId: pid, nickname, score, updatedAt: now });
              } else {
                if (score > records[idx].score) {
                  records[idx].score = score;
                  records[idx].updatedAt = now;
                }
                if (hasCustomNick || !records[idx].nickname) {
                  records[idx].nickname = nickname;
                }
              }
              writeDb(records);
              res.end(JSON.stringify(buildSnapshot(records, pid)));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Bad JSON' }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ ok: false }));
      });
    },
  };
}

export default defineConfig({
  plugins: [localLeaderboardPlugin()],
});
