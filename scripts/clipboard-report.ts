// Builds scratch/clipboard-report.html — analyzes ANY rayconfig-clips JSONL.
// v3: speedtest-style gauges, daily area chart, streaks, chips, heatmap.
// PRIVACY: aggregates only, zero clip content ever displayed or embedded.
import { readdir } from "node:fs/promises";

const files = (await readdir("gravity-archive")).filter((f) => f.startsWith("rayconfig-clips-") && f.endsWith(".jsonl")).sort();
if (!files.length) throw new Error("no rayconfig-clips JSONL in gravity-archive/");
const src = `gravity-archive/${files[files.length - 1]}`;
const lines = (await Bun.file(src).text()).trim().split("\n");

let textN = 0, imgN = 0, chars = 0, words = 0;
let biggest = { len: 0, ts: "" };
const months: Record<string, number> = {};
const daily: Record<string, number> = {};
const buckets = { "<100": 0, "100-500": 0, "500-2k": 0, "2k-10k": 0, ">10k": 0 };
const dom: Record<string, number> = {};
const heat: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
const hourTot = new Array(24).fill(0);
const dayTot = new Array(7).fill(0);
let urlN = 0, codeN = 0, linkClips = 0;

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
  const day = (e.createdAt || "").slice(0, 10);
  if (day) daily[day] = (daily[day] || 0) + 1;
  buckets[c < 100 ? "<100" : c < 500 ? "100-500" : c < 2000 ? "500-2k" : c < 10000 ? "2k-10k" : ">10k"]++;
  const d = new Date(e.createdAt);
  if (!isNaN(+d)) { heat[d.getDay()][d.getHours()]++; hourTot[d.getHours()]++; dayTot[d.getDay()]++; }
  const hasLink = /https?:\/\//.test(e.text);
  if (hasLink) linkClips++;
  const us: string[] = e.text.match(/https?:\/\/([a-zA-Z0-9.-]+)/g) || [];
  urlN += us.length;
  for (const u of us) {
    const dd = u.replace(/https?:\/\//, "").toLowerCase();
    dom[dd] = (dom[dd] || 0) + 1;
  }
  if (/```|function |const .*=|import .*from|def |class /.test(e.text)) codeN++;
}

const days = Object.keys(daily).sort();
const peakDay = days.reduce((a, b) => (daily[a] >= daily[b] ? a : b), days[0] ?? "");
let streak = 0, best = 0, prev = "";
for (const d of days) {
  const diff = prev ? Math.round((+new Date(d) - +new Date(prev)) / 86400000) : 1;
  streak = diff === 1 ? streak + 1 : 1;
  best = Math.max(best, streak);
  prev = d;
}
const spanDays = days.length ? Math.max(1, Math.round((+new Date(days[days.length - 1]) - +new Date(days[0])) / 86400000) + 1) : 1;
const topHour = hourTot.indexOf(Math.max(...hourTot));
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const topDay = WD[dayTot.indexOf(Math.max(...dayTot))];
const last90 = days.slice(-90);

const seed = {
  source: src, total: lines.length, textN, imgN, chars, words,
  avg: Math.round(chars / Math.max(1, textN)),
  avgPerDay: Math.round((lines.length / spanDays) * 10) / 10,
  biggest, months, buckets, heat, urlN, codeN, linkClips,
  peakDay, peakDayN: daily[peakDay] ?? 0, streak: best, spanDays,
  topHour, topDay, readHrs: Math.round((words / 200 / 60) * 10) / 10,
  topDomains: Object.entries(dom).sort((a, b) => b[1] - a[1]).slice(0, 12),
  daily: Object.fromEntries(last90.map((d) => [d, daily[d]])),
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
.gauges{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.gauge{background:#15151d;border:1px solid #262633;border-radius:12px;padding:14px;text-align:center}
.gauge svg{width:100%;max-width:220px}
.gauge .v{font-size:26px;font-weight:700;margin-top:-64px}.gauge .l{color:#3cc8f0;font-size:12px;margin-top:2px}.gauge .s{color:#8a8a99;font-size:11px;margin-top:6px}
canvas{background:#15151d;border:1px solid #262633;border-radius:12px;width:100%}
table{width:100%;border-collapse:collapse;background:#15151d;border-radius:12px;overflow:hidden}
td,th{padding:8px 12px;text-align:left;border-bottom:1px solid #23232e;font-size:13px}
th{color:#8a8a99}tr:last-child td{border-bottom:0}
.bar{height:8px;background:#262633;border-radius:4px;overflow:hidden;min-width:120px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#3cc8f0)}
.chips{background:#15151d;border:1px solid #262633;border-radius:12px;padding:14px}
.chips .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
.chips .k{color:#8a8a99;font-size:12px;width:110px}
.chip{background:#1d2f3a;border:1px solid #2b4a5c;color:#7fd4f5;border-radius:8px;padding:4px 10px;font-size:12px}
.chip.hot{background:#2c2340;border-color:#5b4a8a;color:#c9b8ff}
#drop{border:2px dashed #3a3a4a;border-radius:12px;padding:22px;text-align:center;color:#8a8a99;margin-top:8px;cursor:pointer}
#drop.over{border-color:#7c5cff;color:#e8e8ef}
.rowbtn{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
button{background:#23232e;color:#e8e8ef;border:1px solid #343442;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px}
button:hover{border-color:#7c5cff}
.note{margin-top:26px;color:#6d6d7d;font-size:12px}
.heat{display:grid;grid-template-columns:36px repeat(24,1fr);gap:2px;font-size:10px;color:#8a8a99;align-items:center}
.heat div{min-height:14px;border-radius:3px;text-align:center}
</style></head><body>
<h1>📋 Clipboard Rescue — analyzer</h1>
<div class="sub" id="src"></div>
<div class="gauges" id="gauges"></div>
<div id="cards" class="grid" style="margin-top:10px"></div>
<h2>Copies over time (last 90 days)</h2><canvas id="area" height="150"></canvas>
<h2>Content mix</h2><div class="chips" id="mix"></div>
<h2>Copy heatmap (weekday × hour)</h2><div class="heat" id="h"></div>
<h2>Top domains (mentions, not links)</h2><table id="t"></table>
<div class="rowbtn">
<button id="dl">Download aggregates JSON</button>
<label for="file" style="cursor:pointer"><span style="background:#23232e;border:1px solid #343442;border-radius:8px;padding:8px 14px;font-size:13px">Analyze another JSONL…</span></label>
<input type="file" id="file" accept=".jsonl" style="display:none">
</div>
<div id="drop">…or drop any <code>rayconfig-clips-*.jsonl</code> here — parsed locally in chunks, content never displayed</div>
<div class="note">local file · no network · zero clip text embedded or shown — regenerate with <code>bun scripts/clipboard-report.ts</code></div>
<script>
let D=${JSON.stringify(seed)};
const $=id=>document.getElementById(id);
function arc(pct,c1,c2){const a=Math.PI*(1-Math.min(100,Math.max(0,pct))/100),x1=20+80*Math.cos(Math.PI),y1=100-80*Math.sin(Math.PI),x2=20+80*Math.cos(a),y2=100-80*Math.sin(a),la=pct>50?1:0;return '<svg viewBox="0 0 200 110"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#262633" stroke-width="12" stroke-linecap="round"/><path d="M20 100 A80 80 0 0 1 '+x2.toFixed(1)+' '+y2.toFixed(1)+'" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round"/><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient></defs></svg>';}
function draw(){
  $("src").textContent="source "+D.source+" · "+D.total.toLocaleString()+" entries · aggregates only, zero clip content";
  const peakPct=Math.min(100,Math.round(D.peakDayN/Math.max(1,D.avgPerDay*3)*100));
  $("gauges").innerHTML=
    '<div class="gauge">'+arc(Math.min(100,D.avgPerDay/50*100),"#3cc8f0","#7c5cff")+'<div class="v">'+D.avgPerDay+'</div><div class="l">clips / day</div><div class="s">peak '+D.peakDayN+' on '+D.peakDay+'</div></div>'+
    '<div class="gauge">'+arc(D.textN/Math.max(1,D.total)*100,"#3cc8f0","#7c5cff")+'<div class="v">'+Math.round(D.textN/Math.max(1,D.total)*100)+'%</div><div class="l">prose</div><div class="s">'+D.imgN+' images · '+D.codeN+' code · '+D.linkClips+' links</div></div>'+
    '<div class="gauge">'+arc(Math.min(100,D.streak/30*100),"#7c5cff","#e63cc8")+'<div class="v">'+D.streak+'d</div><div class="l">longest copy streak</div><div class="s">busiest '+D.topDay+'s @ '+D.topHour+':00 · '+D.readHrs+'h of reading</div></div>';
  const C=[["words",(D.words/1e6).toFixed(2)+"M"],["avg chars/clip",D.avg.toLocaleString()],["url mentions",D.urlN.toLocaleString()],["biggest clip",D.biggest.len.toLocaleString()+" ("+D.biggest.ts.slice(0,10)+")"]];
  $("cards").innerHTML=C.map(([s,b])=>'<div class="card"><b>'+b+'</b><span>'+s+'</span></div>').join("");
  area("area",D.daily);
  const pct=n=>Math.round(n/Math.max(1,D.total)*100);
  $("mix").innerHTML='<div class="row"><span class="k">Text</span><span class="chip hot">'+pct(D.textN)+'%</span><span class="k">Images</span><span class="chip">'+D.imgN+'</span><span class="k">Code</span><span class="chip">'+D.codeN+'</span><span class="k">Links</span><span class="chip">'+D.linkClips+'</span></div><div class="row"><span class="k">Top domains</span>'+D.topDomains.slice(0,6).map(([d,c])=>'<span class="chip">'+d+' · '+c.toLocaleString()+'</span>').join("")+'</div>';
  const days=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],mx=Math.max(1,...D.heat.flat());
  $("h").innerHTML=days.map((d,i)=>'<div>'+d+'</div>'+D.heat[i].map(v=>'<div title="'+v+'" style="background:rgba(124,92,255,'+(0.06+0.94*v/mx).toFixed(2)+')"></div>').join("")).join("");
  $("t").innerHTML="<tr><th>domain</th><th>mentions</th><th></th></tr>"+D.topDomains.map(([d,c])=>"<tr><td>"+d+"</td><td>"+c.toLocaleString()+'</td><td><div class="bar"><i style="width:'+Math.round(c/D.topDomains[0][1]*100)+'%"></i></div></td></tr>').join("");
}
function area(id,obj){const c=$(id),dpr=window.devicePixelRatio||1,W=c.clientWidth,H=parseInt(c.getAttribute("height")),ks=Object.keys(obj),vs=ks.map(k=>obj[k]),pk=Math.max(...vs,1);c.width=W*dpr;c.height=H*dpr;const x=c.getContext("2d");x.scale(dpr,dpr);x.beginPath();x.moveTo(0,H-24);vs.forEach((v,i)=>{const px=i/(Math.max(1,vs.length-1))*W,py=(H-30)-(H-56)*(v/pk);x.lineTo(px,py)});x.lineTo(W,H-24);x.closePath();const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,"rgba(124,92,255,.55)");g.addColorStop(1,"rgba(124,92,255,.04)");x.fillStyle=g;x.fill();x.beginPath();vs.forEach((v,i)=>{const px=i/(Math.max(1,vs.length-1))*W,py=(H-30)-(H-56)*(v/pk);i?x.lineTo(px,py):x.moveTo(px,py)});x.strokeStyle="#7c5cff";x.lineWidth=2;x.stroke();const pi=vs.indexOf(pk);x.fillStyle="#fff";x.beginPath();x.arc(pi/(Math.max(1,vs.length-1))*W,(H-30)-(H-56),4,0,7);x.fill();x.fillStyle="#b9b9c7";x.font="11px sans-serif";x.fillText("peak "+pk+" · "+ks[pi],8,14);x.fillText(ks[0]||"",8,H-8);x.fillText(ks[ks.length-1]||"",W-70,H-8);}
window.addEventListener("resize",draw);
$("dl").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,1)],{type:"application/json"}));a.download="clipboard-aggregates.json";a.click();};
async function analyzeFile(f){
  $("src").textContent="parsing "+f.name+" …";
  const N={source:f.name,total:0,textN:0,imgN:0,chars:0,words:0,avg:0,avgPerDay:0,biggest:{len:0,ts:""},months:{},buckets:{},heat:Array.from({length:7},()=>new Array(24).fill(0)),urlN:0,codeN:0,linkClips:0,peakDay:"",peakDayN:0,streak:0,spanDays:1,topHour:0,topDay:"",readHrs:0,topDomains:[],daily:{}};
  const dom={},CH=65536;let off=0,tail="";const HT=new Array(24).fill(0),DT=new Array(7).fill(0);
  while(off<f.size){const chunk=await f.slice(off,off+CH).text();off+=CH;const parts=(tail+chunk).split("\\n");tail=parts.pop();
    for(const l of parts){if(!l.trim())continue;let e;try{e=JSON.parse(l)}catch{continue}N.total++;
      if(e.kind!=="text"){N.imgN++;continue}N.textN++;const t=e.text||"",c=t.length;N.chars+=c;N.words+=t.split(/\\s+/).filter(Boolean).length;
      if(c>N.biggest.len)N.biggest={len:c,ts:e.createdAt||""};
      const m=(e.createdAt||"").slice(0,7);if(m)N.months[m]=(N.months[m]||0)+1;
      const dy=(e.createdAt||"").slice(0,10);if(dy)N.daily[dy]=(N.daily[dy]||0)+1;
      const d=new Date(e.createdAt);if(!isNaN(+d)){N.heat[d.getDay()][d.getHours()]++;HT[d.getHours()]++;DT[d.getDay()]++;}
      if(/https?:\\/\\//.test(t))N.linkClips++;
      const us=t.match(/https?:\\/\\/([a-zA-Z0-9.-]+)/g)||[];N.urlN+=us.length;
      for(const u of us){const dd=u.replace(/https?:\\/\\//,"").toLowerCase();dom[dd]=(dom[dd]||0)+1}
      if(/\`\`\`|function |const .*=|import .*from|def |class /.test(t))N.codeN++;}
    $("src").textContent="parsing "+f.name+" … "+N.total.toLocaleString()+" rows";}
  N.avg=Math.round(N.chars/Math.max(1,N.textN));
  N.topDomains=Object.entries(dom).sort((a,b)=>b[1]-a[1]).slice(0,12);
  const ds=Object.keys(N.daily).sort();N.peakDay=ds.reduce((a,b)=>N.daily[a]>=N.daily[b]?a:b,ds[0]||"");N.peakDayN=N.daily[N.peakDay]||0;
  let st=0,bs=0,pv="";for(const d of ds){const df=pv?Math.round((+new Date(d)-+new Date(pv))/86400000):1;st=df===1?st+1:1;bs=Math.max(bs,st);pv=d}N.streak=bs;
  N.spanDays=ds.length?Math.max(1,Math.round((+new Date(ds[ds.length-1])-+new Date(ds[0]))/86400000)+1):1;
  N.avgPerDay=Math.round(N.total/N.spanDays*10)/10;N.topHour=HT.indexOf(Math.max(...HT));
  const WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];N.topDay=WD[DT.indexOf(Math.max(...DT))];
  N.readHrs=Math.round(N.words/200/60*10)/10;N.daily=Object.fromEntries(ds.slice(-90).map(d=>[d,N.daily[d]]));
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
