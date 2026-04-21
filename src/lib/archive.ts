/**
 * Gravity Archive Engine 📦
 * 
 * Sovereign clipboard vault and vault management API.
 * Dedicated Port: 3031
 */

import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);
const ROOT_DIR = "/Users/paranjay/Developer/iftt";
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const CLIPS_PATH = path.join(ROOT_DIR, 'gravity-archive', 'clips.json');
let CLIPSTACK: any[] = [];

declare const Bun: any;

function cleanDOM(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/ style="[^"]*"/gi, '')
    .replace(/ data-[a-z0-9-]+="[^"]*"/gi, '')
    .trim();
}

function cleanClipboard(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

async function archiveClipboard(text: string) {
  const dir = path.join(ROOT_DIR, 'gravity-archive');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  let clips: any[] = [];
  try {
    if (fs.existsSync(CLIPS_PATH)) {
      const data = fs.readFileSync(CLIPS_PATH, 'utf-8');
      clips = JSON.parse(data);
    }
  } catch (e) { clips = []; }
  
  const isHTML = text.includes('<') && text.includes('>');
  const processedText = isHTML ? cleanDOM(text) : text;

  const isPath = processedText.startsWith('/') || processedText.startsWith('~/') || processedText.match(/^[A-Z]:\\/);
  const isImage = processedText.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
  const isApp = processedText.endsWith('.app');

  const existingIdx = clips.findIndex((c: any) => c.text === processedText);
  if (existingIdx !== -1) {
    const [item] = clips.splice(existingIdx, 1);
    item.timestamp = new Date().toISOString();
    clips.unshift(item);
  } else {
    try { exec(`afplay /System/Library/Sounds/Hasso.aiff &`); } catch(e){}

    const mdLinkMatch = text.match(/\[.*\]\((https?:\/\/.*)\)/);
    const isLink = text.startsWith('http') || mdLinkMatch;
    
    let type = 'text';
    if (isPath) type = isImage ? 'image' : isApp ? 'app' : 'file';
    else if (isLink) type = 'link';
    else if (text.includes('{') || text.includes('function') || text.includes('=>')) type = 'code';

    if ((processedText.includes('Downloads') || processedText.includes('Desktop')) && isImage) {
      type = 'design';
    }

    let source = 'Unknown';
    try {
      source = execSync(`osascript -e 'tell application "System Events" to get name of first process whose frontmost is true'`).toString().trim();
      if (['Google Chrome', 'Arc', 'Safari', 'Brave Browser'].includes(source)) {
        try {
          const url = execSync(`osascript -e 'tell application "${source}" to get URL of active tab of first window'`).toString().trim();
          source = new URL(url).hostname.replace('www.', '');
        } catch(e) {}
      }
    } catch(e){}

    let label = '';
    if (processedText.length > 50) {
      label = processedText.split('\n')[0].substring(0, 50).trim();
    }

    const itemMeta: any = {
      words: processedText.split(/\s+/).filter(x => x.length > 0).length,
      lines: processedText.split('\n').length,
      tokens: Math.ceil(processedText.length / 4),
      type,
    };

    if (type === 'link') {
      const targetUrl = mdLinkMatch ? mdLinkMatch[1] : processedText;
      try {
        const response = await fetch(targetUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
          timeout: 5000 
        });
        const html = await response.text();
        
        // Robust Extraction
        itemMeta.ogTitle = html.match(/<title>(.*?)<\/title>/)?.[1] || 
                           html.match(/<meta property="og:title" content="(.*?)"/)?.[1] || '';
        
        // YouTube Specific Hunter
        if (processedText.includes('youtube.com') || processedText.includes('youtu.be')) {
          itemMeta.ogImage = html.match(/<link itemprop="thumbnailUrl" href="(.*?)"/)?.[1] || 
                             html.match(/<meta property="og:image" content="(.*?)"/)?.[1] || '';
        } else {
          itemMeta.ogImage = html.match(/<meta property="og:image" content="(.*?)"/)?.[1] || 
                             html.match(/<meta name="twitter:image" content="(.*?)"/)?.[1] || '';
        }

        itemMeta.ogDescription = html.match(/<meta property="og:description" content="(.*?)"/)?.[1] || 
                                 html.match(/<meta name="description" content="(.*?)"/)?.[1] || '';

        const domain = new URL(processedText).hostname;
        itemMeta.favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
      } catch(e) {}
    }

    clips.unshift({
      id: Date.now().toString(),
      text: processedText,
      timestamp: new Date().toISOString(),
      isBookmarked: false,
      label,
      source,
      meta: itemMeta
    });
  }
  
  fs.writeFileSync(CLIPS_PATH, JSON.stringify(clips.slice(0, 5000), null, 2));
}

async function main() {
  console.log('📦 Gravity Archive Engine: Starting Sentry...');
  let lastClip = "";

  // 🚀 SOVEREIGN ARCHIVE ENGINE (Port 3031)
  try {
    (Bun as any).serve({
      port: 3031,
      async fetch(req: any) {
        const url = new URL(req.url);

        if (url.pathname === '/archive/search' || url.pathname === '/archive/list') {
          const q = url.searchParams.get('q')?.toLowerCase() || "";
          const filter = url.searchParams.get('filter') || "all";
          if (!fs.existsSync(CLIPS_PATH)) return new Response('[]', { headers: { 'Access-Control-Allow-Origin': '*' } });

          let data = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          
          if (filter !== 'all') {
            if (filter === 'bookmarks') data = data.filter((c: any) => c.isBookmarked);
            else if (filter === 'jot') data = data.filter((c: any) => (c.meta?.type === 'jot' || String(c.text).startsWith('Jot:')));
            else if (filter === 'today') {
              const todayStr = new Date().toLocaleDateString();
              data = data.filter((c: any) => new Date(c.timestamp).toLocaleDateString() === todayStr);
            }
            else data = data.filter((c: any) => c.meta?.type === filter);
          }

          if (q) {
            data = data.filter((item: any) => 
               String(item.text).toLowerCase().includes(q) || 
               String(item.label || "").toLowerCase().includes(q) ||
               String(item.source || "").toLowerCase().includes(q)
            );
          }
          const totalCount = data.length;
          return new Response(JSON.stringify(data.slice(0, 2000)), { 
            headers: { 
              'Content-Type': 'application/json', 
              'Access-Control-Allow-Origin': '*',
              'X-Total-Count': String(totalCount)
            } 
          });
        }

        if (url.pathname === '/archive/export') {
          const data = fs.readFileSync(CLIPS_PATH, 'utf-8');
          return new Response(data, { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/hoard' && req.method === 'POST') {
          const body = await req.json();
          await archiveClipboard(body.text);
          return new Response('Hoarded', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/bookmark/')) {
          const id = url.pathname.split('/').pop();
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const idx = clipsData.findIndex((c: any) => String(c.id) === id);
          if (idx !== -1) {
            clipsData[idx].isBookmarked = !clipsData[idx].isBookmarked;
            fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          }
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/delete/')) {
          const id = url.pathname.split('/').pop();
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          clipsData = clipsData.filter((c: any) => String(c.id) !== id);
          fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/label/')) {
          const id = url.pathname.split('/').pop();
          const label = url.searchParams.get('label') || '';
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const idx = clipsData.findIndex((c: any) => String(c.id) === id);
          if (idx !== -1) {
            clipsData[idx].label = label;
            fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          }
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/jot' && req.method === 'POST') {
          const body = await req.json();
          await archiveClipboard(body.text);
          return new Response('Jotted', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/update/')) {
          const id = url.pathname.split('/').pop();
          const text = url.searchParams.get('text') || '';
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const idx = clipsData.findIndex((c: any) => String(c.id) === id);
          if (idx !== -1) {
            clipsData[idx].text = text;
            fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          }
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname.startsWith('/archive/alchemy/')) {
          const id = url.pathname.split('/').pop();
          const action = url.searchParams.get('action');
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const idx = clipsData.findIndex((c: any) => String(c.id) === id);
          if (idx !== -1) {
            let text = clipsData[idx].text;
            if (action === 'prettify') { try { text = JSON.stringify(JSON.parse(text), null, 2); } catch(e){} }
            else if (action === 'snake') { text = text.replace(/\W+/g, ' ').split(/ |\B(?=[A-Z])/).map(word => word.toLowerCase()).join('_'); }
            else if (action === 'camel') { text = text.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase()); }
            else if (action === 'strip') { text = text.replace(/\s+/g, ' ').trim(); }
            clipsData[idx].text = text;
            fs.writeFileSync(CLIPS_PATH, JSON.stringify(clipsData, null, 2));
          }
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/stack/list') {
          return new Response(JSON.stringify(CLIPSTACK), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname.startsWith('/archive/stack/add/')) {
          const id = url.pathname.split('/').pop();
          const clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          const item = clipsData.find((c: any) => String(c.id) === id);
          if (item) CLIPSTACK.push(item);
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        if (url.pathname === '/archive/stack/clear') {
          CLIPSTACK = [];
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/nuclear/reset') {
          fs.writeFileSync(CLIPS_PATH, JSON.stringify([], null, 2));
          return new Response('Vault Purged', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/export/md') {
          let clipsData = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
          let md = "# Gravity Sovereign Vault Export\n\n";
          clipsData.slice(0, 1000).forEach((c: any) => {
            md += `### ${c.label || 'Clip'} (${new Date(c.timestamp).toLocaleString()})\n**Source:** ${c.source || 'Unknown'}\n\n\`\`\`${c.meta?.type || 'text'}\n${c.text}\n\`\`\`\n\n---\n\n`;
          });
          return new Response(md, { headers: { 'Content-Type': 'text/markdown', 'Content-Disposition': 'attachment; filename="gravity_vault.md"', 'Access-Control-Allow-Origin': '*' } });
        }

        return new Response('Archive API Online', { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
    });
    console.log('🌌 Sovereign Archive (3031) Operational.');
  } catch(e) { console.warn('API 3031 error'); }

  // 📋 CLIPBOARD SENTRY LOOP
  setInterval(async () => {
    try {
      const { stdout } = await execAsync('pbpaste');
      const currentClip = stdout.trim();
      
      const isNoise = (text: string) => {
        const lines = text.split('\n');
        if (lines.length > 4) {
          const symbols = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
          const ratio = symbols / text.length;
          if (ratio > 0.25) return true;
        }
        return false;
      };

      if (currentClip && currentClip !== lastClip && currentClip.length > 3 && !isNoise(currentClip)) {
        lastClip = currentClip;
        await archiveClipboard(currentClip);
        console.log(`📋 Captured: ${currentClip.substring(0, 30)}...`);
      }
    } catch (e) {}
  }, 1000);
}

main();
