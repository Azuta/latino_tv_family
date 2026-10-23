import fs from 'fs';
import path from 'path';

async function generateAllChannelsList() {
  console.log('Descargando catálogos completos de GitHub...');

  const [spaText, engText, jpText, jpCatText] = await Promise.all([
    fetch('https://iptv-org.github.io/iptv/languages/spa.m3u').then(r => r.text()),
    fetch('https://iptv-org.github.io/iptv/languages/eng.m3u').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_japan.m3u8').then(r => r.text()),
    fetch('https://raw.githubusercontent.com/skinred78/jp-iptv-epg/main/JP_Categories.m3u').then(r => r.text())
  ]);

  const outputLines = [
    '#EXTM3U x-tvg-url="https://iptv-org.github.io/epg/guides/es/movistar.es.epg.xml,https://epg.kanya.io/us/guide.xml.gz"',
    ''
  ];

  function processPlaylist(text, defaultLang) {
    const lines = text.split(/\r?\n/);
    let currentExtinf = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('#EXTINF:')) {
        currentExtinf = line;
      } else if (!line.startsWith('#') && line.startsWith('http') && currentExtinf) {
        // Asegurar que tenga grupo y lenguaje
        let ext = currentExtinf;
        if (!ext.includes('group-title=')) {
          ext += ` group-title="${defaultLang}: General"`;
        }
        if (!ext.includes('tvg-language=')) {
          ext += ` tvg-language="${defaultLang}"`;
        }
        outputLines.push(ext);
        outputLines.push(line);
        outputLines.push('');
        currentExtinf = null;
      }
    }
  }

  outputLines.push('# ============================================================');
  outputLines.push('# CATÁLOGO COMPLETO EN ESPAÑOL (GITHUB)');
  outputLines.push('# ============================================================');
  processPlaylist(spaText, 'Español');

  outputLines.push('# ============================================================');
  outputLines.push('# CATÁLOGO COMPLETO EN JAPONÉS (日本)');
  outputLines.push('# ============================================================');
  processPlaylist(jpCatText, 'Japonés');
  processPlaylist(jpText, 'Japonés');

  outputLines.push('# ============================================================');
  outputLines.push('# CATÁLOGO COMPLETO EN INGLÉS (GITHUB)');
  outputLines.push('# ============================================================');
  processPlaylist(engText, 'English');

  const outPath = path.join(process.cwd(), 'public', 'canales-todos.m3u');
  fs.writeFileSync(outPath, outputLines.join('\n'), 'utf-8');

  const totalChannels = outputLines.filter(l => l.startsWith('#EXTINF:')).length;
  console.log(`Catálogo completo generado con ${totalChannels} canales en: ${outPath}`);
}

generateAllChannelsList().catch(console.error);
