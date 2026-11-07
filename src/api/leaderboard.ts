export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  updatedAt: number;
}

export interface LeaderboardState {
  ok: boolean;
  topScore: number;
  championName: string;
  totalPlayers: number;
  playerRank: number | null;
  entries: LeaderboardEntry[];
}

export async function fetchGlobalLeaderboard(playerId: string): Promise<LeaderboardState | null> {
  try {
    const q = encodeURIComponent(playerId || '');
    const res = await fetch(`/api/leaderboard?playerId=${q}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LeaderboardState;
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

export async function submitEndlessScore(
  playerId: string,
  nickname: string,
  score: number
): Promise<LeaderboardState | null> {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        playerId,
        nickname,
        score: Math.max(0, Math.floor(score)),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LeaderboardState;
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}
