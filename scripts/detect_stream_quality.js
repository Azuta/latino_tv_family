import fs from 'fs';

async function inspectStreamQuality(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return { ok: false, status: res.status };

    const text = await res.text();
    const resMatches = [...text.matchAll(/RESOLUTION=(\d+)x(\d+)/g)];
    const bwMatches = [...text.matchAll(/BANDWIDTH=(\d+)/g)];

    let maxRes = null;
    let label = 'HD';

    if (resMatches.length > 0) {
      let maxH = 0;
      let maxW = 0;
      for (const m of resMatches) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        if (h > maxH) {
          maxH = h;
          maxW = w;
        }
      }
      maxRes = `${maxW}x${maxH}`;
      if (maxH >= 2160) label = '4K UHD';
      else if (maxH >= 1080) label = '1080p FHD';
      else if (maxH >= 720) label = '720p HD';
      else label = 'SD';
    } else {
      // Si es single variant, deducir por URL o bitrate
      if (url.includes('1080') || url.includes('fhd') || url.includes('hi')) label = '1080p';
      else if (url.includes('720') || url.includes('hd')) label = '720p';
      else label = 'HD';
    }

    const maxBw = bwMatches.length > 0 ? Math.max(...bwMatches.map(m => parseInt(m[1], 10))) : null;

    return {
      ok: true,
      maxRes,
      label,
      bandwidth: maxBw ? `${Math.round(maxBw / 1000)} kbps` : null
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function testSample() {
  const sample = [
    { name: 'DW Español', url: 'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/index.m3u8' },
    { name: 'RTVE 24h', url: 'https://rtvelivestream.rtve.es/rtvesec/24h/24h_main_dvr.m3u8' },
    { name: 'Red Bull TV', url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8' },
    { name: 'TyC Sports', url: 'https://amg26268-amg26268c14-freelivesports-emea-10267.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg26268-sportsstudio-tycsports-freelivesportsemea/playlist.m3u8' },
    { name: 'France 24 Español', url: 'https://live.france24.com/hls/live/2037220-b/F24_ES_HI_HLS/master_5000.m3u8' }
  ];

  for (const s of sample) {
    const q = await inspectStreamQuality(s.url);
    console.log(`${s.name}: Calidad detectada -> [${q.label}] Resolución: ${q.maxRes || 'Direct Stream'} | Bitrate: ${q.bandwidth || 'N/A'}`);
  }
}

testSample();
