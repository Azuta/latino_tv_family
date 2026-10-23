import fs from 'fs';

const content = fs.readFileSync('public/canales.m3u', 'utf-8');
const lines = content.split(/\r?\n/);
const jpChannels = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('group-title="Japonés') || lines[i].includes('tvg-language="Japanese"')) {
    jpChannels.push({ line: lines[i], url: lines[i + 1] });
  }
}

console.log('Total JP channels in list:', jpChannels.length);
jpChannels.forEach((c, idx) => {
  console.log(`${idx + 1}. ${c.line}`);
});
