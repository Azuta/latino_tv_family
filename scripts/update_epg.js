import fs from 'fs';

const epgHeader = '#EXTM3U x-tvg-url="https://epgshare01.online/epgshare01/epg_ripper_ALL_SOURCES1.xml.gz,https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz,https://epgshare01.online/epgshare01/epg_ripper_MX1.xml.gz,https://epgshare01.online/epgshare01/epg_ripper_AR1.xml.gz,https://epgshare01.online/epgshare01/epg_ripper_CL1.xml.gz,https://epgshare01.online/epgshare01/epg_ripper_CO1.xml.gz,https://epg.kanya.io/us/guide.xml.gz"';

const files = ['public/canales.m3u', 'public/canales-todos.m3u'];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(/^#EXTM3U[^\r\n]*/, epgHeader);
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`Cabecera EPG actualizada en: ${file}`);
  }
}
