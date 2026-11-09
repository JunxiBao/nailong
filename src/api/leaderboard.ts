export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  updatedAt: number;
}

export interface LeaderboardState {
  ok: boolean;
  type?: 'endless' | 'stars';
  topScore: number;
  championName: string;
  totalPlayers?: number;
  playerRank: number | null;
  playerValue?: number;
  top10Threshold?: number;
  entries: LeaderboardEntry[];
}

export async function fetchGlobalLeaderboard(
  playerId: string,
  type: 'endless' | 'stars' = 'endless'
): Promise<LeaderboardState | null> {
  try {
    const qPid = encodeURIComponent(playerId || '');
    const qType = encodeURIComponent(type);
    const res = await fetch(`/api/leaderboard?playerId=${qPid}&type=${qType}`, {
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
        type: 'endless',
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

export async function submitCampaignStars(
  playerId: string,
  nickname: string,
  stars: number
): Promise<LeaderboardState | null> {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        type: 'stars',
        playerId,
        nickname,
        stars: Math.max(0, Math.floor(stars)),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LeaderboardState;
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

export async function setPlayerNickname(
  playerId: string,
  nickname: string
): Promise<{ ok: boolean; nickname?: string; error?: string }> {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        action: 'set_nickname',
        playerId,
        nickname: nickname.trim(),
      }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { ok: false, error: '网络连接失败，请稍后重试！' };
  }
}
