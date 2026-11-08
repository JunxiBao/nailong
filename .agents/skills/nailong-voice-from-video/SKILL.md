---
name: nailong-voice-from-video
description: >-
  Extract Nailong voice clips from video files (.mov/.mp4/.m4a/.mkv/.webm) that the user
  drops into the NAILONG project root, loudness-match them to the existing clips, register
  them in the round-robin NAILONG_VOICE_CLIPS list (played when Nailong is clicked),
  delete the source videos, verify, commit and push. Use when the user says they added
  new videos / audio for Nailong, or asks to "extract the audio and do the same as before".
---

# Nailong voice clips from videos

The game plays one voice clip per click on the Nailong character (title mascot, in-level
mascot, speech bubble, belly-slam button, Nailong stickers in modals), cycling through
`NAILONG_VOICE_CLIPS` in `src/audio/MatchAudio.ts` in order. Board tiles showing Nailong
do **not** play voice clips — keep it that way.

## Steps

1. **Find the videos** in the project root (not in subfolders):
   ```bash
   node -e "const fs=require('fs');console.log(fs.readdirSync('.').filter(f=>/\.(mov|mp4|m4a|mkv|webm)$/i.test(f)))"
   ```
   Use Node to list them — `ls` mangles Chinese filenames into `???`.

2. **Dry run first** to see duration, loudness, gain, output name and auto subtitle:
   ```bash
   node scripts/extract_nailong_voices.mjs --dry-run
   ```

3. **Extract** (encodes MP3s, appends entries to `NAILONG_VOICE_CLIPS`, deletes the videos):
   ```bash
   node scripts/extract_nailong_voices.mjs
   ```
   What the script does per video:
   - `ffprobe` duration, `ffmpeg -af volumedetect` mean/max volume.
   - Gain = `min(-12.5 - mean, -0.5 - max)` dB, so the clip matches the existing clips'
     loudness (mean ≈ -12.5 dB) without clipping.
   - Encodes `public/assets/audio/nailong_voice_<n>.mp3` (44.1 kHz stereo, `libmp3lame -q:a 2`).
   - Appends `{ url, durationMs: duration + 50ms, subtitle }`. The subtitle comes from the
     filename (the part before ` - 001 - `).
   - Deletes the source video (pass `--keep-videos` to keep them).

4. **Fix the subtitles.** Auto subtitles from filenames are often wrong (video titles ≠ the spoken
   line). If the user told you what each clip says, edit the `subtitle` strings in
   `NAILONG_VOICE_CLIPS`; otherwise tell the user the auto subtitles and ask them to confirm.
   Format: `'“text”'` with Chinese quotes.

5. **Verify** (run `node` directly; `npm` fails in the sandbox with `env: node: Operation not permitted`):
   ```bash
   node ./node_modules/typescript/bin/tsc --noEmit
   node ./node_modules/vitest/vitest.mjs run
   node ./node_modules/vite/bin/vite.js build
   ```
   The test in `tests/boardEngine.test.ts` checks every clip file exists and is a valid MP3,
   that no `.mov` remains in the root, and that playback is round-robin over all clips.

6. **Commit & push** (Cloudflare auto-deploys from `main`):
   ```bash
   git add public/assets/audio src/audio/MatchAudio.ts
   git commit -m "feat: add N new Nailong voice clips to round-robin rotation"
   git push origin main
   ```
   `git push` needs network: try it sandboxed first, then retry with the sandbox bypass.

## Notes
- `.gitignore` already ignores `/*.mov` and `/*.mp4` in the root, so source videos never get committed.
- Videos with no audio stream are skipped with a warning.
- Don't touch existing clips or their order unless the user asks.
