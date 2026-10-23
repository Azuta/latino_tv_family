import fs from 'fs';
import path from 'path';

function reclassify() {
  const m3uPath = path.join(process.cwd(), 'public', 'canales.m3u');
  const content = fs.readFileSync(m3uPath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const channels = [];
  let currentExtinf = null;
  let header = '#EXTM3U x-tvg-url="https://iptv-org.github.io/epg/guides/es/movistar.es.epg.xml,https://epg.kanya.io/us/guide.xml.gz"';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      header = line;
    } else if (line.startsWith('#EXTINF:')) {
      currentExtinf = line;
    } else if (!line.startsWith('#') && currentExtinf) {
      channels.push({
        extinf: currentExtinf,
        url: line
      });
      currentExtinf = null;
    }
  }

  console.log('Total canales leídos:', channels.length);

  // Analizar y corregir idioma de cada canal
  for (const ch of channels) {
    let ext = ch.extinf;
    const url = ch.url;

    // Caso específico: MAX Anime TV -> Es 100% en Español
    if (ext.includes('MAX Anime') || url.includes('maxanime')) {
      ext = ext.replace(/group-title="[^"]*"/, 'group-title="Español: Infantil y Familia"');
      ext = ext.replace(/tvg-language="[^"]*"/, 'tvg-language="Español"');
      ch.extinf = ext;
      ch.language = 'Español';
      ch.category = 'Infantil y Familia';
      continue;
    }

    // Caso: Bloomberg, Euronews, TOP BARCA, FUEL TV dentro de Japón -> Su audio es en Inglés
    if (ext.includes('rch_70') || ext.includes('Bloomberg TV+') || 
        ext.includes('rch_90') || ext.includes('euronewsengjp') || 
        ext.includes('rch_89') || ext.includes('TOP BARÇA') ||
        ext.includes('rch_64') || ext.includes('FUEL TV') ||
        ext.includes('Reuters 60') || ext.includes('NewsWorld')) {
      ext = ext.replace(/group-title="[^"]*"/, 'group-title="English: News"');
      if (ext.includes('TOP BARÇA') || ext.includes('FUEL TV')) {
        ext = ext.replace(/group-title="[^"]*"/, 'group-title="English: Sports"');
      }
      ext = ext.replace(/tvg-language="[^"]*"/, 'tvg-language="English"');
      ch.extinf = ext;
      ch.language = 'English';
      ch.category = ext.includes('Sports') ? 'Deportes' : 'Noticias';
      continue;
    }

    // Extraer grupo y lenguaje
    const gMatch = ext.match(/group-title="([^"]*)"/);
    const lMatch = ext.match(/tvg-language="([^"]*)"/);

    const group = gMatch ? gMatch[1] : '';
    let lang = lMatch ? lMatch[1] : '';

    if (!lang) {
      if (group.includes('Español')) lang = 'Español';
      else if (group.includes('English')) lang = 'English';
      else if (group.includes('Japonés') || group.includes('Japanese')) lang = 'Japonés';
      else lang = 'Español';
    }

    if (lang === 'Japanese') lang = 'Japonés';

    const cat = group.includes(':') ? group.split(':')[1].trim() : 'Entretenimiento';

    ch.language = lang;
    ch.category = cat;
  }

  // Agrupar canales
  const spanish = channels.filter(c => c.language === 'Español');
  const english = channels.filter(c => c.language === 'English');
  const japanese = channels.filter(c => c.language === 'Japonés');

  console.log(`Corregidos:`);
  console.log(`- 🇪🇸 Español: ${spanish.length}`);
  console.log(`- 🇬🇧 English: ${english.length}`);
  console.log(`- 🇯🇵 Japonés: ${japanese.length}`);

  const outLines = [header, ''];

  function appendSection(title, list, langPrefix, langTag) {
    outLines.push(`# ============================================================`);
    outLines.push(`# ${title.toUpperCase()}`);
    outLines.push(`# ============================================================`);
    outLines.push('');

    // Ordenar por categoría
    const catOrder = ['Noticias', 'Deportes', 'Cine y Series', 'Infantil y Familia', 'Entretenimiento', 'Cultura y Documentales', 'Música'];
    list.sort((a, b) => {
      const idxA = catOrder.indexOf(a.category);
      const idxB = catOrder.indexOf(b.category);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

    let currentCat = '';
    for (const ch of list) {
      if (ch.category !== currentCat) {
        currentCat = ch.category;
        outLines.push(`### --- ${langPrefix}: ${currentCat} ---`);
      }
      outLines.push(ch.extinf);
      outLines.push(ch.url);
      outLines.push('');
    }
  }

  appendSection('Canales en Español (Latinoamérica y España)', spanish, 'Español', 'Español');
  appendSection('English & International Channels', english, 'English', 'English');
  appendSection('Canales en Japonés (日本 - Audio Nativo Japonés)', japanese, 'Japonés', 'Japanese');

  fs.writeFileSync(m3uPath, outLines.join('\n'), 'utf-8');
  console.log('public/canales.m3u actualizado correctamente!');
}

reclassify();
