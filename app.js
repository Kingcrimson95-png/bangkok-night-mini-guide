// Minimal PWA guide logic
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// i18n
let i18n = {};
const t = (k, d = k) => i18n[k] ?? d;

// State
let selectedCategory = "";

const categoryIcons = {
    food: "🍜",
    cafe: "☕️",
    bar: "🍸",
    photo: "📸",
    market: "🏮"
};

function getLang() {
  const url = new URL(location.href);
  return url.searchParams.get("lang") || localStorage.getItem("lang") || (navigator.language || "en").startsWith("th") ? "th" : "en";
}

async function loadI18n(lang) {
  try {
    const res = await fetch(`i18n/${lang}.json`);
    i18n = await res.json();
  } catch {
    i18n = {};
  }
  // Apply UI strings
  $("#title").textContent = t("title", "Bangkok Travel Guide");
  $("#q").placeholder = t("search_ph", "Search places...");

  // options
  $("#openNow").options[0].text = t("open_now", "Open now");
  $("#openNow").options[1].text = t("any_time", "Any time");
  $("#nearby").options[0].text = t("near_1km", "≤1 km");
  $("#nearby").options[1].text = t("near_2km", "≤2 km");
  $("#nearby").options[2].text = t("near_5km", "≤5 km");
  $("#nearby").options[3].text = t("anywhere", "Anywhere");
  $("#foot").textContent = t("footer", "Works offline. Add to Home Screen.");
  
  // Emergency Modal localization
  $("#emergency-title").textContent = t("emergency_title", "Emergency Contacts");
  $("#tourist-police-label").textContent = t("tourist_police", "Tourist Police");
  $("#police-ambulance-label").textContent = t("police_ambulance", "Police / Ambulance");
  $("#medical-emergency-label").textContent = t("medical_emergency", "Medical Emergency");

  renderCategoryFilters();
}

function renderCategoryFilters() {
    const filterContainer = $("#category-filters");
    filterContainer.innerHTML = "";
    
    const categories = [
        { key: "", name: t("cat_all", "All") },
        { key: "food", name: t("cat_food", "Food") },
        { key: "cafe", name: t("cat_cafe", "Cafe") },
        { key: "bar", name: t("cat_bar", "Bar/Rooftop") },
        { key: "photo", name: t("cat_photo", "Photo Spot") },
        { key: "market", name: t("cat_market", "Night Market") },
    ];

    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "category-btn";
        btn.dataset.category = cat.key;
        
        let iconHtml = cat.key ? `<span class="icon">${categoryIcons[cat.key] || ''}</span>` : '';
        btn.innerHTML = `${iconHtml}${cat.name}`;

        if (cat.key === selectedCategory) {
            btn.classList.add("active");
        }
        btn.addEventListener("click", () => {
            selectedCategory = cat.key;
            $$(".category-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            render();
        });
        filterContainer.appendChild(btn);
    });
}


async function loadPlaces() {
  const res = await fetch("data/places.json");
  return res.json();
}

// Haversine distance (meters)
function dist(a, b) {
  const R = 6371e3;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat), la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isOpenNow(place, now = new Date()) {
  if (!place.hours) return true; // Assume always open if no hours specified
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const local = new Date(now.getTime());
  const dayKey = days[local.getDay()];
  const prevKey = days[(local.getDay() + 6) % 7];
  const toMin = s => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const cur = local.getHours() * 60 + local.getMinutes();

  const ranges = (place.hours?.[dayKey] || []).concat(
    (place.hours?.[prevKey] || []).filter(([s, e]) => toMin(e) < toMin(s)).map(([s, e]) => {
      return ["00:00", e];
    })
  );

  for (const [s, e] of ranges) {
    const ms = toMin(s), me = toMin(e);
    if (me >= ms) {
      if (cur >= ms && cur <= me) return true;
    } else {
      if (cur >= ms || cur <= me) return true;
    }
  }
  return false;
}

function fmtDist(m) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function card(place, open, distance) {
  const div = document.createElement("div");
  div.className = "card";

  const coverMap = {
    food: "https://placehold.co/600x400/f5a623/FFFFFF?text=Food",
    cafe: "https://placehold.co/600x400/7ed321/FFFFFF?text=Cafe",
    bar: "https://placehold.co/600x400/bd10e0/FFFFFF?text=Bar",
    photo: "https://placehold.co/600x400/4a90e2/FFFFFF?text=Photo+Spot",
    market: "https://placehold.co/600x400/d0021b/FFFFFF?text=Market",
  };
  
  const coverSrc = place.image || coverMap[place.category] || 'https://placehold.co/600x400/cccccc/FFFFFF?text=Visit';

  div.innerHTML = `
    <div class="cover">
      <img src="${coverSrc}" alt="${place.name}" loading="lazy" decoding="async" />
    </div>
    <div class="card-content">
        <div class="meta-pills">
            <span class="pill category">${t(place.category, place.category)}</span>
            ${distance != null ? `<span class="pill">${fmtDist(distance)}</span>` : ""}
        </div>
        <h3>${place.name}</h3>
        <div class="meta">${place.desc ?? ""}</div>
        <div class="meta tip">${place.tip ? `💡 ${place.tip}` : ""}</div>
    </div>
    <div class="card-footer">
        <div class="meta">
            <span class="status-indicator ${open ? 'open' : 'closed'}">${open ? t('open', 'Open') : t('closed', 'Closed')}</span>
            ${place.map ? `<a href="${place.map}" target="_blank" rel="noopener">${t('open_maps', 'View on Map')}</a>` : ""}
        </div>
    </div>
  `;
  return div;
}


async function main() {
  const langSel = $("#langSel");
  const lang = getLang();
  langSel.value = lang;
  await loadI18n(lang);

  const list = $("#list");
  const places = await loadPlaces();

  let here = null;
  try {
    await new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(p => { here = { lat: p.coords.latitude, lng: p.coords.longitude }; res(); }, err => res(), { timeout: 3500 });
    });
  } catch {}
  if (!here) {
    here = { lat: 13.7563, lng: 100.5018 }; // Fallback: central BKK
  }

  const ui = {
    q: $("#q"),
    openNow: $("#openNow"),
    nearby: $("#nearby"),
  };
  
  window.render = function() {
    list.innerHTML = "";
    const q = ui.q.value.trim().toLowerCase();
    const needOpen = ui.openNow.value === "1";
    const maxDist = parseInt(ui.nearby.value, 10);

    const enriched = places.map(p => {
      const open = isOpenNow(p);
      const distance = dist(here, { lat: p.lat, lng: p.lng });
      const match = (!q || (p.name.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q) || (p.tags || []).join(" ").toLowerCase().includes(q)));
      const catOk = (!selectedCategory || p.category === selectedCategory);
      const openOk = (!needOpen || open);
      const nearOk = (distance <= maxDist);
      return { ...p, open, distance, visible: match && catOk && openOk && nearOk };
    }).sort((a, b) => (a.open === b.open ? a.distance - b.distance : (a.open ? -1 : 1)));

    const visiblePlaces = enriched.filter(p => p.visible);

    if (visiblePlaces.length > 0) {
      visiblePlaces.forEach(p => {
        list.appendChild(card(p, p.open, p.distance));
      });
    } else {
      const empty = document.createElement("div");
      empty.className = "meta";
      empty.style.gridColumn = "1 / -1"; // Span full width
      empty.textContent = t('no_results', "No places found. Try different filters.");
      list.appendChild(empty);
    }
  }

  ["input", "change"].forEach(ev => {
    ui.q.addEventListener(ev, render);
    ui.openNow.addEventListener(ev, render);
    ui.nearby.addEventListener(ev, render);
  });

  render();

  langSel.addEventListener("change", async () => {
    const newLang = langSel.value;
    localStorage.setItem("lang", newLang);
    const url = new URL(location.href);
    url.searchParams.set("lang", newLang);
    history.replaceState(null, "", url.toString());
    await loadI18n(newLang);
    render();
  });

  // --- Emergency Modal Logic ---
  const emergencyBtn = $("#emergency-btn");
  const emergencyModal = $("#emergency-modal");
  const closeModalBtn = $("#close-modal-btn");

  emergencyBtn.addEventListener("click", () => {
    emergencyModal.style.display = "flex";
  });
  closeModalBtn.addEventListener("click", () => {
    emergencyModal.style.display = "none";
  });
  // Close modal if user clicks on the background overlay
  emergencyModal.addEventListener("click", (e) => {
    if (e.target === emergencyModal) {
      emergencyModal.style.display = "none";
    }
  });

}

main();

// Register SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

