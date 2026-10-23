import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, User-Agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const filePath = path.join(process.cwd(), 'public', 'canales.m3u');
    const content = fs.readFileSync(filePath, 'utf-8');

    const { pais, categoria, category, group, search, q, idioma, lang, language, format } = req.query;

    // Si no hay filtros y no se pide JSON, devolver el archivo original rápidamente
    if (!pais && !categoria && !category && !group && !search && !q && !idioma && !lang && !language && format !== 'json') {
      res.setHeader('Content-Type', 'application/x-mpegURL; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
      return res.status(200).send(content);
    }

    // Parsear canales
    const lines = content.split(/\r?\n/);
    const channels = [];
    let currentExtinf = null;
    let header = '#EXTM3U';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTM3U')) {
        header = line;
      } else if (line.startsWith('#EXTINF:')) {
        currentExtinf = line;
      } else if (!line.startsWith('#') && currentExtinf) {
        const idMatch = currentExtinf.match(/tvg-id="([^"]*)"/i);
        const nameMatch = currentExtinf.match(/tvg-name="([^"]*)"/i);
        const logoMatch = currentExtinf.match(/tvg-logo="([^"]*)"/i);
        const groupMatch = currentExtinf.match(/group-title="([^"]*)"/i);
        const langMatch = currentExtinf.match(/tvg-language="([^"]*)"/i);
        const titleMatch = currentExtinf.match(/,(.*)$/);

        const groupVal = groupMatch ? groupMatch[1] : 'General';
        let langVal = langMatch ? langMatch[1] : '';
        if (!langVal) {
          if (groupVal.toLowerCase().includes('español')) langVal = 'Español';
          else if (groupVal.toLowerCase().includes('english')) langVal = 'English';
          else if (groupVal.toLowerCase().includes('japon')) langVal = 'Japonés';
          else langVal = 'Otro';
        }

        channels.push({
          rawExtinf: currentExtinf,
          id: idMatch ? idMatch[1] : '',
          name: nameMatch ? nameMatch[1] : '',
          logo: logoMatch ? logoMatch[1] : '',
          group: groupVal,
          language: langVal,
          title: titleMatch ? titleMatch[1].trim() : '',
          url: line
        });
        currentExtinf = null;
      }
    }

    // Filtrar
    const filterCat = (categoria || category || group || '').toLowerCase();
    const filterSearch = (search || q || '').toLowerCase();
    const filterPais = (pais || '').toLowerCase();
    const filterLang = (idioma || lang || language || '').toLowerCase();

    const filtered = channels.filter((ch) => {
      let matches = true;

      if (filterLang) {
        const l = ch.language.toLowerCase();
        const g = ch.group.toLowerCase();
        if (filterLang === 'es' || filterLang === 'español' || filterLang === 'spanish') {
          matches = matches && (l.includes('español') || l.includes('spanish') || g.includes('español'));
        } else if (filterLang === 'en' || filterLang === 'english' || filterLang === 'inglés' || filterLang === 'ingles') {
          matches = matches && (l.includes('english') || g.includes('english'));
        } else if (filterLang === 'ja' || filterLang === 'jp' || filterLang === 'japonés' || filterLang === 'japones' || filterLang === 'japanese') {
          matches = matches && (l.includes('japon') || l.includes('japan') || g.includes('japon'));
        } else {
          matches = matches && l.includes(filterLang);
        }
      }

      if (filterCat) {
        matches = matches && ch.group.toLowerCase().includes(filterCat);
      }

      if (filterSearch) {
        const text = `${ch.name} ${ch.title} ${ch.group} ${ch.id}`.toLowerCase();
        matches = matches && text.includes(filterSearch);
      }

      if (filterPais) {
        const text = `${ch.name} ${ch.title} ${ch.id}`.toLowerCase();
        matches = matches && (text.includes(`_${filterPais}`) || text.includes(`@${filterPais}`) || text.includes(filterPais));
      }

      return matches;
    });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({
        total: filtered.length,
        channels: filtered.map(({ rawExtinf, ...rest }) => rest)
      });
    }

    // Reconstruir lista M3U
    const outputLines = [header];
    for (const ch of filtered) {
      outputLines.push(ch.rawExtinf);
      outputLines.push(ch.url);
    }

    res.setHeader('Content-Type', 'application/x-mpegURL; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).send(outputLines.join('\n'));
  } catch (error) {
    console.error('Error al generar la playlist:', error);
    return res.status(500).json({ error: 'Error interno al procesar la lista' });
  }
}
