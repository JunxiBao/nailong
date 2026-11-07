import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('assets/references');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  {
    id: 'nailong_happy',
    queries: ['奶龙表情包', 'Nailoong cute', '奶龙 高清头像'],
    mustMatch: /奶龙|奶龍|nailong|nailoong/i,
    desc: '奶龙开心招牌表情',
  },
  {
    id: 'nailong_belly',
    queries: ['奶龙 大肚子', '奶龙 全身 立绘', 'Nailoong belly'],
    mustMatch: /奶龙|奶龍|nailong|nailoong/i,
    desc: '奶龙圆滚滚大肚皮全身像',
  },
  {
    id: 'nailong_eat',
    queries: ['奶龙 吃东西 表情包', '奶龙 干饭 表情包', '奶龙 鸡腿'],
    mustMatch: /奶龙|奶龍|nailong|nailoong/i,
    desc: '奶龙贪吃干饭表情',
  },
  {
    id: 'nailong_cool',
    queries: ['奶龙 得意 表情包', '奶龙 酷 墨镜', '奶龙 搞笑表情包'],
    mustMatch: /奶龙|奶龍|nailong|nailoong/i,
    desc: '奶龙搞怪得意表情',
  },
  {
    id: 'bombloong',
    queries: ['奶龙 暴暴龙', '暴暴龙 第七印象'],
    mustMatch: /暴暴龙|奶龙|bombloong/i,
    desc: '欢喜冤家暴暴龙',
  },
  {
    id: 'xiaoqi',
    queries: ['奶龙和小七', '奶龙 小七 剧照'],
    mustMatch: /小七|奶龙/i,
    desc: '奶龙与好朋友小七',
  },
];

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function detectImageExt(buf) {
  if (buf.length < 16) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'gif';
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

// Source 1: Sogou Pic JSON API (includes accurate item title + picUrl / thumbUrl)
async function searchSogou(query, mustMatch) {
  const out = [];
  try {
    const url = `https://pic.sogou.com/napi/pc/searchList?mode=1&start=0&xml_len=24&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: 'https://pic.sogou.com/' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return out;
    const json = await res.json();
    const items = json?.data?.items || [];
    for (const it of items) {
      const title = `${it.title || ''} ${it.oriTitle || ''}`.replace(/<[^>]+>/g, '');
      if (!mustMatch.test(title)) continue;
      if (it.thumbUrl) out.push({ url: it.thumbUrl, referer: 'https://pic.sogou.com/', title });
      if (it.picUrl) out.push({ url: it.picUrl, referer: 'https://pic.sogou.com/', title });
    }
  } catch {
    // ignore
  }
  return out;
}

// Source 2: Tenor Stickers / GIFs (great clean Nailong / Nailoong expressions!)
async function searchTenor(query) {
  const out = [];
  try {
    const slug = encodeURIComponent(query.replace(/\s+/g, '-'));
    const url = `https://tenor.com/search/${slug}-gifs`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return out;
    const html = await res.text();
    const matches = [...html.matchAll(/https:\/\/media1?\.tenor\.com\/[^"'\s<>]+?\.(?:png|gif|webp)/gi)];
    for (const m of matches.slice(0, 12)) {
      out.push({ url: m[0], referer: 'https://tenor.com/', title: `Tenor:${query}` });
    }
  } catch {
    // ignore
  }
  return out;
}

// Source 3: Bing Images standard HTML with metadata JSON check (`m="{...}"`)
async function searchBingVerified(query, mustMatch) {
  const out = [];
  for (const host of ['https://www.bing.com', 'https://cn.bing.com']) {
    try {
      const url = `${host}/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const blocks = [...html.matchAll(/m="(\{[^"]+\})"/g)];
      for (const b of blocks) {
        try {
          const decoded = b[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'");
          const meta = JSON.parse(decoded);
          const descText = `${meta.t || ''} ${meta.desc || ''} ${meta.purl || ''}`;
          if (!mustMatch.test(descText)) continue;
          if (meta.turl) out.push({ url: meta.turl, referer: host + '/', title: meta.t || query });
          if (meta.murl) out.push({ url: meta.murl, referer: host + '/', title: meta.t || query });
        } catch {
          // skip malformed block
        }
      }
      if (out.length > 0) break;
    } catch {
      // ignore
    }
  }
  return out;
}

const usedUrls = new Set();

async function downloadFirstValid(candidates, outBase) {
  for (const cand of candidates) {
    if (usedUrls.has(cand.url)) continue;
    try {
      const res = await fetch(cand.url, {
        headers: {
          'User-Agent': UA,
          Referer: cand.referer,
          Accept: 'image/png,image/jpeg,image/webp,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const arr = new Uint8Array(await res.arrayBuffer());
      if (arr.byteLength < 3500) continue;
      const ext = detectImageExt(arr);
      if (!ext) continue;
      usedUrls.add(cand.url);
      const outPath = path.join(OUT_DIR, `${outBase}.${ext}`);
      fs.writeFileSync(outPath, arr);
      return { outPath, sourceUrl: cand.url, title: cand.title, bytes: arr.byteLength, ext };
    } catch {
      // next
    }
  }
  return null;
}

async function main() {
  const report = [];
  for (const item of TARGETS) {
    console.log(`Searching verified images for [${item.id}] ...`);
    const candidates = [];
    for (const q of item.queries) {
      const [sogou, bing] = await Promise.all([
        searchSogou(q, item.mustMatch),
        searchBingVerified(q, item.mustMatch),
      ]);
      candidates.push(...sogou, ...bing);
      if (candidates.length >= 10) break;
    }
    if (candidates.length === 0 && /nailong/.test(item.id)) {
      const tenor = await searchTenor('nailoong');
      candidates.push(...tenor);
    }
    console.log(`  Verified ${candidates.length} title-matched candidates.`);
    const saved = await downloadFirstValid(candidates, item.id);
    if (saved) {
      console.log(`  Saved -> ${path.basename(saved.outPath)} (${saved.bytes}B) | "${saved.title}"`);
      report.push({ id: item.id, desc: item.desc, ...saved });
    } else {
      console.warn(`  Could not find verified image for ${item.id}`);
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'sources.json'),
    JSON.stringify({ fetchedAt: new Date().toISOString(), items: report }, null, 2)
  );
  console.log(`Done! Verified & saved ${report.length}/${TARGETS.length} images.`);
}

main();
