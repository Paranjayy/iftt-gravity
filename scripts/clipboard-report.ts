// Builds scratch/clipboard-report.html from a rayconfig-clips JSONL.
// PRIVACY: only aggregates are embedded (counts, histograms, domain names).
// No clip text, no URLs, no filenames leave this machine. Fully offline page.
import { readdir } from "node:fs/promises";

const files = (await readdir("gravity-archive")).filter((f) => f.startsWith("rayconfig-clips-") && f.endsWith(".jsonl")).sort();
if (!files.length) throw new Error("no rayconfig-clips JSONL in gravity-archive/");
const src = `gravity-archive/${files[files.length - 1]}`;
const lines = (await Bun.file(src).text()).trim().split("\n");

let textN = 0, imgN = 0, chars = 0, words = 0;
let biggest = { len: 0, ts: "" };
const months: Record<string, number> = {};
const buckets = { "<100": 0, "100-500": 0, "500-2k": 0, "2k-10k": 0, ">10k": 0 };
const dom: Record<string, number> = {};
let urlN = 0, codeN = 0;

for (const l of lines) {
  const e = JSON.parse(l);
  if (e.kind !== "text") { imgN++; continue; }
  textN++;
  const c: number = e.text.length;
  chars += c;
  words += e.text.split(/\s+/).filter(Boolean).length;
  if (c > biggest.len) biggest = { len: c, ts: e.createdAt };
  const m = (e.createdAt || "").slice(0, 7);
  if (m) months[m] = (months[m] || 0) + 1;
  buckets[c < 100 ? "<100" : c < 500 ? "100-500" : c < 2000 ? "500-2k" : c < 10000 ? "2k-10k" : ">10k"]++;
  const us: string[] = e.text.match(/https?:\/\/([a-zA-Z0-9.-]+)/g) || [];
  urlN += us.length;
  for (const u of us) {
    const d = u.replace(/https?:\/\//, "").toLowerCase();
    dom[d] = (dom[d] || 0) + 1;
  }
  if (/```|function |const .*=|import .*from|def |class /.test(e.text)) codeN++;
}

const data = {
  generatedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  source: src,
  total: lines.length, textN, imgN, chars, words,
  avg: Math.round(chars / Math.max(1, textN)),
  biggest, months, buckets, urlN, codeN,
  topDomains: Object.entries(dom).sort((a, b) => b[1] - a[1]).slice(0, 15),
};

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clipboard Rescue — stats</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box;margin:0}
body{background:#0b0b10;color:#e8e8ef;font:14px/1.5 -apple-system,Helvetica,Arial,sans-serif;padding:28px;max-width:960px;margin:auto}
h1{font-size:22px;margin-bottom:2px}h2{font-size:15px;margin:26px 0 10px;color:#b9b9c7;text-transform:uppercase;letter-spacing:.06em}
.sub{color:#8a8a99;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.card{background:#15151d;border:1px solid #262633;border-radius:12px;padding:12px 14px}
.card b{display:block;font-size:22px}.card span{color:#8a8a99;font-size:12px}
canvas{background:#15151d;border:1px solid #262633;border-radius:12px;width:100%}
table{width:100%;border-collapse:collapse;background:#15151d;border-radius:12px;overflow:hidden}
td,th{padding:8px 12px;text-align:left;border-bottom:1px solid #23232e;font-size:13px}
th{color:#8a8a99;font-weight:600}tr:last-child td{border-bottom:0}
.bar{height:8px;background:#262633;border-radius:4px;overflow:hidden;min-width:120px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#3cc8f0)}
.note{margin-top:26px;color:#6d6d7d;font-size:12px}
</style></head><body>
<h1>📋 Clipboard Rescue — stats</h1>
<div class="sub">generated ${data.generatedAt} · source ${data.source} · aggregates only, zero clip content</div>
<div class="grid">
<div class="card"><b>${data.total.toLocaleString()}</b><span>entries</span></div>
<div class="card"><b>${data.textN.toLocaleString()}</b><span>text clips</span></div>
<div class="card"><b>${data.imgN}</b><span>images</span></div>
<div class="card"><b>${(data.chars / 1e6).toFixed(1)}M</b><span>chars</span></div>
<div class="card"><b>${(data.words / 1e6).toFixed(2)}M</b><span>words</span></div>
<div class="card"><b>${data.avg.toLocaleString()}</b><span>avg chars/clip</span></div>
<div class="card"><b>${data.urlN.toLocaleString()}</b><span>url mentions</span></div>
<div class="card"><b>${data.codeN}</b><span>code-looking</span></div>
<div class="card"><b>${data.biggest.len.toLocaleString()}</b><span>biggest clip (${data.biggest.ts.slice(0, 10)})</span></div>
</div>
<h2>Per month</h2><canvas id="m" height="150"></canvas>
<h2>Clip length buckets</h2><canvas id="b" height="130"></canvas>
<h2>Top domains (mentions, not links)</h2>
<table><tr><th>domain</th><th>mentions</th><th></th></tr>
${data.topDomains.map(([d, c]) => `<tr><td>${d}</td><td>${c.toLocaleString()}</td><td><div class="bar"><i style="width:${Math.round((c / (data.topDomains[0]?.[1] ?? 1)) * 100)}%"></i></div></td></tr>`).join("")}
</table>
<div class="note">local file · no network · no clip text embedded — regenerate with <code>bun scripts/clipboard-report.ts</code></div>
<script>
const D=${JSON.stringify({ months: data.months, buckets: data.buckets })};
function bars(id,obj,color){const c=document.getElementById(id),x=c.getContext("2d"),ks=Object.keys(obj),vs=ks.map(k=>obj[k]),mx=Math.max(...vs,1),W=c.width=c.offsetWidth*2,H=c.height;const bw=W/ks.length;x.fillStyle="#8a8a99";x.font="20px sans-serif";ks.forEach((k,i)=>{const h=(H-40)*(vs[i]/mx),px=i*bw+bw*0.2;const g=x.createLinearGradient(0,H,0,H-h);g.addColorStop(0,"#7c5cff");g.addColorStop(1,"#3cc8f0");x.fillStyle=g;x.fillRect(px,H-28,bw*0.6,h);x.fillStyle="#8a8a99";x.fillText(String(vs[i]),px,H-30);x.fillText(k.slice(2),px,H-8);});}
bars("m",D.months);bars("b",D.buckets);
</script></body></html>`;

await Bun.write("scratch/clipboard-report.html", html);
console.log(`wrote scratch/clipboard-report.html from ${src} (${lines.length} entries aggregated, 0 content embedded)`);
