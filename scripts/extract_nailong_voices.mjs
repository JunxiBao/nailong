#!/usr/bin/env node
/**
 * Extracts Nailong voice clips from videos dropped in the project root.
 *
 * For every *.mov / *.mp4 / *.m4a / *.mkv / *.webm in the project root:
 *   1. Probe duration and loudness (ffprobe + ffmpeg volumedetect).
 *   2. Encode a loudness-matched MP3 (target mean ≈ -12.5 dB, never clipping)
 *      to public/assets/audio/nailong_voice_<n>.mp3.
 *   3. Append a { url, durationMs, subtitle } entry to NAILONG_VOICE_CLIPS
 *      in src/audio/MatchAudio.ts (round-robin playback on Nailong click).
 *   4. Delete the source video.
 *
 * Usage:  node scripts/extract_nailong_voices.mjs [--dry-run] [--keep-videos]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const AUDIO_DIR = path.join(ROOT, 'public/assets/audio');
const AUDIO_TS = path.join(ROOT, 'src/audio/MatchAudio.ts');
const VIDEO_RE = /\.(mov|mp4|m4a|mkv|webm)$/i;
const TARGET_MEAN_DB = -12.5;
const PEAK_CEILING_DB = -0.5;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const KEEP_VIDEOS = args.has('--keep-videos');

function findBin(name) {
  for (const p of [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`]) {
    if (fs.existsSync(p)) return p;
  }
  return name;
}
const FFMPEG = findBin('ffmpeg');
const FFPROBE = findBin('ffprobe');

function run(bin, argv) {
  const res = spawnSync(bin, argv, { encoding: 'utf-8' });
  if (res.error) throw new Error(`${bin} failed to start: ${res.error.message}`);
  return { code: res.status ?? 1, out: res.stdout ?? '', err: res.stderr ?? '' };
}

function probeDurationSec(file) {
  const { out } = run(FFPROBE, [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]);
  const sec = parseFloat(out.trim());
  if (!Number.isFinite(sec)) throw new Error(`Cannot read duration of ${file}`);
  return sec;
}

function hasAudioStream(file) {
  const { out } = run(FFPROBE, [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file,
  ]);
  return out.trim().length > 0;
}

function detectVolume(file) {
  const { err } = run(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
  const mean = parseFloat((err.match(/mean_volume:\s*(-?[\d.]+) dB/) ?? [])[1]);
  const max = parseFloat((err.match(/max_volume:\s*(-?[\d.]+) dB/) ?? [])[1]);
  if (!Number.isFinite(mean) || !Number.isFinite(max)) throw new Error(`volumedetect failed for ${file}`);
  return { mean, max };
}

/** "奶龙又吃撑咯 - 001 - 奶龙又吃撑咯.mov" -> "奶龙又吃撑咯" */
function subtitleFromFilename(file) {
  let base = path.basename(file).replace(VIDEO_RE, '');
  base = base.split(/\s+-\s+\d{2,4}\s+-\s+/)[0];
  base = base.replace(/原视频$/, '').replace(/[_]+/g, ' ').trim();
  return `“${base || '我是奶龙'}”`;
}

function nextClipIndex() {
  const existing = fs.existsSync(AUDIO_DIR) ? fs.readdirSync(AUDIO_DIR) : [];
  let max = 0;
  for (const f of existing) {
    const m = f.match(/^nailong_voice_(\d+)\.mp3$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function appendClipsToMatchAudio(entries) {
  const src = fs.readFileSync(AUDIO_TS, 'utf-8');
  const startIdx = src.indexOf('export const NAILONG_VOICE_CLIPS');
  if (startIdx < 0) throw new Error('NAILONG_VOICE_CLIPS not found in MatchAudio.ts');
  const endIdx = src.indexOf('\n];', startIdx);
  if (endIdx < 0) throw new Error('Could not find end of NAILONG_VOICE_CLIPS array');
  const block = entries
    .map(
      (e) =>
        `  {\n    url: '${e.url}',\n    durationMs: ${e.durationMs},\n    subtitle: ${JSON.stringify(e.subtitle)},\n  },`
    )
    .join('\n');
  const next = src.slice(0, endIdx) + '\n' + block + src.slice(endIdx);
  fs.writeFileSync(AUDIO_TS, next);
}

function main() {
  const videos = fs
    .readdirSync(ROOT)
    .filter((f) => VIDEO_RE.test(f))
    .sort((a, b) => fs.statSync(path.join(ROOT, a)).mtimeMs - fs.statSync(path.join(ROOT, b)).mtimeMs);

  if (videos.length === 0) {
    console.log('No videos found in project root. Nothing to do.');
    return;
  }

  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  let idx = nextClipIndex();
  const added = [];

  for (const name of videos) {
    const file = path.join(ROOT, name);
    if (!hasAudioStream(file)) {
      console.warn(`⚠️  Skipping (no audio stream): ${name}`);
      continue;
    }
    const durationSec = probeDurationSec(file);
    const { mean, max } = detectVolume(file);
    // Gain toward target mean loudness, but never push peaks above the ceiling.
    const gainDb = Math.round(Math.min(TARGET_MEAN_DB - mean, PEAK_CEILING_DB - max) * 10) / 10;
    const outName = `nailong_voice_${idx}.mp3`;
    const outPath = path.join(AUDIO_DIR, outName);
    const entry = {
      url: `/assets/audio/${outName}`,
      // +50ms tail so the BGM duck / pose lasts until the clip fully ends
      durationMs: Math.round(durationSec * 1000) + 50,
      subtitle: subtitleFromFilename(name),
    };

    console.log(
      `🎬 ${name}\n   duration=${durationSec.toFixed(2)}s mean=${mean}dB max=${max}dB gain=${gainDb >= 0 ? '+' : ''}${gainDb}dB\n   -> ${outName}  ${entry.subtitle}`
    );

    if (!DRY_RUN) {
      const enc = run(FFMPEG, [
        '-y', '-hide_banner', '-loglevel', 'error', '-i', file, '-vn',
        '-af', `volume=${gainDb}dB`, '-ar', '44100', '-ac', '2',
        '-codec:a', 'libmp3lame', '-q:a', '2', outPath,
      ]);
      if (enc.code !== 0 || !fs.existsSync(outPath) || fs.statSync(outPath).size < 5000) {
        throw new Error(`Encoding failed for ${name}: ${enc.err}`);
      }
      if (!KEEP_VIDEOS) fs.rmSync(file);
    }
    added.push(entry);
    idx++;
  }

  if (!DRY_RUN && added.length > 0) {
    appendClipsToMatchAudio(added);
  }
  console.log(`\n✅ ${DRY_RUN ? '[dry-run] would add' : 'Added'} ${added.length} clip(s) to NAILONG_VOICE_CLIPS.`);
  if (!DRY_RUN && !KEEP_VIDEOS) console.log('🗑️  Source videos deleted.');
}

main();
