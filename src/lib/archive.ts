/**
 * Gravity Archive Engine 📦
 * 
 * Professional clipboard vault and management API.
 * Dedicated Port: 3031
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);
const ROOT_DIR = "/Users/paranjay/Developer/iftt";
const CLIPS_PATH = path.join(ROOT_DIR, 'gravity-archive', 'clips.json');
let CLIPSTACK: any[] = [];
let CLIPSTACK_SOURCE = "Unknown";

function cleanDOM(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/ style="[^"]*"/gi, '')
    .replace(/ data-[a-z0-9-]+="[^"]*"/gi, '')
    .trim();
}

async function archiveClipboard(text: string) {
  const dir = path.join(ROOT_DIR, 'gravity-archive');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  let clips: any[] = [];
  try {
    const data = fs.readFileSync(CLIPS_PATH, 'utf-8');
    clips = JSON.parse(data);
  } catch (e) { clips = []; }
  
  const isHTML = text.includes('<') && text.includes('>');
  const processedText = isHTML ? cleanDOM(text) : text;

  const existingIdx = clips.findIndex((c: any) => c.text === processedText);
  if (existingIdx !== -1) {
    const item = clips[existingIdx];
    item.meta = item.meta || {};
    item.meta.dupes = (item.meta.dupes || 0) + 1;
    item.timestamp = new Date().toISOString();
    clips.splice(existingIdx, 1);
    clips.unshift(item);
  } else {
    try { exec(`afplay /System/Library/Sounds/Hasso.aiff &`); } catch(e){}

    const isPath = processedText.startsWith('/') || processedText.startsWith('~/') || processedText.match(/^[A-Z]:\\/);
    const isImage = processedText.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
    const isApp = processedText.endsWith('.app');
    const mdLinkMatch = text.match(/\[.*\]\((https?:\/\/.*)\)/);
    const isLink = text.startsWith('http') || mdLinkMatch;

    let type = 'text';
    if (isPath) type = isImage ? 'image' : isApp ? 'app' : 'file';
    else if (isLink) type = 'link';
    else if (text.includes('{') || text.includes('function') || text.includes('=>')) type = 'code';

    const newItem: any = {
      id: Date.now().toString(),
      text: processedText,
      timestamp: new Date().toISOString(),
      isBookmarked: false,
      meta: {
        words: processedText.split(/\s+/).filter(x => x.length > 0).length,
        lines: processedText.split('\n').length,
        chars: processedText.length,
        type,
      },
      source: CLIPSTACK_SOURCE || 'System'
    };

    if (isLink) {
      const targetUrl = mdLinkMatch ? mdLinkMatch[1] : (text.match(/https?:\/\/\S+/)?.[0] || text);
      try {
        const response = await fetch(targetUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Gravity Archiver/1.0)' },
          timeout: 5000 
        });
        const html = await response.text();
        newItem.meta.ogTitle = html.match(/<title>(.*?)<\/title>/)?.[1] || 
                            html.match(/<meta property="og:title" content="(.*?)"/)?.[1] || '';
        
        if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
          newItem.meta.ogImage = html.match(/<link itemprop="thumbnailUrl" href="(.*?)"/)?.[1] || 
                              html.match(/<meta property="og:image" content="(.*?)"/)?.[1] || '';
        } else {
          newItem.meta.ogImage = html.match(/<meta property="og:image" content="(.*?)"/)?.[1] || 
                              html.match(/<meta name="twitter:image" content="(.*?)"/)?.[1] || '';
        }
        newItem.meta.ogDescription = html.match(/<meta property="og:description" content="(.*?)"/)?.[1] || 
                                  html.match(/<meta name="description" content="(.*?)"/)?.[1] || '';
        const domain = new URL(targetUrl).hostname;
        newItem.meta.favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch(e) {}
    }
    clips.unshift(newItem);
  }
  // Expand to Infinite Hoard (100K safety cap for performance)
  fs.writeFileSync(CLIPS_PATH, JSON.stringify(clips.slice(0, 100000), null, 2));
}

async function main() {
  console.log('📦 Gravity Archive: Sentry online.');
  let lastClip = "";

  try {
    (Bun as any).serve({
      port: 3031,
      async fetch(req: any) {
        const url = new URL(req.url);
        
        if (url.pathname === '/archive/search') {
          const query = url.searchParams.get('q')?.toLowerCase() || "";
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const filtered = clipsData.filter((c: any) => c.text.toLowerCase().includes(query)).slice(0, 50);
          return new Response(JSON.stringify(filtered), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/hoard' && req.method === 'POST') {
          const body: any = await req.json();
          if (body.text) await archiveClipboard(body.text);
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/retro/sync') {
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          let count = 0;
          (async () => {
            for (let i = 0; i < clipsData.length; i++) {
              const item = clipsData[i];
              if (item.meta?.type === 'link' && !item.meta.ogImage) {
                try {
                   const response = await fetch(item.text, { timeout: 3000 });
                   const html = await response.text();
                   item.meta.ogTitle = html.match(/<title>(.*?)<\/title>/)?.[1] || "";
                   item.meta.ogImage = html.match(/<meta property="og:image" content="(.*?)"/)?.[1] || "";
                   item.meta.ogDescription = html.match(/<meta property="og:description" content="(.*?)"/)?.[1] || "";
                   count++;
                   if (count % 10 === 0) fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
                } catch(e) {}
              }
            }
            fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          })();
          return new Response('Sync Started', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/nuclear/reset') {
          fs.writeFileSync(CLIPS_PATH, JSON.stringify([], null, 2));
          return new Response('Vault Purged', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/export/md') {
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          let md = "# Gravity Archive Export\n\n";
          clipsData.slice(0, 1000).forEach((c: any) => {
            md += `### ${c.label || 'Clip'} (${new Date(c.timestamp).toLocaleString()})\n**Source:** ${c.source || 'Unknown'}\n\n\`\`\`${c.meta?.type || 'text'}\n${c.text}\n\`\`\`\n\n---\n\n`;
          });
          return new Response(md, { headers: { 'Content-Type': 'text/markdown', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/stats/heatmap') {
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const counts: Record<string, number> = {};
          
          // Last 90 days logic
          clipsData.forEach((c: any) => {
            const date = c.timestamp.split('T')[0];
            counts[date] = (counts[date] || 0) + 1;
          });

          let table = "📅 *Gravity Hoarding Pulse (90 Days)*\n\n";
          const days = [];
          for (let i = 0; i < 90; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const ds = d.toISOString().split('T')[0];
            days.push({ ds, count: counts[ds] || 0 });
          }

          // Generate Markdown-friendly Heatmap (ASCII style for Tele/MD)
          days.reverse().forEach((d, idx) => {
             const spark = d.count === 0 ? "🌑" : d.count < 5 ? "🌘" : d.count < 15 ? "🌗" : d.count < 30 ? "🌖" : "🌕";
             table += spark + (idx % 7 === 6 ? "\n" : " ");
          });

          return new Response(table, { headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/sync') {
           try {
             await execAsync(`git add gravity-archive/clips.json && git commit -m "Archive Pulse: ${new Date().toISOString()}" && git push origin master`);
             return new Response('Vault Synced to Sovereign Cloud (GitHub)', { headers: { 'Access-Control-Allow-Origin': '*' } });
           } catch(e: any) {
             return new Response(`Sync Failed: ${e.message}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
           }
        }

        return new Response('Archive API Online', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    });
    console.log('🌌 Gravity Archive (3031) Operational.');
  } catch(e) { console.warn('API 3031 error'); }

  setInterval(async () => {
    try {
      const { stdout } = await execAsync('pbpaste');
      const text = stdout.trim();
      if (text && text !== lastClip) {
        // Detect Frontmost App Name
        try {
          const { stdout: appName } = await execAsync("osascript -e 'tell application \"System Events\" to name of (first process whose frontmost is true)'");
          CLIPSTACK_SOURCE = appName.trim();
        } catch(e) { CLIPSTACK_SOURCE = "Unknown"; }

        lastClip = text;
        await archiveClipboard(text);
      }
    } catch (e) {}
  }, 1000);
}

main().catch(err => { console.error(err); });
