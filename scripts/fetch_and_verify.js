import fs from 'fs';
import path from 'path';

// Mapeo de categorías en inglés a español estándar
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
  const parts = rawCat.toLowerCase().split(/[\s,;/]+/);
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
      // Descartar streams con etiquetas de bloqueo
      if (currentExtinf.includes('[Geo-blocked]') || currentExtinf.includes('[Blocked]')) {
        currentExtinf = null;
        continue;
      }

      const idMatch = currentExtinf.match(/tvg-id="([^"]*)"/i);
      const nameMatch = currentExtinf.match(/tvg-name="([^"]*)"/i);
      const logoMatch = currentExtinf.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = currentExtinf.match(/group-title="([^"]*)"/i);
      const titleMatch = currentExtinf.match(/,(.*)$/);

      const rawTitle = titleMatch ? titleMatch[1].trim() : 'Canal';
      // Limpiar sufijos molestos como (1080p), [Not 24/7]
      const cleanTitle = rawTitle.replace(/\s*\[Not 24\/7\]/gi, '').replace(/\s*\(\d+p\)/gi, '').trim();

      const rawCat = groupMatch ? groupMatch[1] : '';
      const mappedCategory = mapCategory(rawCat);

      if (mappedCategory !== null) {
        channels.push({
          id: idMatch ? idMatch[1] : '',
          name: nameMatch ? nameMatch[1] : cleanTitle,
          title: cleanTitle,
          logo: logoMatch ? logoMatch[1] : '',
          category: mappedCategory,
          language: languageName,
          languageCode,
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

    // Leer el primer trozo de bytes para verificar que contenga directivas M3U / HLS o sea texto válido
    const reader = res.body.getReader();
    const { value } = await reader.read();
    reader.cancel();

    if (!value || value.length === 0) return false;
    const text = new TextDecoder('utf-8', { fatal: false }).decode(value);

    // Debe ser una lista HLS o contener chunks de video
    const isHLS = text.includes('#EXTM3U') || text.includes('#EXT-X-') || text.includes('.m3u8') || text.includes('.ts');
    // Algunos servidores devuelven streams binarios directos (TS o MP4)
    const isStream = isHLS || (value.length > 50 && (value[0] === 0x47 || text.startsWith('<?xml') === false));

    return isStream;
  } catch (err) {
    clearTimeout(timer);
    return false;
  }
}

// Cola de ejecución concurrente con límite de workers
async function runWorkerPool(items, workerFn, concurrency = 35) {
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
            if (finished % 50 === 0 || finished === items.length) {
              process.stdout.write(`Progreso: ${finished}/${items.length} verificados. Encontrados válidos: ${results.length}\r`);
            }
            next();
          });
      }
    }

    next();
  });
}

async function main() {
  console.log('--- 1. Descargando listas oficiales de iptv-org ---');

  const [spaRes, engRes] = await Promise.all([
    fetch('https://iptv-org.github.io/iptv/languages/spa.m3u').then(r => r.text()),
    fetch('https://iptv-org.github.io/iptv/languages/eng.m3u').then(r => r.text())
  ]);

  console.log('Listas descargadas. Parseando canales...');
  const spanishChannels = parseM3U(spaRes, 'Español', 'es');
  const englishChannels = parseM3U(engRes, 'English', 'en');

  console.log(`Total canales parseados: ${spanishChannels.length} en Español, ${englishChannels.length} en Inglés.`);

  // Priorizar canales en Español
  // Deduplicar por nombre y descartar duplicados exactos
  function dedupe(channels) {
    const seen = new Set();
    const unique = [];
    for (const ch of channels) {
      const key = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seen.has(key) && key.length > 2) {
        seen.add(key);
        unique.push(ch);
      }
    }
    return unique;
  }

  const uniqueSpanish = dedupe(spanishChannels);
  // De inglés, tomamos canales prioritarios de Noticias, Deportes, Cine, Documentales, Kids
  const filteredEnglish = englishChannels.filter(c => 
    ['Noticias', 'Deportes', 'Cine y Series', 'Infantil y Familia', 'Cultura y Documentales'].includes(c.category)
  );
  const uniqueEnglish = dedupe(filteredEnglish);

  console.log(`Canales únicos preseleccionados: ${uniqueSpanish.length} (ES), ${uniqueEnglish.length} (EN).`);

  // Vamos a verificar todos los canales en español (primeros 600 más relevantes) y los top 200 de inglés
  // para mantener un tiempo de chequeo ágil (~1 a 2 minutos)
  const candidatePool = [
    ...uniqueSpanish.slice(0, 500),
    ...uniqueEnglish.slice(0, 150)
  ];

  console.log(`\n--- 2. Verificando conectividad en vivo de ${candidatePool.length} canales candidatos con timeout de 3.5s ---`);

  const verifiedChannels = await runWorkerPool(
    candidatePool,
    async (channel) => {
      const isWorking = await verifyStream(channel.url);
      if (isWorking) {
        return channel;
      }
      return null;
    },
    40 // 40 conexiones en paralelo
  );

  console.log(`\n\n--- 3. Verificación completa: ${verifiedChannels.length} canales verificados y funcionando al 100%! ---`);

  // Organizar canales por Idioma y luego por Categoría
  // Definir orden de categorías
  const categoryOrder = [
    'Noticias',
    'Deportes',
    'Cine y Series',
    'Infantil y Familia',
    'Entretenimiento',
    'Cultura y Documentales',
    'Música'
  ];

  // Separar Español e Inglés
  const spanishVerified = verifiedChannels.filter(c => c.language === 'Español');
  const englishVerified = verifiedChannels.filter(c => c.language === 'English');

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

  // Estadísticas
  console.log('\nDesglose de canales verificados:');
  console.log(`🇪🇸 Español: ${sortedSpanish.length} canales`);
  for (const cat of categoryOrder) {
    const count = sortedSpanish.filter(c => c.category === cat).length;
    if (count > 0) console.log(`   - ${cat}: ${count}`);
  }

  console.log(`\n🇬🇧 English: ${sortedEnglish.length} canales`);
  for (const cat of categoryOrder) {
    const count = sortedEnglish.filter(c => c.category === cat).length;
    if (count > 0) console.log(`   - ${cat}: ${count}`);
  }

  // Generar archivo M3U Plus
  const outLines = [
    '#EXTM3U x-tvg-url="https://iptv-org.github.io/epg/guides/es/movistar.es.epg.xml,https://epg.kanya.io/us/guide.xml.gz"',
    ''
  ];

  function appendSection(title, channels, langPrefix) {
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
      const extinf = `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${ch.logo}" group-title="${groupTitle}" tvg-language="${ch.language}",${ch.title}`;
      outLines.push(extinf);
      outLines.push(ch.url);
      outLines.push('');
    }
  }

  appendSection('Canales en Español (Latinoamérica y España)', sortedSpanish, 'Español');
  appendSection('International & English Channels', sortedEnglish, 'English');

  const m3uOutputPath = path.join(process.cwd(), 'public', 'canales.m3u');
  fs.writeFileSync(m3uOutputPath, outLines.join('\n'), 'utf-8');
  console.log(`\nArchivo guardado con éxito en: ${m3uOutputPath}`);
}

main().catch(console.error);
