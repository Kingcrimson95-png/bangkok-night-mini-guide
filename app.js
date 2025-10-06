// Minimal PWA guide logic
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// i18n
let i18n = {};
const t = (k, d = k) => i18n[k] ?? d;

// State
let selectedCategory = "";
let currentLang = "en";

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
  currentLang = lang;
  try {
    const res = await fetch(`i18n/${lang}.json`);
    i18n = await res.json();
  } catch {
    i18n = {};
  }
  // Apply UI strings
  $("#title").textContent = t("title", "Bangkok Travel Guide");
  $("#q").placeholder = t("search_ph", "Search places...");

  $("#openNow").options[0].text = t("open_now", "Open now");
  $("#openNow").options[1].text = t("any_time", "Any time");
  $("#nearby").options[0].text = t("near_1km", "≤1 km");
  $("#nearby").options[1].text = t("near_2km", "≤2 km");
  $("#nearby").options[2].text = t("near_5km", "≤5 km");
  $("#nearby").options[3].text = t("anywhere", "Anywhere");
  $("#foot").textContent = t("footer", "Works offline. Add to Home Screen.");
  
  $("#emergency-btn-text").textContent = t("emergency_btn_text", "SOS");
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

// New function to load stories
async function loadStories() {
    const res = await fetch("data/stories.json");
    return res.json();
}

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
  if (!place.hours) return true;
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
    food: "https://images.unsplash.com/photo-1554679665-f5537f187268?q=80&w=1887&auto=format&fit=crop",
    cafe: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1887&auto=format&fit=crop",
    bar: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1974&auto=format&fit=crop",
    photo: "https://images.unsplash.com/photo-1532347922424-c652d9b7208e?q=80&w=2070&auto=format&fit=crop",
    market: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?q=80&w=2070&auto=format&fit=crop",
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

// New function to render stories
function renderStories(stories) {
    const container = $("#stories-container");
    if (!container) return;

    // Clear previous content and add a title
    container.innerHTML = `<h2 class="section-title">${t('stories_title', 'Bangkok Stories')}</h2>`;

    const storiesGrid = document.createElement("div");
    storiesGrid.className = "grid"; // Reuse the grid class for layout

    stories.forEach(story => {
        const div = document.createElement("div");
        div.className = "story-card";
        div.dataset.storyId = story.id; // We'll use this later to open the story

        const title = currentLang === 'th' ? story.title_th : story.title_en;
        const subtitle = currentLang === 'th' ? story.subtitle_th : story.subtitle_en;

        div.innerHTML = `
            <div class="cover">
                <img src="${story.cover_image}" alt="${title}" loading="lazy" decoding="async" />
            </div>
            <div class="story-card-content">
                <h3>${title}</h3>
                <p>${subtitle}</p>
            </div>
        `;
        storiesGrid.appendChild(div);
    });
    container.appendChild(storiesGrid);
}


let places = [];
let stories = [];
let here = { lat: 13.7563, lng: 100.5018 }; 
function render() {
    const list = $("#list");
    if (!list) return;

    list.innerHTML = "";
    const q = $("#q").value.trim().toLowerCase();
    const needOpen = $("#openNow").value === "1";
    const maxDist = parseInt($("#nearby").value, 10);

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
      empty.style.gridColumn = "1 / -1";
      empty.textContent = t('no_results', "No places found. Try different filters.");
      list.appendChild(empty);
    }
}


async function main() {
  const langSel = $("#langSel");
  const lang = getLang();
  langSel.value = lang;
  await loadI18n(lang);

  // Load both places and stories at the same time for efficiency
  [places, stories] = await Promise.all([loadPlaces(), loadStories()]);

  // Render the new story section first
  renderStories(stories);

  try {
    await new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(p => { here = { lat: p.coords.latitude, lng: p.coords.longitude }; res(); }, err => res(), { timeout: 3500 });
    });
  } catch {}
  
  const ui = {
    q: $("#q"),
    openNow: $("#openNow"),
    nearby: $("#nearby"),
  };
  ["input", "change"].forEach(ev => {
    ui.q.addEventListener(ev, render);
    ui.openNow.addEventListener(ev, render);
    ui.nearby.addEventListener(ev, render);
  });

  langSel.addEventListener("change", async () => {
    const newLang = langSel.value;
    await loadI18n(newLang);
    localStorage.setItem("lang", newLang);
    const url = new URL(location.href);
    url.searchParams.set("lang", newLang);
    history.replaceState(null, "", url.toString());
    
    // Re-render everything with the new language
    renderStories(stories);
    render();
  });

  // Initial render for places
  render(); 
}

function setupEmergencyModal() {
  const emergencyBtn = $("#emergency-btn");
  const emergencyModal = $("#emergency-modal");
  const closeModalBtn = $("#close-modal-btn");

  if (emergencyBtn && emergencyModal && closeModalBtn) {
      emergencyBtn.addEventListener("click", () => {
        emergencyModal.style.display = "flex";
      });

      closeModalBtn.addEventListener("click", () => {
        emergencyModal.style.display = "none";
      });

      emergencyModal.addEventListener("click", (e) => {
        if (e.target === emergencyModal) {
          emergencyModal.style.display = "none";
        }
      });
  } else {
    console.error("SOS Button Error: Could not find all the required emergency UI elements in the HTML.");
  }
}

document.addEventListener('DOMContentLoaded', () => {
    main();
    setupEmergencyModal();
});


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}