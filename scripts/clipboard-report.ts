// Builds scratch/clipboard-report.html — analyzes ANY rayconfig-clips JSONL.
// v2: embedded latest-file aggregates + drag-drop picker that computes the same
// stats client-side in chunks. PRIVACY: aggregates only, zero clip content ever
// displayed or embedded. Fully offline.
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
const heat: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
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
  const d = new Date(e.createdAt);
  if (!isNaN(+d)) heat[d.getDay()][d.getHours()]++;
  const us: string[] = e.text.match(/https?:\/\/([a-zA-Z0-9.-]+)/g) || [];
  urlN += us.length;
  for (const u of us) {
    const dd = u.replace(/https?:\/\//, "").toLowerCase();
    dom[dd] = (dom[dd] || 0) + 1;
  }
  if (/```|function |const .*=|import .*from|def |class /.test(e.text)) codeN++;
}

const seed = {
  source: src, total: lines.length, textN, imgN, chars, words,
  avg: Math.round(chars / Math.max(1, textN)),
  biggest, months, buckets, heat, urlN, codeN,
  topDomains: Object.entries(dom).sort((a, b) => b[1] - a[1]).slice(0, 15),
};

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clipboard Rescue — analyzer</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box;margin:0}
body{background:#0b0b10;color:#e8e8ef;font:14px/1.5 -apple-system,Helvetica,Arial,sans-serif;padding:28px;max-width:1000px;margin:auto}
h1{font-size:22px}h2{font-size:14px;margin:26px 0 10px;color:#b9b9c7;text-transform:uppercase;letter-spacing:.06em}
.sub{color:#8a8a99;margin:2px 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.card{background:#15151d;border:1px solid #262633;border-radius:12px;padding:12px 14px}
.card b{display:block;font-size:22px}.card span{color:#8a8a99;font-size:12px}
canvas{background:#15151d;border:1px solid #262633;border-radius:12px;width:100%}
table{width:100%;border-collapse:collapse;background:#15151d;border-radius:12px;overflow:hidden}
td,th{padding:8px 12px;text-align:left;border-bottom:1px solid #23232e;font-size:13px}
th{color:#8a8a99}tr:last-child td{border-bottom:0}
.bar{height:8px;background:#262633;border-radius:4px;overflow:hidden;min-width:120px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#3cc8f0)}
#drop{border:2px dashed #3a3a4a;border-radius:12px;padding:22px;text-align:center;color:#8a8a99;margin-top:8px;cursor:pointer}
#drop.over{border-color:#7c5cff;color:#e8e8ef}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}
button{background:#23232e;color:#e8e8ef;border:1px solid #343442;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}
button:hover{border-color:#7c5cff}
.note{margin-top:26px;color:#6d6d7d;font-size:12px}
.heat{display:grid;grid-template-columns:36px repeat(24,1fr);gap:2px;font-size:10px;color:#8a8a99;align-items:center}
.heat div{min-height:14px;border-radius:3px;text-align:center}
</style></head><body>
<h1>📋 Clipboard Rescue — analyzer</h1>
<div class="sub" id="src"></div>
<div id="cards" class="grid"></div>
<h2>Per month</h2><canvas id="m" height="150"></canvas>
<h2>Clip length buckets</h2><canvas id="b" height="130"></canvas>
<h2>Copy heatmap (weekday × hour)</h2><div class="heat" id="h"></div>
<h2>Top domains (mentions, not links)</h2><table id="t"></table>
<div class="row">
<button id="dl">Download aggregates JSON</button>
<label for="file" style="cursor:pointer"><span style="background:#23232e;border:1px solid #343442;border-radius:8px;padding:8px 14px;font-size:13px">Analyze another JSONL…</span></label>
<input type="file" id="file" accept=".jsonl" style="display:none">
</div>
<div id="drop">…or drop any <code>rayconfig-clips-*.jsonl</code> here — parsed locally in chunks, content never displayed</div>
<div class="note">local file · no network · zero clip text embedded or shown — regenerate with <code>bun scripts/clipboard-report.ts</code></div>
<script>
let D=${JSON.stringify(seed)};
const $=id=>document.getElementById(id);
function draw(){
  $("src").textContent="source "+D.source+" · "+D.total.toLocaleString()+" entries · aggregates only, zero clip content";
  const C=[["entries",D.total],["text clips",D.textN],["images",D.imgN],["chars",(D.chars/1e6).toFixed(1)+"M"],["words",(D.words/1e6).toFixed(2)+"M"],["avg chars/clip",D.avg.toLocaleString()],["url mentions",D.urlN.toLocaleString()],["code-looking",D.codeN],["biggest clip",D.biggest.len.toLocaleString()+" ("+D.biggest.ts.slice(0,10)+")"]];
  $("cards").innerHTML=C.map(([s,b])=>'<div class="card"><b>'+b+'</b><span>'+s+'</span></div>').join("");
  bars("m",D.months,v=>v);bars("b",D.buckets,v=>v);
  const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],mx=Math.max(1,...D.heat.flat());
  $("h").innerHTML=days.map((d,i)=>'<div>'+d+'</div>'+D.heat[i].map(v=>'<div title="'+v+'" style="background:rgba(124,92,255,'+(0.06+0.94*v/mx).toFixed(2)+')"></div>').join("")).join("");
  $("t").innerHTML="<tr><th>domain</th><th>mentions</th><th></th></tr>"+D.topDomains.map(([d,c])=>"<tr><td>"+d+"</td><td>"+c.toLocaleString()+'</td><td><div class="bar"><i style="width:'+Math.round(c/D.topDomains[0][1]*100)+'%"></i></div></td></tr>').join("");
}
function bars(id,obj){const c=$(id),dpr=window.devicePixelRatio||1,W=c.clientWidth,H=parseInt(c.getAttribute("height")),ks=Object.keys(obj),vs=ks.map(k=>obj[k]),mx=Math.max(...vs,1);c.width=W*dpr;c.height=H*dpr;const x=c.getContext("2d");x.scale(dpr,dpr);const bw=W/ks.length;x.font="11px sans-serif";ks.forEach((k,i)=>{const h=(H-44)*(vs[i]/mx),px=i*bw+bw*0.2;const g=x.createLinearGradient(0,H,0,H-h);g.addColorStop(0,"#7c5cff");g.addColorStop(1,"#3cc8f0");x.fillStyle=g;x.fillRect(px,H-30,Math.max(2,bw*0.6),h);x.fillStyle="#b9b9c7";x.fillText(String(vs[i]),px,H-32);x.fillStyle="#8a8a99";x.fillText(k.slice(2),px,H-10);});}
window.addEventListener("resize",draw);
$("dl").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,1)],{type:"application/json"}));a.download="clipboard-aggregates.json";a.click();};
async function analyzeFile(f){
  $("src").textContent="parsing "+f.name+" …";
  const N={source:f.name,total:0,textN:0,imgN:0,chars:0,words:0,avg:0,biggest:{len:0,ts:""},months:{},buckets:{"<100":0,"100-500":0,"500-2k":0,"2k-10k":0,">10k":0},heat:Array.from({length:7},()=>new Array(24).fill(0)),urlN:0,codeN:0,topDomains:[]};
  const dom={},CH=65536;let off=0,tail="";
  while(off<f.size){const chunk=await f.slice(off,off+CH).text();off+=CH;const parts=(tail+chunk).split("\\n");tail=parts.pop();
    for(const l of parts){if(!l.trim())continue;let e;try{e=JSON.parse(l)}catch{continue}N.total++;
      if(e.kind!=="text"){N.imgN++;continue}N.textN++;const t=e.text||"",c=t.length;N.chars+=c;N.words+=t.split(/\\s+/).filter(Boolean).length;
      if(c>N.biggest.len)N.biggest={len:c,ts:e.createdAt||""};
      const m=(e.createdAt||"").slice(0,7);if(m)N.months[m]=(N.months[m]||0)+1;
      N.buckets[c<100?"<100":c<500?"100-500":c<2000?"500-2k":c<10000?"2k-10k":">10k"]++;
      const d=new Date(e.createdAt);if(!isNaN(+d))N.heat[d.getDay()][d.getHours()]++;
      const us=t.match(/https?:\\/\\/([a-zA-Z0-9.-]+)/g)||[];N.urlN+=us.length;
      for(const u of us){const dd=u.replace(/https?:\\/\\//,"").toLowerCase();dom[dd]=(dom[dd]||0)+1}
      if(/\`\`\`|function |const .*=|import .*from|def |class /.test(t))N.codeN++;}
    $("src").textContent="parsing "+f.name+" … "+N.total.toLocaleString()+" rows";}
  N.avg=Math.round(N.chars/Math.max(1,N.textN));
  N.topDomains=Object.entries(dom).sort((a,b)=>b[1]-a[1]).slice(0,15);
  D=N;draw();
}
const dz=$("drop");
["dragover","dragenter"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("over")}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("over")}));
dz.addEventListener("drop",e=>{if(e.dataTransfer.files[0])analyzeFile(e.dataTransfer.files[0])});
dz.onclick=()=>$("file").click();
$("file").onchange=e=>{if(e.target.files[0])analyzeFile(e.target.files[0])};
draw();
</script></body></html>`;

await Bun.write("scratch/clipboard-report.html", html);
console.log(`wrote scratch/clipboard-report.html (seed: ${src}, zero content embedded)`);
