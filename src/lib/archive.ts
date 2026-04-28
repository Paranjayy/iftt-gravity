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
import os from 'os';

const execAsync = promisify(exec);
const ROOT_DIR = "/Users/paranjay/Developer/iftt";
const CLIPS_PATH = path.join(ROOT_DIR, 'gravity-archive', 'clips.json');
let CLIPSTACK: any[] = [];
let CLIPSTACK_SOURCE = "Unknown";
let CLIPSTACK_URL = "";

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
  
  // 🧬 Intelligence: Folder/File Awareness via osascript
  let resolvedText = text.trim();
  try {
     const { stdout: fileList } = await execAsync(`osascript -e '
      set resultList to {}
      try
        set theItems to (the clipboard as «class furl»)
        if class of theItems is not list then set theItems to {theItems}
        repeat with p in theItems
          set end of resultList to POSIX path of p
        end repeat
        return resultList
      on error
        return ""
      end try'`);
      
      const filePaths = fileList.trim();
      if (filePaths && filePaths.length > 5) {
        resolvedText = filePaths;
      }
  } catch(e) {}

  const processedText = resolvedText;

  const existingIdx = clips.findIndex((c: any) => c.text.trim() === processedText);
  if (existingIdx !== -1) {
    const item = clips[existingIdx];
    item.meta = item.meta || { type: 'text' };
    item.meta.dupes = (item.meta.dupes || 0) + 1;
    item.timestamp = new Date().toISOString();
    // Update context if it was missing
    if (!item.source || item.source === "Unknown") item.source = CLIPSTACK_SOURCE;
    if (!item.url) item.url = CLIPSTACK_URL;

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
    let project = undefined;
    
    if (isPath) {
      type = isImage ? 'image' : isApp ? 'app' : 'file';
      if (processedText.includes('SocialHoardr')) project = 'SocialHoardr';
      else if (processedText.includes('iftt')) project = 'Gravity';
      else if (processedText.includes('Antigravity')) project = 'Antigravity';
    } else if (isLink) {
      type = 'link';
    } else if (text.includes('{') || text.includes('function') || text.includes('=>')) {
      type = 'code';
    }

    const words = processedText.split(/\s+/).filter(x => x.length > 0).length;
    const lines = processedText.split('\n').length;
    const tokens = Math.ceil(processedText.length / 4);

    const newItem: any = {
      id: Date.now().toString(),
      text: processedText,
      timestamp: new Date().toISOString(),
      isBookmarked: false,
      source: CLIPSTACK_SOURCE || 'System',
      url: CLIPSTACK_URL || undefined,
      meta: {
        words,
        lines,
        chars: processedText.length,
        tokens,
        type,
        project
      }
    };

    if (isLink) {
      const targetUrl = mdLinkMatch ? mdLinkMatch[1] : (text.match(/https?:\/\/\S+/)?.[0] || text);
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(targetUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Gravity Archiver/1.0)' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
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
    if (typeof (globalThis as any).Bun !== 'undefined') {
      (globalThis as any).Bun.serve({
      port: 3031,
      async fetch(req: any) {
        const url = new URL(req.url);
        
        if (url.pathname === '/archive') {
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          return new Response(JSON.stringify(clipsData), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/search') {
          const query = url.searchParams.get('q')?.toLowerCase() || "";
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const filtered = clipsData.filter((c: any) => c.text.toLowerCase().includes(query)).slice(0, 50);
          return new Response(JSON.stringify(filtered), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/bookmark/')) {
          const id = url.pathname.split('/')[3];
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const item = clipsData.find((c: any) => c.id === id);
          if (item) item.isBookmarked = !item.isBookmarked;
          fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/label/')) {
          const id = url.pathname.split('/')[3];
          const label = url.searchParams.get('label');
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const item = clipsData.find((c: any) => c.id === id);
          if (item) item.label = label;
          fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/update/')) {
          const id = url.pathname.split('/')[3];
          const text = url.searchParams.get('text');
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const item = clipsData.find((c: any) => c.id === id);
          if (item) item.text = text;
          fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/delete/')) {
          const id = url.pathname.split('/')[3];
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          clipsData = clipsData.filter((c: any) => c.id !== id);
          fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
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
                   const controller = new AbortController();
                   const timeoutId = setTimeout(() => controller.abort(), 3000);
                   const response = await fetch(item.text, { signal: controller.signal });
                   const html = await response.text();
                   clearTimeout(timeoutId);
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

        if (url.pathname === '/archive/nuclear/reset' || url.pathname === '/archive/clear') {
          try {
            const backupPath = path.join(os.homedir(), 'Downloads', `gravity_archive_backup_${Date.now()}.json`);
            if (fs.existsSync(CLIPS_PATH)) {
              fs.copyFileSync(CLIPS_PATH, backupPath);
            }
            fs.writeFileSync(CLIPS_PATH, JSON.stringify([], null, 2));
            return new Response(`Vault Purged. Backup saved to Downloads: ${path.basename(backupPath)}`, { headers: { 'Access-Control-Allow-Origin': '*' } });
          } catch (e: any) {
            return new Response(`Clear Failed: ${e.message}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
          }
        }

        if (url.pathname === '/archive/export/json') {
          const clipsData = fs.readFileSync(CLIPS_PATH, 'utf-8');
          return new Response(clipsData, { 
            headers: { 
              'Content-Type': 'application/json', 
              'Content-Disposition': 'attachment; filename="clips_export.json"',
              'Access-Control-Allow-Origin': '*' 
            } 
          });
        }

        if (url.pathname === '/archive/import/json' && req.method === 'POST') {
          try {
            const body = await req.json();
            if (Array.isArray(body)) {
              fs.writeFileSync(CLIPS_PATH, JSON.stringify(body, null, 2));
              return new Response('Import Successful', { headers: { 'Access-Control-Allow-Origin': '*' } });
            }
            return new Response('Invalid Format', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
          } catch (e: any) {
            return new Response(`Import Failed: ${e.message}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
          }
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
    }
    console.log('🌌 Gravity Archive (3031) Operational.');
  } catch(e) { console.warn('API 3031 error'); }

  setInterval(async () => {
    try {
      const { stdout } = await execAsync('pbpaste', { timeout: 2000 });
      const text = stdout.trim();
      if (text && text !== lastClip && text.length < 100000) {
        // Detect Frontmost User Application & Context
        try {
          const script = `
            tell application "System Events"
              set frontApp to first application process whose frontmost is true
              set appName to name of frontApp
              set siteUrl to ""
              if appName is "Arc" then
                tell application "Arc" to set siteUrl to URL of active tab of first window
              else if appName is "Google Chrome" then
                tell application "Google Chrome" to set siteUrl to URL of active tab of first window
              else if appName is "Safari" then
                tell application "Safari" to set siteUrl to URL of current tab of first window
              end if
              return appName & "|" & siteUrl
            end tell
          `;
          const { stdout: context } = await execAsync(`osascript -e '${script}'`);
          const [appName, siteUrl] = context.trim().split('|');
          CLIPSTACK_SOURCE = appName;
          CLIPSTACK_URL = siteUrl;
        } catch(e) { 
          CLIPSTACK_SOURCE = "Unknown";
          CLIPSTACK_URL = "";
        }

        lastClip = text;
        await archiveClipboard(text);
      }
    } catch (e) {}
  }, 1000);
}

main().catch(err => { console.error(err); });
