// Minimal PWA guide logic
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// i18n
let i18n = {};
const t = (k, d=k) => i18n[k] ?? d;

function getLang() {
  const url = new URL(location.href);
  return url.searchParams.get("lang") || localStorage.getItem("lang") || (navigator.language||"en").startsWith("th") ? "th" : "en";
}

async function loadI18n(lang) {
  try {
    const res = await fetch(`i18n/${lang}.json`);
    i18n = await res.json();
  } catch {
    i18n = {};
  }
  // Apply UI strings
  $("#title").textContent = t("title", "Bangkok Night Mini‑Guide");
  $("#badgeText").textContent = t("badge", "Auto: open now & near you");
  $("#q").placeholder = t("search_ph", "Search... (noodle, rooftop, etc.)");
  // options
  const catSel = $("#cat");
  catSel.options[0].text = t("cat_all","All categories");
  catSel.options[1].text = t("cat_food","Food");
  catSel.options[2].text = t("cat_cafe","Cafe");
  catSel.options[3].text = t("cat_bar","Bar/Rooftop");
  catSel.options[4].text = t("cat_photo","Photo spot");
  catSel.options[5].text = t("cat_market","Night market");
  $("#openNow").options[0].text = t("open_now","Open now");
  $("#openNow").options[1].text = t("any_time","Any time");
  $("#nearby").options[0].text = t("near_1km","≤1 km");
  $("#nearby").options[1].text = t("near_2km","≤2 km");
  $("#nearby").options[2].text = t("near_5km","≤5 km");
  $("#nearby").options[3].text = t("anywhere","Anywhere");
  $("#foot").textContent = t("footer","Works offline. Add to Home Screen.");
}

async function loadPlaces() {
  const res = await fetch("data/places.json");
  return res.json();
}

// Haversine distance (meters)
function dist(a,b){
  const R=6371e3;
  const toRad = x => x*Math.PI/180;
  const dLat = toRad(b.lat-a.lat);
  const dLng = toRad(b.lng-a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}

// Opening hours format in places.json: { "mon":[["11:00","02:00"]], "tue":[...], ... }
// Supports overnight ranges (e.g., 18:00-02:00)
function isOpenNow(place, now=new Date()){
  const days=["sun","mon","tue","wed","thu","fri","sat"];
  const local = new Date(now.getTime());
  const dayKey = days[local.getDay()];
  const prevKey = days[(local.getDay()+6)%7];
  const toMin = s => {
    const [h,m]=s.split(":").map(Number);
    return h*60 + m;
  };
  const cur = local.getHours()*60 + local.getMinutes();

  const ranges = (place.hours?.[dayKey]||[]).concat(
    // consider prev day's overnight (end < start)
    (place.hours?.[prevKey]||[]).filter(([s,e])=>toMin(e)<toMin(s)).map(([s,e])=>{
      // treat as previous day start to 24:00 and 00:00 to end for today
      return ["00:00", e];
    })
  );

  for (const [s,e] of ranges){
    const ms = toMin(s), me = toMin(e);
    if (me >= ms){
      if (cur>=ms && cur<=me) return true;
    } else {
      // overnight within same day definition
      if (cur>=ms || cur<=me) return true;
    }
  }
  return false;
}

function fmtDist(m){
  if (m<1000) return `${Math.round(m)} m`;
  return `${(m/1000).toFixed(1)} km`;
}

function card(place, open, distance){
  const div = document.createElement("div");
  div.className = "card";

  // map หมวดหมู่ -> ไฟล์ cover
  const coverMap = {
    food: "assets/covers/food.png",
    cafe: "assets/covers/cafe.png",
    bar: "assets/covers/bar.png",
    photo: "assets/covers/photo.png",
    market: "assets/covers/market.png",
  };
  // รองรับการกำหนดรูปเองใน place (เช่น place.cover)
  const coverSrc = place.cover || coverMap[place.category] || null;

  // สร้าง HTML การ์ด
  div.innerHTML = `
    ${coverSrc ? `
      <div class="cover">
        <img src="${coverSrc}" alt="${place.category} cover" loading="lazy" decoding="async" />
        <div class="overlay"></div>
      </div>` : ``}

    <div class="meta" style="margin-top:${coverSrc? '8px':'0'}">
      <span class="pill">${t(place.category)}</span>
      <span class="${open?'open':'closed'}">${open ? t('open','Open now') : t('closed','Closed')}</span>
      ${distance!=null? `<span class="pill">${fmtDist(distance)}</span>` : ""}
    </div>
    <h3>${place.name}</h3>
    <div class="meta">${place.desc??""}</div>
    <div class="meta">${place.tip? '💡 ' + place.tip : ""}</div>
    <div class="meta">${place.map ? `<a href="${place.map}" target="_blank" rel="noopener">${t('open_maps','Open in Maps')}</a>` : ""}</div>
  `;
  return div;
}

async function main(){
  // Language init
  const langSel = $("#langSel");
  const lang = getLang();
  langSel.value = lang;
  await loadI18n(lang);

  const list = $("#list");
  const places = await loadPlaces();

  // Try geolocation
  let here = null;
  try {
    await new Promise((res, rej)=>{
      navigator.geolocation.getCurrentPosition(p=>{here={lat:p.coords.latitude,lng:p.coords.longitude};res();}, err=>res(), {timeout:3500, enableHighAccuracy:true});
    });
  } catch {}
  if (!here){
    // Fallback: central BKK
    here = {lat:13.7563,lng:100.5018};
  }

  const ui = {
    q: $("#q"),
    cat: $("#cat"),
    openNow: $("#openNow"),
    nearby: $("#nearby"),
  };

  function render(){
    list.innerHTML = "";
    const q = ui.q.value.trim().toLowerCase();
    const wantCat = ui.cat.value;
    const needOpen = ui.openNow.value === "1";
    const maxDist = parseInt(ui.nearby.value,10);

    const enriched = places.map(p=>{
      const open = isOpenNow(p, new Date());
      const distance = dist(here, {lat:p.lat,lng:p.lng});
      const match = (!q || (p.name.toLowerCase().includes(q) || (p.desc||"").toLowerCase().includes(q) || (p.tags||[]).join(" ").toLowerCase().includes(q)));
      const catOk = (!wantCat || p.category===wantCat);
      const openOk = (!needOpen || open);
      const nearOk = (distance<=maxDist);
      return {...p, open, distance, visible: match && catOk && openOk && nearOk};
    }).sort((a,b)=> (a.open===b.open? a.distance-b.distance : (a.open? -1:1)) );

    for (const p of enriched){
      if (!p.visible) continue;
      list.appendChild(card(p, p.open, p.distance));
    }

    if (!list.children.length){
      const empty = document.createElement("div");
      empty.className="meta";
      empty.textContent = t('no_results',"No places found. Try 'Anywhere' or turn off 'Open now'.");
      list.appendChild(empty);
    }
  }

  ["input","change"].forEach(ev=>{
    ui.q.addEventListener(ev, render);
    ui.cat.addEventListener(ev, render);
    ui.openNow.addEventListener(ev, render);
    ui.nearby.addEventListener(ev, render);
  });

  render();

  // Language switching
  langSel.addEventListener("change", async ()=>{
    const newLang = langSel.value;
    localStorage.setItem("lang", newLang);
    const url = new URL(location.href);
    url.searchParams.set("lang", newLang);
    history.replaceState(null,"", url.toString());
    await loadI18n(newLang);
    render();
  });
}

main();

// Register SW
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
