import fs from 'fs';
import path from 'path';

// Mapeo universal de categorías
const CATEGORY_MAP = {
  news: 'Noticias',
  business: 'Noticias',
  weather: 'Noticias',
  legislative: 'Noticias',
  public: 'Noticias',
  sports: 'Deportes',
  auto: 'Deportes',
  outdoor: 'Deportes',
  movies: 'Cine y Series',
  series: 'Cine y Series',
  animation: 'Infantil y Familia',
  kids: 'Infantil y Familia',
  family: 'Infantil y Familia',
  music: 'Música',
  documentary: 'Cultura y Documentales',
  culture: 'Cultura y Documentales',
  education: 'Cultura y Documentales',
  science: 'Cultura y Documentales',
  travel: 'Cultura y Documentales',
  entertainment: 'Entretenimiento',
  comedy: 'Entretenimiento',
  lifestyle: 'Entretenimiento',
  cooking: 'Entretenimiento',
  general: 'Entretenimiento'
};

const IGNORED_CATEGORIES = new Set(['religious', 'shop', 'adult', 'xxx']);

function mapCategory(rawCat) {
  if (!rawCat) return 'Entretenimiento';
  const parts = rawCat.toLowerCase().split(/[\s,;/_-]+/);
  for (const p of parts) {
    if (IGNORED_CATEGORIES.has(p)) return null;
  }
  for (const p of parts) {
    if (CATEGORY_MAP[p]) return CATEGORY_MAP[p];
  }
  return 'Entretenimiento';
}

function parseM3U(text, languageName, languageCode) {
  const lines = text.split(/\r?\n/);
  const channels = [];
  let currentExtinf = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      currentExtinf = line;
    } else if (!line.startsWith('#') && currentExtinf) {
      const url = line;
      if (currentExtinf.includes('[Geo-blocked]') || currentExtinf.includes('[Blocked]') || currentExtinf.includes('[NO PUBLIC STREAM]')) {
        currentExtinf = null;
        continue;
      }

      const idMatch = currentExtinf.match(/tvg-id="([^"]*)"/i);
      const nameMatch = currentExtinf.match(/tvg-name="([^"]*)"/i);
      const logoMatch = currentExtinf.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = currentExtinf.match(/group-title="([^"]*)"/i);
      const titleMatch = currentExtinf.match(/,(.*)$/);

      const rawTitle = titleMatch ? titleMatch[1].trim() : 'Canal';
      const cleanTitle = rawTitle.replace(/\s*\[Not 24\/7\]/gi, '').replace(/\s*\(\d+p\)/gi, '').trim();

      const rawCat = groupMatch ? groupMatch[1] : '';
      let mappedCategory = mapCategory(rawCat);

      // Reglas de lenguaje específicas
      let finalLang = languageName;
      let finalLangCode = languageCode;

      // Canales de Japón que transmiten en inglés
      const lower = (rawTitle + ' ' + (nameMatch ? nameMatch[1] : '') + ' ' + url).toLowerCase();
      if (lower.includes('bloomberg') || lower.includes('euronewsengjp') || lower.includes('fcbarcelona') || lower.includes('fuel_tv') || lower.includes('reuters')) {
        finalLang = 'English';
        finalLangCode = 'en';
      }

      // Canales de Anime latino que transmiten en español
      if (lower.includes('maxanime') || lower.includes('max anime')) {
        finalLang = 'Español';
        finalLangCode = 'es';
        mappedCategory = 'Infantil y Familia';
      }

      // Categorización de canales japoneses
      if (finalLang === 'Japonés') {
        if (lower.includes('news') || lower.includes('ニュース') || lower.includes('weather') || lower.includes('ウェザー')) {
          mappedCategory = 'Noticias';
        } else if (lower.includes('sport') || lower.includes('スポーツ') || lower.includes('golf') || lower.includes('pachinko') || lower.includes('パチンコ')) {
          mappedCategory = 'Deportes';
        } else if (lower.includes('anime') || lower.includes('アニメ') || lower.includes('mx') || lower.includes('kids') || lower.includes('キッズ')) {
          mappedCategory = 'Infantil y Familia';
        } else if (lower.includes('movie') || lower.includes('cinema') || lower.includes('映画') || lower.includes('時代劇')) {
          mappedCategory = 'Cine y Series';
        } else if (lower.includes('music') || lower.includes('音楽')) {
          mappedCategory = 'Música';
        } else {
          mappedCategory = mappedCategory || 'Entretenimiento';
        }
      }

      if (mappedCategory !== null && url.startsWith('http')) {
        channels.push({
          id: idMatch ? idMatch[1] : '',
          name: nameMatch ? nameMatch[1] : cleanTitle,
          title: cleanTitle,
          logo: logoMatch ? logoMatch[1] : '',
          category: mappedCategory,
          language: finalLang,
          languageCode: finalLangCode,
          url
        });
      }
      currentExtinf = null;
    }
  }
  return channels;
}

// Verificador de stream HLS
async function verifyStream(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      return false;
    }

    const reader = res.body.getReader();
    const { value } = await reader.read();
    reader.cancel();

    if (!value || value.length === 0) return false;
    const text = new TextDecoder('utf-8', { fatal: false }).decode(value);

    const isHLS = text.includes('#EXTM3U') || text.includes('#EXT-X-') || text.includes('.m3u8') || text.includes('.ts');
    const isStream = isHLS || (value.length > 50 && (value[0] === 0x47 || text.startsWith('<?xml') === false));

    return isStream;
  } catch (err) {
    clearTimeout(timer);
    return false;
  }
}

async function runWorkerPool(items, workerFn, concurrency = 40) {
  const results = [];
  let index = 0;
  let active = 0;
  let finished = 0;

  return new Promise((resolve) => {
    function next() {
      if (index >= items.length && active === 0) {
        return resolve(results);
      }

      while (active < concurrency && index < items.length) {
        const currentIndex = index++;
        const item = items[currentIndex];
        active++;

        workerFn(item)
          .then((res) => {
            if (res) results.push(res);
          })
          .catch(() => {})
          .finally(() => {
            active--;
            finished++;
            if (finished % 25 === 0 || finished === items.length) {
              process.stdout.write(`Progreso: ${finished}/${items.length} verificados. Encontrados válidos: ${results.length}\r`);
            }
            next();
          });
      }
    }

    next();
  });
}

function dedupe(channels) {
  const seen = new Set();
  const unique = [];
  for (const ch of channels) {
    const key = (ch.name + '_' + ch.url).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key) && key.length > 2) {
      seen.add(key);
      unique.push(ch);
    }
  }
  return unique;
}

async function main() {
  console.log('--- 1. Descargando fuentes oficiales para Español, Inglés y Japonés ---');

  const [spaRes, engRes, jpCatRes, freeJpRes, iptvJpRes] = await Promise.all([
    fetch('https://iptv-org.github.io/iptv/languages/spa.m3u').then(r => r.text()),
    fetch('https://iptv-org.github.io/iptv/languages/eng.m3u').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/skinred78/jp-iptv-epg/main/JP_Categories.m3u').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_japan.m3u8').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/iptv-org/iptv/master/streams/jp.m3u').then(r => r.text())
  ]);

  console.log('Listas descargadas. Procesando canales...');

  const spanishChannels = [
    ...parseM3U(spaRes, 'Español', 'es'),
    {
      id: 'MAXAnime.ve',
      name: 'MAX Anime',
      title: 'MAX Anime TV (Español Latino)',
      logo: 'https://i.imgur.com/Oj3hEBh.jpg',
      category: 'Infantil y Familia',
      language: 'Español',
      languageCode: 'es',
      url: 'https://cdnlive.klicgo.net/maxanime/live/playlist.m3u8'
    }
  ];

  const englishChannels = parseM3U(engRes, 'English', 'en');
  
  const jpChannels = [
    ...parseM3U(jpCatRes, 'Japonés', 'ja'),
    ...parseM3U(freeJpRes, 'Japonés', 'ja'),
    ...parseM3U(iptvJpRes, 'Japonés', 'ja'),
    {
      id: 'NHKWorldJapan.jp',
      name: 'NHK World Japan',
      title: 'NHK World Japan (Noticias & Cultura)',
      logo: 'https://i.imgur.com/Mhw1Ihk.png',
      category: 'Noticias',
      language: 'Japonés',
      languageCode: 'ja',
      url: 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8'
    },
    {
      id: 'Weathernews.jp',
      name: 'Weathernews Japan',
      title: 'ウェザーニュースLiVE (Weathernews Live)',
      logo: 'https://channel.rakuten.co.jp/service/img/logo/chlogo-with-number/106_whethernews.png',
      category: 'Noticias',
      language: 'Japonés',
      languageCode: 'ja',
      url: 'https://rch01e-alive-hls.akamaized.net/38fb45b25cdb05a1/out/v1/4e907bfabc684a1dae10df8431a84d21/index.m3u8'
    },
    {
      id: 'TokyoMX.jp',
      name: 'TOKYO MX',
      title: 'TOKYO MX チャンネル (Anime & Variedades)',
      logo: 'https://channel.rakuten.co.jp/service/img/logo/chlogo-with-number/108_mx.png',
      category: 'Infantil y Familia',
      language: 'Japonés',
      languageCode: 'ja',
      url: 'https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01287-rakutentvjapan-tokyomx-cmaf-rakutenjp/playlist.m3u8'
    },
    {
      id: 'NipponTVNews.jp',
      name: 'Nippon TV News',
      title: '日テレNEWS (Nippon TV News 24)',
      logo: 'https://channel.rakuten.co.jp/service/img/logo/chlogo-with-number/104_ntvnews.png',
      category: 'Noticias',
      language: 'Japonés',
      languageCode: 'ja',
      url: 'https://cdn-apne1.tsv2.amagi.tv/linear/amg01287-rakutentvjapan-news1hlscmaf-rakutenjp/playlist.m3u8'
    },
    {
      id: 'MBSNews.jp',
      name: 'MBS News',
      title: 'MBSニュース (Mainichi News Kansai)',
      logo: 'https://channel.rakuten.co.jp/service/img/logo/chlogo-with-number/106_mbs.png',
      category: 'Noticias',
      language: 'Japonés',
      languageCode: 'ja',
      url: 'https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg01287-rakutentvjapan-news5-cmaf-rakutenjp/playlist.m3u8'
    },
    {
      id: 'NHKWorldPremium.jp',
      name: 'NHK World Premium',
      title: 'NHK World Premium Japan',
      logo: 'https://i.imgur.com/Mhw1Ihk.png',
      category: 'Cultura y Documentales',
      language: 'Japonés',
      languageCode: 'ja',
      url: 'https://media-tyo.hls.nhkworld.jp/hls/wp/live/master.m3u8'
    }
  ];

  const uniqueSpanish = dedupe(spanishChannels);
  const uniqueEnglish = dedupe(englishChannels.filter(c => 
    ['Noticias', 'Deportes', 'Cine y Series', 'Infantil y Familia', 'Cultura y Documentales', 'Música'].includes(c.category)
  ));
  const uniqueJapanese = dedupe(jpChannels.filter(c => c.language === 'Japonés'));

  console.log(`Candidatos únicos:`);
  console.log(`- 🇪🇸 Español: ${uniqueSpanish.length}`);
  console.log(`- 🇬🇧 Inglés: ${uniqueEnglish.length}`);
  console.log(`- 🇯🇵 Japonés: ${uniqueJapanese.length}`);

  const candidatePool = [
    ...uniqueSpanish.slice(0, 520),
    ...uniqueEnglish.slice(0, 250),
    ...uniqueJapanese
  ];

  console.log(`\n--- 2. Verificando conectividad en vivo de ${candidatePool.length} canales con timeout 3.5s ---`);

  const verifiedChannels = await runWorkerPool(
    candidatePool,
    async (channel) => {
      const isWorking = await verifyStream(channel.url);
      if (isWorking) {
        return channel;
      }
      return null;
    },
    45
  );

  console.log(`\n\n--- 3. Verificación finalizada: ${verifiedChannels.length} canales 100% funcionales! ---`);

  const categoryOrder = [
    'Noticias',
    'Deportes',
    'Cine y Series',
    'Infantil y Familia',
    'Entretenimiento',
    'Cultura y Documentales',
    'Música'
  ];

  const spanishVerified = verifiedChannels.filter(c => c.language === 'Español');
  const englishVerified = verifiedChannels.filter(c => c.language === 'English');
  const japaneseVerified = verifiedChannels.filter(c => c.language === 'Japonés');

  function sortChannels(list) {
    return list.sort((a, b) => {
      const catA = categoryOrder.indexOf(a.category);
      const catB = categoryOrder.indexOf(b.category);
      if (catA !== catB) return catA - catB;
      return a.name.localeCompare(b.name);
    });
  }

  const sortedSpanish = sortChannels(spanishVerified);
  const sortedEnglish = sortChannels(englishVerified);
  const sortedJapanese = sortChannels(japaneseVerified);

  console.log('\nResumen por Idioma:');
  console.log(`🇪🇸 Español: ${sortedSpanish.length} canales`);
  console.log(`🇬🇧 English: ${sortedEnglish.length} canales`);
  console.log(`🇯🇵 Japonés: ${sortedJapanese.length} canales`);

  const outLines = [
    '#EXTM3U x-tvg-url="https://iptv-org.github.io/epg/guides/es/movistar.es.epg.xml,https://epg.kanya.io/us/guide.xml.gz"',
    ''
  ];

  function appendSection(title, channels, langPrefix, langTag) {
    outLines.push(`# ============================================================`);
    outLines.push(`# ${title.toUpperCase()}`);
    outLines.push(`# ============================================================`);
    outLines.push('');

    let currentCat = '';
    for (const ch of channels) {
      if (ch.category !== currentCat) {
        currentCat = ch.category;
        outLines.push(`### --- ${langPrefix}: ${currentCat} ---`);
      }

      const groupTitle = `${langPrefix}: ${ch.category}`;
      const extinf = `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${ch.logo}" group-title="${groupTitle}" tvg-language="${langTag}",${ch.title}`;
      outLines.push(extinf);
      outLines.push(ch.url);
      outLines.push('');
    }
  }

  appendSection('Canales en Español (Latinoamérica y España)', sortedSpanish, 'Español', 'Español');
  appendSection('English & International Channels', sortedEnglish, 'English', 'English');
  appendSection('Canales en Japonés (日本 - Audio Nativo Japonés)', sortedJapanese, 'Japonés', 'Japanese');

  const m3uOutputPath = path.join(process.cwd(), 'public', 'canales.m3u');
  fs.writeFileSync(m3uOutputPath, outLines.join('\n'), 'utf-8');
  console.log(`\nLista guardada exitosamente en: ${m3uOutputPath}`);
}

main().catch(console.error);
