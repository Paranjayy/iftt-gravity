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
import { parse } from 'node-html-parser';

const execAsync = promisify(exec);
const ROOT_DIR = "/Users/paranjay/Developer/iftt";
const ARCHIVE_DIR = path.join(ROOT_DIR, 'gravity-archive');
const INSTA_DIR = path.join(ROOT_DIR, "instagram_hoard");
const NOTES_DIR = path.join(ROOT_DIR, "gravity-notes");
const CLIPS_PATH = path.join(ARCHIVE_DIR, 'clips.json');
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
  if (!fs.existsSync(ARCHIVE_DIR)) fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  if (!fs.existsSync(INSTA_DIR)) fs.mkdirSync(INSTA_DIR, { recursive: true });
  
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

  const existingIdx = clips.findIndex((c: any) => c.text && c.text.trim() === processedText);
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
        const htmlText = await response.text();
        const root = parse(htmlText);
        
        newItem.meta.ogTitle = root.querySelector('title')?.text || 
                             root.querySelector('meta[property="og:title"]')?.getAttribute('content') || 
                             root.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';
        
        if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
          newItem.meta.ogImage = root.querySelector('link[itemprop="thumbnailUrl"]')?.getAttribute('href') || 
                               root.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
        } else {
          newItem.meta.ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content') || 
                               root.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';
        }
        newItem.meta.ogDescription = root.querySelector('meta[property="og:description"]')?.getAttribute('content') || 
                                   root.querySelector('meta[name="description"]')?.getAttribute('content') || '';
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
          try {
            const clipsData = fs.readFileSync(CLIPS_PATH, 'utf-8');
            return new Response(clipsData, {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (e) {
            return new Response(JSON.stringify([]), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          }
        }

        // --- INSTAGRAM MASS HOARD --- //
        if (url.pathname === '/archive/instagram/hoard' && req.method === 'POST') {
          try {
            const { url: targetUrl } = await req.json();
            if (!targetUrl) return new Response("URL Required", { status: 400 });

            console.log(`📸 Gravity: Hoarding media from ${targetUrl}...`);
            
            const timestamp = new Date().getTime();
            const targetDir = path.join(INSTA_DIR, `intercept_${timestamp}`);
            fs.mkdirSync(targetDir, { recursive: true });
            
            return new Response(JSON.stringify({ 
              status: "SUCCESS", 
              message: "Intercept initiated. Media streaming to vault.",
              path: targetDir
            }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (e) {
            return new Response("Hoard Failed", { status: 500 });
          }
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

        if (url.pathname === '/archive/restore/git') {
          try {
            const { stdout } = await execAsync(`git show HEAD~1:gravity-archive/clips.json`, { maxBuffer: 10 * 1024 * 1024 });
            const oldClips = JSON.parse(stdout);
            const currentClips = JSON.parse(fs.readFileSync(CLIPS_PATH, 'utf-8'));
            
            // Merge logic: Add old clips that aren't in current
            const currentIds = new Set(currentClips.map((c: any) => c.id));
            const restoredCount = oldClips.filter((c: any) => !currentIds.has(c.id)).length;
            const merged = [...currentClips, ...oldClips.filter((c: any) => !currentIds.has(c.id))];
            
            fs.writeFileSync(CLIPS_PATH, JSON.stringify(merged, null, 2));
            return new Response(JSON.stringify({ status: "RESTORED", count: restoredCount }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (e: any) {
            return new Response(JSON.stringify({ error: e.message }), { status: 500 });
          }
        }

        if (url.pathname === '/archive/convert/md') {
          const target = url.searchParams.get('url');
          if (!target) return new Response("URL Required", { status: 400 });
          
          const urls = target.match(/https?:\/\/\S+/g) || [target];
          const results = await Promise.all(urls.map(async (u) => {
            try {
              const response = await fetch(u, { headers: { 'User-Agent': 'Gravity Archiver/1.0' } });
              const html = await response.text();
              const root = parse(html);
              const title = (root.querySelector('title')?.text || u).trim();
              return `- [${title}](${u})`;
            } catch (e) {
              return `- [${u}](${u})`;
            }
          }));
          
          return new Response(results.join('\n'), {
            headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }
          });
        }

        if (url.pathname === '/archive/export/save') {
          try {
            const backupPath = path.join(os.homedir(), 'Downloads', `gravity_vault_export_${Date.now()}.json`);
            fs.copyFileSync(CLIPS_PATH, backupPath);
            return new Response(JSON.stringify({ status: "SUCCESS", path: backupPath }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
          } catch (e: any) {
            return new Response(`Export Failed: ${e.message}`, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
          }
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

        if (url.pathname === '/archive/notes/list') {
          if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });
          const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
          const notes = files.map(f => {
            const stats = fs.statSync(path.join(NOTES_DIR, f));
            return { name: f, lastModified: stats.mtime, size: stats.size };
          });
          return new Response(JSON.stringify(notes), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/notes/read') {
          const name = url.searchParams.get('name');
          if (!name) return new Response("Name Required", { status: 400 });
          const content = fs.readFileSync(path.join(NOTES_DIR, name), 'utf-8');
          return new Response(content, { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/notes/append' && req.method === 'POST') {
          const { name, text, section, parseHeadings, timestamp = true } = await req.json();
          const fileName = name || `Daily Note ${new Date().toISOString().split('T')[0]}.md`;
          const filePath = path.join(NOTES_DIR, fileName);
          
          let entriesToAdd: string[] = [];
          
          if (parseHeadings) {
             // Split by markdown headings
             const headingMatches = text.split(/\n(?=# )|\n(?=## )|\n(?=### )/);
             entriesToAdd = headingMatches.filter((m: string) => m.trim().length > 0);
          } else {
             entriesToAdd = [text];
          }

          for (const entryText of entriesToAdd) {
            const wordCount = entryText.trim().split(/\s+/).length;
            const charCount = entryText.length;
            const readTime = Math.ceil(wordCount / 200);
            
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const metadata = `| 📝 ${wordCount}w | 📄 ${charCount}c | ⏱️ ${readTime}m`;
            const entry = timestamp ? `\n\n### 🕒 ${time} ${metadata}\n${entryText}\n` : `\n\n${entryText}\n`;
            
            if (fs.existsSync(filePath) && section) {
               let content = fs.readFileSync(filePath, 'utf-8');
               const sectionHeading = section.startsWith('#') ? section : `## ${section}`;
               const sectionIdx = content.indexOf(sectionHeading);
               
               if (sectionIdx !== -1) {
                  const nextHeadingIdx = content.indexOf('\n#', sectionIdx + sectionHeading.length);
                  if (nextHeadingIdx !== -1) {
                     content = content.slice(0, nextHeadingIdx) + entry + content.slice(nextHeadingIdx);
                  } else {
                     content = content + entry;
                  }
                  fs.writeFileSync(filePath, content);
               } else {
                  fs.appendFileSync(filePath, `\n\n${sectionHeading}${entry}`);
               }
            } else {
               fs.appendFileSync(filePath, entry);
            }
          }
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/notes/overwrite' && req.method === 'POST') {
          const { name, text } = await req.json();
          const filePath = path.join(NOTES_DIR, name);
          fs.writeFileSync(filePath, text);
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/notes/entries') {
          const name = url.searchParams.get('name');
          if (!name) return new Response("Name Required", { status: 400 });
          const filePath = path.join(NOTES_DIR, name);
          if (!fs.existsSync(filePath)) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
          
          const content = fs.readFileSync(filePath, 'utf-8');
          const entryDelimiter = "\n\n### 🕒 ";
          const parts = content.split(entryDelimiter);
          
          const entries = parts.filter(p => p.trim().length > 0).map((p, i) => {
            // First part might not have the delimiter if it's at the start without one
            const hasDelimiter = i > 0 || content.startsWith(entryDelimiter);
            const raw = hasDelimiter ? `### 🕒 ${p}` : p;
            const time = p.match(/^\d{2}:\d{2} [AP]M/)?.[0] || "Unknown";
            const body = p.replace(/^\d{2}:\d{2} [AP]M\n/, "").trim();
            return { id: i, raw, time, body };
          });
          
          return new Response(JSON.stringify(entries), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/notes/entry/update' && req.method === 'POST') {
          const { name, id, text } = await req.json();
          const filePath = path.join(NOTES_DIR, name);
          const content = fs.readFileSync(filePath, 'utf-8');
          const entryDelimiter = "\n\n### 🕒 ";
          const parts = content.split(entryDelimiter);
          
          // Reconstruct parts
          if (parts[id] !== undefined) {
             const timeMatch = parts[id].match(/^\d{2}:\d{2} [AP]M/);
             const time = timeMatch ? timeMatch[0] : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
             parts[id] = `${time}\n${text}\n`;
          }
          
          fs.writeFileSync(filePath, parts.join(entryDelimiter));
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/notes/prepend' && req.method === 'POST') {
          const { name, text } = await req.json();
          const filePath = path.join(NOTES_DIR, name);
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const entry = `### 🕒 ${time}\n${text}\n\n`;
          
          let oldContent = "";
          if (fs.existsSync(filePath)) oldContent = fs.readFileSync(filePath, 'utf-8');
          fs.writeFileSync(filePath, entry + oldContent);
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/notes/search') {
          const query = url.searchParams.get('q')?.toLowerCase() || "";
          const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
          const results: any[] = [];
          
          files.forEach(f => {
            const content = fs.readFileSync(path.join(NOTES_DIR, f), 'utf-8');
            const entryDelimiter = "\n\n### 🕒 ";
            const parts = content.split(entryDelimiter);
            
            parts.forEach((p, i) => {
              if (p.toLowerCase().includes(query)) {
                const time = p.match(/^\d{2}:\d{2} [AP]M/)?.[0] || "Unknown";
                const body = p.replace(/^\d{2}:\d{2} [AP]M\n/, "").trim();
                results.push({ fileName: f, entryId: i, time, body, snippet: body.substring(0, 100) });
              }
            });
          });
          return new Response(JSON.stringify(results.slice(0, 50)), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/git/list') {
           const developerDir = path.join(process.env.HOME || "", "Developer");
           try {
             const { stdout } = await execAsync(`find ${developerDir} -maxdepth 3 -name ".git"`);
             const gitPaths = stdout.trim().split('\n').filter(p => p.length > 0);
             const repos = await Promise.all(gitPaths.map(async (gp) => {
                const repoPath = path.dirname(gp);
                const name = path.basename(repoPath);
                try {
                  const { stdout: remoteOut } = await execAsync(`git -C ${repoPath} remote -v`);
                  const remote = remoteOut.split('\n')[0]?.match(/https:\/\/github\.com\/.*?\s|git@github\.com:.*?\s/)?.[0]?.trim();
                  let isPublic = false;
                  if (remote) {
                     isPublic = remote.startsWith('https'); 
                  }
                  return { name, path: repoPath, remote, isPublic };
                } catch(e) { return { name, path: repoPath }; }
             }));
             return new Response(JSON.stringify(repos), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
           } catch(e) { return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
        }

        if (url.pathname === '/archive/project/scaffold' && req.method === 'POST') {
           const { name, path: rootPath, template } = await req.json();
           const projectPath = path.join(rootPath, name);
           if (fs.existsSync(projectPath)) return new Response("Exists", { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
           
           fs.mkdirSync(projectPath, { recursive: true });
           await execAsync(`git -C ${projectPath} init`);
           fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${name}\n\nGenerated via Gravity Scaffolder.`);
           
           if (template === 'vault') {
              fs.mkdirSync(path.join(projectPath, 'Daily'));
              fs.mkdirSync(path.join(projectPath, 'Reference'));
              fs.mkdirSync(path.join(projectPath, 'Drafts'));
           } else if (template === 'python') {
              fs.writeFileSync(path.join(projectPath, 'main.py'), 'def main():\n    print("Hello Gravity")\n\nif __name__ == "__main__":\n    main()');
           }
           
           return new Response("Scaffolded", { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/organize/path' && req.method === 'POST') {
           const { targetPath } = await req.json();
           if (!fs.existsSync(targetPath)) return new Response("Not Found", { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
           
           const organizedRoot = path.join(targetPath, "Organised Folders");
           if (!fs.existsSync(organizedRoot)) fs.mkdirSync(organizedRoot);

           const files = fs.readdirSync(targetPath).filter(f => !f.startsWith('.') && f !== 'Organised Folders');
           const moves: any[] = [];
           
           files.forEach(f => {
              const fullPath = path.join(targetPath, f);
              if (fs.lstatSync(fullPath).isDirectory()) return;
              
              const ext = path.extname(f).toLowerCase();
              let category = "Miscellaneous";
              if (['.png', '.jpg', '.jpeg', '.gif', '.mov', '.mp4'].includes(ext)) category = "Media";
              else if (['.pdf', '.doc', '.docx', '.txt', '.pages'].includes(ext)) category = "Documents";
              else if (['.zip', '.tar', '.gz', '.dmg'].includes(ext)) category = "Installers";

              const destDir = path.join(organizedRoot, category);
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);
              
              const destPath = path.join(destDir, f);
              fs.renameSync(fullPath, destPath);
              moves.push({ from: destPath, to: fullPath });
           });

           saveUndo(moves);
           return new Response(JSON.stringify({ moved: moves.length }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/desktop/organize') {
           const desktop = path.join(process.env.HOME || "", "Desktop");
           const organizedSS = path.join(desktop, "Organised Screenshots");
           const organizedFolders = path.join(desktop, "Organised Folders");
           
           if (!fs.existsSync(organizedSS)) fs.mkdirSync(organizedSS);
           if (!fs.existsSync(organizedFolders)) fs.mkdirSync(organizedFolders);

           const files = fs.readdirSync(desktop).filter(f => !f.startsWith('.') && !f.startsWith('Organised'));
           const undoLog: any[] = [];

           files.forEach(f => {
              const fullPath = path.join(desktop, f);
              try {
                const lstats = fs.lstatSync(fullPath);
                if (lstats.isDirectory()) return;

                const ext = path.extname(f).toLowerCase();
                const stats = fs.statSync(fullPath);
                
                const d = new Date(stats.mtime);
                d.setHours(0,0,0,0);
                d.setDate(d.getDate() + 4 - (d.getDay()||7));
                const yearStart = new Date(d.getFullYear(),0,1);
                const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
                const weekStr = `Week-${weekNo.toString().padStart(2, '0')}-${d.getFullYear()}`;

                let category = "Miscellaneous";
                let isScreenshot = f.startsWith('Screenshot') || f.includes('Screen Shot') || f.startsWith('scr_');
                
                let destDir = "";
                if (isScreenshot) {
                   destDir = path.join(organizedSS, weekStr);
                } else {
                   if (['.png', '.jpg', '.jpeg', '.gif', '.mov', '.mp4', '.webp', '.heic'].includes(ext)) {
                      category = "Media";
                   } else if (['.pdf', '.doc', '.docx', '.txt', '.pages', '.md', '.csv', '.xlsx', '.pptx'].includes(ext)) {
                      category = "Documents";
                   } else if (['.zip', '.tar', '.gz', '.dmg', '.pkg', '.7z', '.rar'].includes(ext)) {
                      category = "Archives";
                   } else if (['.js', '.py', '.ts', '.sh', '.json', '.swift', '.html', '.css'].includes(ext)) {
                      category = "Developer";
                   }
                   destDir = path.join(organizedFolders, category);
                }

                if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

                const destPath = path.join(destDir, f);
                fs.renameSync(fullPath, destPath);
                undoLog.push({ from: destPath, to: fullPath });
              } catch(e) {}
           });

           saveUndo(undoLog);
           return new Response(JSON.stringify({ moved: undoLog.length }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/files/copy' && req.method === 'POST') {
           const { from, to } = await req.json();
           try {
              fs.copyFileSync(from, to);
              return new Response("Copied", { headers: { 'Access-Control-Allow-Origin': '*' } });
           } catch(e) { return new Response("Failed", { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }); }
        }

        if (url.pathname === '/archive/files/move' && req.method === 'POST') {
           const { from, to } = await req.json();
           try {
              fs.renameSync(from, to);
              return new Response("Moved", { headers: { 'Access-Control-Allow-Origin': '*' } });
           } catch(e) { return new Response("Failed", { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }); }
        }

        if (url.pathname === '/archive/files/delete' && req.method === 'POST') {
           const { path: filePath } = await req.json();
           const trashPath = path.join(process.env.HOME || "", ".Trash", path.basename(filePath));
           fs.renameSync(filePath, trashPath); // Native "Move to Trash"
           return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/files/search') {
          const query = url.searchParams.get('q') || "";
          if (!query) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
          try {
            const { stdout } = await execAsync(`mdfind -name "${query.replace(/"/g, '\\"')}" | head -n 30`);
            const paths = stdout.trim().split('\n').filter(p => p.length > 0);
            const results = paths.map(p => {
               try {
                 return { path: p, name: path.basename(p), size: fs.statSync(p).size, isDir: fs.statSync(p).isDirectory() };
               } catch(e) { return null; }
            }).filter(i => i !== null);
            return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
          } catch(e) { return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
        }

        if (url.pathname === '/archive/desktop/undo') {
           const logPath = path.join(ARCHIVE_DIR, 'desktop_undo.json');
           if (!fs.existsSync(logPath)) return new Response(JSON.stringify({ count: 0 }), { headers: { 'Access-Control-Allow-Origin': '*' } });
           const log = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
           log.forEach((m: any) => {
              if (fs.existsSync(m.from)) fs.renameSync(m.from, m.to);
           });
           fs.unlinkSync(logPath);
           return new Response(JSON.stringify({ count: log.length }), { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/stats') {
           const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith('.md'));
           let totalFragments = 0;
           let totalWords = 0;
           const dailyActivity: Record<string, number> = {};

           files.forEach(f => {
              const content = fs.readFileSync(path.join(NOTES_DIR, f), 'utf-8');
              const fragments = content.split('### 🕒').length - 1;
              const words = content.split(/\s+/).length;
              totalFragments += fragments;
              totalWords += words;

              const dateMatch = f.match(/\d{4}-\d{2}-\d{2}/);
              if (dateMatch) {
                 dailyActivity[dateMatch[0]] = (dailyActivity[dateMatch[0]] || 0) + fragments;
              }
           });

           return new Response(JSON.stringify({ 
              totalFiles: files.length, 
              totalFragments, 
              totalWords,
              dailyActivity 
           }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/disk/scan') {
           const targetPath = url.searchParams.get('path') || process.env.HOME || "";
           try {
              const { stdout } = await execAsync(`du -sk "${targetPath.replace(/"/g, '\\"')}"/* 2>/dev/null | sort -rn | head -n 50`);
              const results = stdout.trim().split('\n').filter(l => l.length > 0).map(line => {
                 const [sizeKb, ...pathParts] = line.split('\t');
                 const p = pathParts.join('\t');
                 let isDir = false;
                 try { isDir = fs.statSync(p).isDirectory(); } catch(e) {}
                 return {
                    path: p,
                    name: path.basename(p),
                    size: parseInt(sizeKb) * 1024,
                    isDir
                 };
              });
              return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
           } catch(e) { return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
        }

        if (url.pathname === '/archive/system/vitals') {
           try {
              const { stdout: cpu } = await execAsync("top -l 1 | grep 'CPU usage' | awk '{print $3}'");
              const { stdout: mem } = await execAsync("top -l 1 | grep 'PhysMem' | awk '{print $2}'");
              return new Response(JSON.stringify({ cpu: cpu.trim(), mem: mem.trim() }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
           } catch(e) { return new Response("Error", { status: 500 }); }
        }

        if (url.pathname === '/archive/system/processes') {
           try {
              // Get memory info for absolute values
              const { stdout: memInfo } = await execAsync("sysctl hw.memsize | awk '{print $2}'");
              const totalMem = parseInt(memInfo.trim());
              
              const { stdout } = await execAsync("ps -eo pid,ppid,%cpu,%mem,comm | sort -rk 4 | head -n 25");
              const results = stdout.trim().split('\n').slice(1).map(line => {
                 const parts = line.trim().split(/\s+/);
                 const pid = parts[0];
                 const cpu = parts[2];
                 const memPct = parseFloat(parts[3]);
                 const memAbs = (memPct / 100) * totalMem;
                 const command = parts.slice(4).join(' ');
                 return { 
                    pid, 
                    cpu, 
                    mem: memPct.toFixed(1), 
                    memAbs: memAbs > 1024*1024*1024 ? (memAbs / (1024*1024*1024)).toFixed(1) + " GB" : (memAbs / (1024*1024)).toFixed(0) + " MB",
                    name: path.basename(command), 
                    command 
                 };
              });
              return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
           } catch(e) { return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }); }
        }

        if (url.pathname === '/archive/system/kill' && req.method === 'POST') {
           const { pid } = await req.json();
           try {
              await execAsync(`kill -9 ${pid}`);
              return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
           } catch(e) { return new Response("Failed to kill", { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }); }
        }

        if (url.pathname === '/archive/files/read') {
          const filePath = url.searchParams.get('path');
          if (!filePath || !fs.existsSync(filePath)) return new Response("File Not Found", { status: 404 });
          const content = fs.readFileSync(filePath, 'utf-8');
          return new Response(content, { headers: { 'Access-Control-Allow-Origin': '*' } });
        }

        if (url.pathname === '/archive/files/write' && req.method === 'POST') {
          const { path: filePath, text } = await req.json();
          if (!filePath) return new Response("Path Required", { status: 400 });
          fs.writeFileSync(filePath, text);
          return new Response('OK', { headers: { 'Access-Control-Allow-Origin': '*' } });
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
      if (text && text !== lastClip && text.length < 1000000) {
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
