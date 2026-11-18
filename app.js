let currentPage = "home";
let currentCategory = "all";
let currentTab = "live";
let currentSearch = "";
let savedIds = JSON.parse(localStorage.getItem("hdIpoSaved") || "[]");
let customIPOs = JSON.parse(localStorage.getItem("hdCustomIPOs") || "[]");
let familyPans = JSON.parse(localStorage.getItem("hdFamilyPans") || "[]");
let remoteIPOs = JSON.parse(localStorage.getItem("hdRemoteIPOs") || "[]");
let selectedRegistrar = "https://in.mpms.mufg.com/Initial_Offer/public-issues.html";
let queueIndex = -1;

const mainContent = document.getElementById("mainContent");
const searchInput = document.getElementById("searchInput");
const searchSection = document.querySelector(".search-section");
const filterSection = document.querySelector(".filter-section");
const tabsBar = document.querySelector(".tabs-bar");
const chips = document.querySelectorAll(".chip");
const tabs = document.querySelectorAll(".tab-btn");
const navItems = document.querySelectorAll(".nav-item");
const analysisModal = document.getElementById("analysisModal");

function getAllIPOs() {
  const baseList = remoteIPOs.length > 0 ? remoteIPOs : ipoDatabase;
  return [...customIPOs, ...baseList];
}

async function syncLiveData(manualClick = false) {
  const btn = document.getElementById("syncBtn");
  if (btn) btn.innerHTML = `<span class="dot"></span> SYNCING...`;
  try {
    const res = await fetch("./live-data.json?t=" + Date.now());
    if (!res.ok) throw new Error("Not found");
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      remoteIPOs = data;
      localStorage.setItem("hdRemoteIPOs", JSON.stringify(data));
      renderCurrentPage();
      if (manualClick) alert("Live Data Update & Save ho gaya! ✅");
    }
  } catch (e) {
    if (manualClick) alert("Local mode mein chal raha hai—GitHub par host karne ke baad SYNC LIVE internet se naya data uthayega! 👍");
  }
  if (btn) btn.innerHTML = `<span class="dot"></span> SYNC LIVE`;
}
function getVerdictClass(verdict) {
  if (verdict.includes("AVOID")) return "verdict-avoid";
  if (verdict.includes("RISKY") || verdict.includes("High Risk")) return "verdict-risky";
  return "verdict-apply";
}

function copyTextSafe(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

function renderCurrentPage() {
  const isHome = currentPage === "home";
  searchSection.classList.toggle("hidden", !isHome);
  filterSection.classList.toggle("hidden", !isHome);
  tabsBar.classList.toggle("hidden", !isHome);

  if (currentPage === "home") renderIPOs();
  else if (currentPage === "gmp") renderGMPPage();
  else if (currentPage === "watchlist") renderSavedPage();
  else if (currentPage === "allotment") renderAllotmentPage();
}

function renderIPOs() {
  const filtered = getAllIPOs().filter((ipo) => {
    const matchCategory = currentCategory === "all" || ipo.category === currentCategory;
    const matchTab = ipo.status === currentTab;
    const matchSearch = ipo.name.toLowerCase().includes(currentSearch.toLowerCase());
    return matchCategory && matchTab && matchSearch;
  });

  if (filtered.length === 0) {
    mainContent.innerHTML = `<div class="empty-box">Is category mein abhi koi IPO nahi mila.</div>`;
    return;
  }
  mainContent.innerHTML = filtered.map(buildIPOCard).join("");
}

function buildIPOCard(ipo) {
  const catBadge = ipo.category === "sme"
    ? `<span class="badge badge-sme">SME IPO</span>`
    : `<span class="badge badge-mainboard">Mainboard</span>`;
  const gmpClass = ipo.gmpPercent >= 15 ? "gmp-green" : "gmp-red";

  return `
    <div class="ipo-card" onclick="openAnalysis(${ipo.id})">
      <div class="card-top">
        <div>
          <div class="ipo-name">${ipo.name}</div>
          <div class="tag-row">
            ${catBadge}
            <span class="badge" style="background:#f1f5f9;color:#475569;">${ipo.dates}</span>
          </div>
        </div>
        <div class="verdict-box">
          <span class="verdict-pill ${getVerdictClass(ipo.verdict)}">${ipo.verdict}</span>
          <div class="score-text">Score: ${ipo.score}/10</div>
        </div>
      </div>

      <div class="card-grid">
        <div><div class="metric-label">Price Band</div><div class="metric-val">${ipo.priceBand}</div></div>
        <div><div class="metric-label">Min Invest</div><div class="metric-val">${ipo.minInvest}</div></div>
        <div><div class="metric-label">Est. GMP</div><div class="metric-val ${gmpClass}">₹${ipo.gmp} (${ipo.gmpPercent}%)</div></div>
      </div>

      <div class="card-targets">
        <div class="target-info"><b>Listing:</b> ${ipo.listingGain} • <b>Sub:</b> ${ipo.subscription.total}</div>
        <button class="btn-analyze">Full Analysis →</button>
      </div>
    </div>
  `;
}

function renderGMPPage() {
  const sorted = [...getAllIPOs()].sort((a, b) => b.gmpPercent - a.gmpPercent);
  mainContent.innerHTML = `
    <div class="page-title">📈 Live GMP Leaderboard (Highest First)</div>
    ${sorted.map(ipo => {
      const estList = ipo.issuePrice + ipo.gmp;
      return `
        <div class="gmp-row" onclick="openAnalysis(${ipo.id})">
          <div class="gmp-left">
            <h4>${ipo.name}</h4>
            <p>Issue: ₹${ipo.issuePrice} → Est. List: <b>₹${estList}</b> (${ipo.category.toUpperCase()})</p>
          </div>
          <div class="gmp-right">
            <div class="gmp-big" style="color:${ipo.gmpPercent >= 15 ? '#16a34a' : '#dc2626'}">+₹${ipo.gmp} (${ipo.gmpPercent}%)</div>
            <span class="verdict-pill ${getVerdictClass(ipo.verdict)}" style="font-size:10px;padding:2px 6px;">${ipo.verdict}</span>
          </div>
        </div>
      `;
    }).join("")}
  `;
}

function renderSavedPage() {
  const savedList = getAllIPOs().filter(ipo => savedIds.includes(ipo.id));
  if (savedList.length === 0) {
    mainContent.innerHTML = `
      <div class="empty-box">
        <b>Abhi koi IPO Saved nahi hai!</b><br><br>
        Kisi bhi IPO ki Analysis screen khol kar upar <b>☆ Save</b> dabayein, woh yahan dikhega.
      </div>`;
    return;
  }
  mainContent.innerHTML = `
    <div class="page-title">★ Saved Watchlist (${savedList.length})</div>
    ${savedList.map(buildIPOCard).join("")}
  `;
}

function renderAllotmentPage() {
  const activeQueueMember = queueIndex >= 0 && familyPans[queueIndex] ? familyPans[queueIndex] : null;

  mainContent.innerHTML = `
    <div class="page-title">👨‍👩‍👧‍👦 Family PAN Vault & Fast Allotment</div>

    <div class="pan-card">
      <div class="section-heading">1️⃣ Registrar Chunein (Jahan Check Karna Hai)</div>
      <div class="form-field">
        <select id="regSelect" onchange="selectedRegistrar = this.value">
          <option value="https://in.mpms.mufg.com/Initial_Offer/public-issues.html" ${selectedRegistrar.includes('mufg') ? 'selected' : ''}>MUFG Intime (Link Intime)</option>
          <option value="https://ipostatus.kfintech.com/" ${selectedRegistrar.includes('kfintech') ? 'selected' : ''}>KFintech Registrar</option>
          <option value="https://www.bigshareonline.com/ipo_Allotment.html" ${selectedRegistrar.includes('bigshare') ? 'selected' : ''}>Bigshare Services</option>
          <option value="https://www.bseindia.com/investors/appli_check.aspx" ${selectedRegistrar.includes('bseindia') ? 'selected' : ''}>BSE India IPO Status</option>
          <option value="https://www.nseindia.com/products/dynaContent/equities/ipos/ipo_login.jsp" ${selectedRegistrar.includes('nseindia') ? 'selected' : ''}>NSE India IPO Status</option>
        </select>
      </div>

      <div class="section-heading" style="margin-top:10px;">2️⃣ Family Member PAN Add Karein</div>
      <div class="form-grid">
        <div class="form-field">
          <input type="text" id="panName" placeholder="Name (e.g. Papa)">
        </div>
        <div class="form-field">
          <input type="text" id="panNumber" placeholder="PAN (ABCDE1234F)" maxlength="10" style="text-transform:uppercase;">
        </div>
      </div>
      <button class="btn-primary-full" style="background:#15803d;margin-top:0;" onclick="addFamilyPan()">+ Save Family PAN</button>

      ${familyPans.length > 0 ? `
        <div style="margin-top:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <b style="font-size:12.5px;">Saved PANs (${familyPans.length})</b>
            <button class="btn-copy-open" style="background:#1d4ed8;" onclick="startFamilyQueue()">⚡ Check All 1-by-1</button>
          </div>

          ${activeQueueMember ? `
            <div class="queue-box">
              <div><b>Checking (${queueIndex + 1}/${familyPans.length}):</b> ${activeQueueMember.name} — <b>${activeQueueMember.pan}</b> ✅ (Copied!)</div>
              <div class="queue-btns">
                <button class="btn-copy-open" onclick="openRegistrarWithPan('${activeQueueMember.pan}')">Open Site & Paste ↗</button>
                <button class="btn-copy-open" style="background:#1d4ed8;" onclick="nextFamilyQueue()">Next Member →</button>
                <button class="del-btn" onclick="stopFamilyQueue()">Close</button>
              </div>
            </div>
          ` : ""}

          ${familyPans.map((p, idx) => `
            <div class="pan-row">
              <div class="pan-info">
                <b>${p.name}</b>
                <small>${p.pan}</small>
              </div>
              <div class="pan-actions">
                <button class="btn-copy-open" onclick="openRegistrarWithPan('${p.pan}')">Copy & Check ↗</button>
                <button class="del-btn" onclick="deleteFamilyPan(${idx})">✕</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<p style="font-size:11.5px;color:#64748b;margin-top:8px;">Abhi koi Family PAN save nahi hai. Upar se add karein—data sirf aapke phone mein safe rahega.</p>`}
    </div>

    <div class="form-card">
      <div class="section-heading">➕ Naya IPO Add Karein (Auto-Analyst)</div>
      <p style="font-size:11.5px;color:#64748b;margin-bottom:8px;">
        Kisi bhi naye IPO ka data daalein—app khud uska Score, Verdict, aur Data-Based Target/SL bana dega!
      </p>

      <div class="form-field">
        <label>Company Name</label>
        <input type="text" id="new_name" placeholder="e.g. Vishal Mega Mart Ltd">
      </div>

      <div class="form-grid">
        <div class="form-field">
          <label>Category</label>
          <select id="new_cat"><option value="mainboard">Mainboard</option><option value="sme">SME IPO</option></select>
        </div>
        <div class="form-field">
          <label>Status</label>
          <select id="new_status"><option value="live">Live</option><option value="upcoming">Upcoming</option><option value="closed">Closed</option></select>
        </div>
      </div>

      <div class="form-grid">
        <div class="form-field"><label>Dates</label><input type="text" id="new_dates" placeholder="12 Dec - 15 Dec"></div>
        <div class="form-field"><label>Issue Price (₹)</label><input type="number" id="new_price" placeholder="100"></div>
      </div>

      <div class="form-grid">
        <div class="form-field"><label>Lot Size</label><input type="number" id="new_lot" placeholder="150"></div>
        <div class="form-field"><label>Live GMP (₹)</label><input type="number" id="new_gmp" placeholder="35"></div>
      </div>

      <div class="form-grid">
        <div class="form-field"><label>IPO P/E Ratio</label><input type="number" id="new_pe" placeholder="22"></div>
        <div class="form-field"><label>Industry Avg P/E</label><input type="number" id="new_indpe" placeholder="34"></div>
      </div>

      <div class="form-grid">
        <div class="form-field"><label>OFS % (0 to 100)</label><input type="number" id="new_ofs" placeholder="25"></div>
        <div class="form-field"><label>QIB Sub (x times)</label><input type="number" id="new_qib" placeholder="18"></div>
      </div>

      <div class="form-grid">
        <div class="form-field"><label>ROE (%)</label><input type="number" id="new_roe" placeholder="24"></div>
        <div class="form-field">
          <label>Market Mood</label>
          <select id="new_mood"><option value="Bullish">Bullish</option><option value="Neutral">Neutral</option><option value="Weak">Weak</option></select>
        </div>
      </div>

      <button class="btn-primary-full" onclick="addCustomIPO()">Analyze & Save IPO</button>
    </div>

    ${customIPOs.length > 0 ? `
      <div style="margin-top:14px;">
        <div class="page-title">📝 Aapke Add Kiye Hue IPOs</div>
        ${customIPOs.map(c => `
          <div class="gmp-row">
            <div onclick="openAnalysis(${c.id})" style="flex:1;"><b>${c.name}</b> <small>(${c.verdict})</small></div>
            <button class="del-btn" onclick="deleteCustomIPO(${c.id})">Delete</button>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function addFamilyPan() {
  const name = document.getElementById("panName").value.trim();
  const pan = document.getElementById("panNumber").value.trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  if (!name) { alert("Kripya member ka naam likhein!"); return; }
  if (!panRegex.test(pan)) { alert("Sahi 10-digit PAN daalein (Example: ABCDE1234F)"); return; }

  familyPans.push({ name, pan });
  localStorage.setItem("hdFamilyPans", JSON.stringify(familyPans));
  renderAllotmentPage();
}

function deleteFamilyPan(idx) {
  familyPans.splice(idx, 1);
  localStorage.setItem("hdFamilyPans", JSON.stringify(familyPans));
  queueIndex = -1;
  renderAllotmentPage();
}

function openRegistrarWithPan(pan) {
  copyTextSafe(pan);
  alert("PAN Copied: " + pan + "\n\nAb khulne wali website par PAN box mein 'Paste' karein!");
  window.open(selectedRegistrar, "_blank");
}

function startFamilyQueue() {
  if (familyPans.length === 0) return;
  queueIndex = 0;
  copyTextSafe(familyPans[0].pan);
  renderAllotmentPage();
}

function nextFamilyQueue() {
  if (queueIndex + 1 < familyPans.length) {
    queueIndex++;
    copyTextSafe(familyPans[queueIndex].pan);
    renderAllotmentPage();
  } else {
    alert("Sabhi family members check ho gaye! 🎉");
    queueIndex = -1;
    renderAllotmentPage();
  }
}

function stopFamilyQueue() {
  queueIndex = -1;
  renderAllotmentPage();
}

function addCustomIPO() {
  const name = document.getElementById("new_name").value.trim();
  const category = document.getElementById("new_cat").value;
  const status = document.getElementById("new_status").value;
  const dates = document.getElementById("new_dates").value.trim() || "Announced Soon";
  const issuePrice = parseFloat(document.getElementById("new_price").value);
  const lotSize = parseInt(document.getElementById("new_lot").value) || 1;
  const gmp = parseFloat(document.getElementById("new_gmp").value) || 0;
  const pe = parseFloat(document.getElementById("new_pe").value) || 25;
  const industryPe = parseFloat(document.getElementById("new_indpe").value) || 30;
  const ofsPercent = parseFloat(document.getElementById("new_ofs").value) || 0;
  const qibSub = parseFloat(document.getElementById("new_qib").value) || 1;
  const roe = parseFloat(document.getElementById("new_roe").value) || 15;
  const marketMood = document.getElementById("new_mood").value;

  if (!name || !issuePrice) { alert("Kripya Company Name aur Issue Price daalein!"); return; }

  const gmpPercent = +((gmp / issuePrice) * 100).toFixed(1);
  const minInvest = "₹" + Math.round(issuePrice * lotSize).toLocaleString("en-IN");

  let score = 5.0;
  if (pe < industryPe) score += 1.5; else score -= 1.2;
  if (roe >= 20) score += 1.0; else if (roe < 12) score -= 0.8;
  if (ofsPercent <= 30) score += 0.8; else if (ofsPercent >= 65) score -= 1.2;
  if (qibSub >= 15) score += 1.2; else if (qibSub >= 5) score += 0.5;
  if (gmpPercent >= 25) score += 0.8; else if (gmpPercent < 5) score -= 0.7;
  if (marketMood === "Weak") score -= 0.6;
  score = Math.min(9.6, Math.max(2.5, +score.toFixed(1)));

  const verdict = score >= 7.2 ? (category === "sme" ? "APPLY (High Risk)" : "APPLY")
                : score >= 5.5 ? "RISKY / MAY APPLY" : "AVOID";

  const fairValue = Math.round(issuePrice * (industryPe / pe));
  const plus = [];
  const minus = [];
  if (pe < industryPe) plus.push(`Valuation sasta hai (P/E ${pe}x vs Industry ${industryPe}x)`);
  else minus.push(`Valuation mehnga hai (P/E ${pe}x vs Industry ${industryPe}x)`);
  if (ofsPercent <= 30) plus.push(`${100 - ofsPercent}% Fresh Issue — growth mein lagega`);
  else minus.push(`${ofsPercent}% OFS — purane malik bech rahe hain`);
  if (qibSub >= 10) plus.push(`QIB demand strong (${qibSub}x)`);
  else minus.push(`QIB demand kam (${qibSub}x)`);
  if (roe >= 18) plus.push(`ROE ${roe}% mazboot hai`);

  const slPrice = verdict === "AVOID" ? Math.round(issuePrice * 0.96) : Math.round(issuePrice * (qibSub >= 15 ? 0.95 : 0.93));

  const newObj = {
    id: Date.now(), name, category, status, dates, listingDate: "TBA",
    priceBand: "₹" + issuePrice, issuePrice, lotSize, minInvest,
    issueSize: "Custom Entry", freshIssue: `${100 - ofsPercent}% Fresh / ${ofsPercent}% OFS`,
    ofsPercent, gmp, gmpPercent,
    subscription: { total: qibSub + "x+", qib: qibSub + "x", nii: "-", retail: "-" },
    qibSub, registrar: "Check Prospectus", score, verdict,
    listingGain: gmpPercent >= 20 ? `Strong (${gmpPercent}%)` : gmpPercent >= 8 ? `Moderate (${gmpPercent}%)` : `Weak (${gmpPercent}%)`,
    shortTerm: score >= 7.2 ? "Hold 20-45 Days" : "Book on Listing",
    longTerm: (pe < industryPe && roe >= 18) ? "Good Fundamental Hold" : "Avoid / Wait",
    simpleSummary: `Auto-Analysis: P/E ${pe}x (Industry ${industryPe}x), ROE ${roe}%, OFS ${ofsPercent}% aur QIB ${qibSub}x hai. Fair Value ₹${fairValue} ke aas-paas banti hai.`,
    plusPoints: plus.length ? plus : ["Data user dwara add kiya gaya hai"],
    minusPoints: minus.length ? minus : ["Listing ke din market trend zaroor dekhein"],
    financials: [
      { year: "FY24", revenue: "Custom", profit: "-", netWorth: "-" },
      { year: "FY25", revenue: "Custom", profit: "-", netWorth: "-" },
      { year: "FY26", revenue: "Custom", profit: `ROE ${roe}%`, netWorth: "-" }
    ],
    pe, industryPe,
    fundamentals: { peRatio: `${pe}x (Industry: ${industryPe}x)`, roe: `${roe}%`, debtToEquity: "User Input" },
    smartMoney: { fiiAllocation: `QIB ${qibSub}x`, anchorInvestors: "Check RHP", anchorLockIn30: "Listing + 30 Days", anchorLockIn90: "Listing + 90 Days", marketMood },
    postListing: {
      holdingDays: verdict === "AVOID" ? "0 Days (Exit on Listing)" : (pe < industryPe ? "30–60 Days" : "1–5 Days"),
      target1: `₹${fairValue} (Fair Industry P/E Value)`,
      target2: `₹${Math.round(fairValue * (qibSub >= 15 ? 1.12 : 1.05))} (QIB Extension)`,
      stopLoss: `₹${slPrice} (Issue Support)`,
      logic: `Target (₹${fairValue}) Industry P/E (${industryPe}x) aur QIB (${qibSub}x) ke hisab se nikala gaya hai.`
    }
  };

  customIPOs.unshift(newObj);
  localStorage.setItem("hdCustomIPOs", JSON.stringify(customIPOs));
  alert(name + " save ho gaya! Score: " + score + "/10 (" + verdict + ")");
  renderAllotmentPage();
}

function deleteCustomIPO(id) {
  customIPOs = customIPOs.filter(item => item.id !== id);
  localStorage.setItem("hdCustomIPOs", JSON.stringify(customIPOs));
  renderAllotmentPage();
}

function toggleSave(id) {
  if (savedIds.includes(id)) savedIds = savedIds.filter(item => item !== id);
  else savedIds.push(id);
  localStorage.setItem("hdIpoSaved", JSON.stringify(savedIds));
  const btn = document.getElementById("modalSaveBtn");
  if (btn) btn.textContent = savedIds.includes(id) ? "★ Saved" : "☆ Save";
  if (currentPage === "watchlist") renderSavedPage();
}

function openAnalysis(id) {
  const ipo = getAllIPOs().find(item => item.id === id);
  if (!ipo) return;
  const isSaved = savedIds.includes(id);

  analysisModal.innerHTML = `
    <div class="modal-header">
      <button class="back-btn" onclick="closeAnalysis()">← Back</button>
      <div class="modal-title">${ipo.name}</div>
      <button id="modalSaveBtn" class="save-btn" onclick="toggleSave(${ipo.id})">${isSaved ? "★ Saved" : "☆ Save"}</button>
    </div>

    <div class="modal-body">
      <div class="section-card hero-decision">
        <div class="hero-top">
          <span class="verdict-pill ${getVerdictClass(ipo.verdict)}" style="font-size:13px;padding:6px 12px;">Faisla: ${ipo.verdict}</span>
          <div class="score-big">HD Score: ${ipo.score}/10</div>
        </div>
        <div class="summary-text">${ipo.simpleSummary}</div>
        <div class="horizon-grid">
          <div class="horizon-box"><small>Listing Gain</small><strong>${ipo.listingGain}</strong></div>
          <div class="horizon-box"><small>Short Term</small><strong>${ipo.shortTerm}</strong></div>
          <div class="horizon-box"><small>Long Term</small><strong>${ipo.longTerm}</strong></div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-heading">✅ Plus Points (Taakat)</div>
        <ul class="pm-list">${ipo.plusPoints.map(p => `<li>🟢 ${p}</li>`).join("")}</ul>
        <div class="section-heading" style="margin-top:12px;">⚠️ Minus Points (Risk)</div>
        <ul class="pm-list">${ipo.minusPoints.map(m => `<li>🔴 ${m}</li>`).join("")}</ul>
      </div>

      <div class="section-card">
        <div class="section-heading">📊 Pichhla Data (3 Saal ka Record)</div>
        <table class="fin-table">
          <thead><tr><th>Year</th><th>Revenue</th><th>Profit (PAT)</th><th>Net Worth</th></tr></thead>
          <tbody>
            ${ipo.financials.map(f => `<tr><td><b>${f.year}</b></td><td>${f.revenue}</td><td style="color:#15803d;font-weight:700;">${f.profit}</td><td>${f.netWorth}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="section-card">
        <div class="section-heading">🏦 Fundamental + QIB / FII / Anchor Data</div>
        <div class="kv-row"><span class="kv-label">P/E Ratio</span><span class="kv-val">${ipo.fundamentals.peRatio}</span></div>
        <div class="kv-row"><span class="kv-label">ROE</span><span class="kv-val">${ipo.fundamentals.roe}</span></div>
        <div class="kv-row"><span class="kv-label">Debt (Karz)</span><span class="kv-val">${ipo.fundamentals.debtToEquity}</span></div>
        <div class="kv-row"><span class="kv-label">Fresh vs OFS</span><span class="kv-val">${ipo.freshIssue}</span></div>
        <div class="kv-row"><span class="kv-label">Subscription (QIB / NII / Ret)</span><span class="kv-val">${ipo.subscription.qib} / ${ipo.subscription.nii} / ${ipo.subscription.retail}</span></div>
        <div class="kv-row"><span class="kv-label">FII Participation</span><span class="kv-val">${ipo.smartMoney.fiiAllocation}</span></div>
        <div class="kv-row"><span class="kv-label">Anchor Investors</span><span class="kv-val">${ipo.smartMoney.anchorInvestors}</span></div>
        <div class="kv-row"><span class="kv-label">Anchor Lock-in (30 / 90 Day)</span><span class="kv-val">${ipo.smartMoney.anchorLockIn30} | ${ipo.smartMoney.anchorLockIn90}</span></div>
        <div class="kv-row" style="border:none;"><span class="kv-label">Market Behaviour</span><span class="kv-val">${ipo.smartMoney.marketMood}</span></div>
      </div>

      <div class="section-card post-card">
        <div class="section-heading">📈 Post-Listing Strategy (Data ke Hisab se)</div>
        <div class="kv-row"><span class="kv-label">Kitne Din Rakhna Hai?</span><span class="kv-val">${ipo.postListing.holdingDays}</span></div>
        <div class="target-sl-grid">
          <div class="ts-box target"><small>Target 1 & Target 2</small><strong>${ipo.postListing.target1}<br>${ipo.postListing.target2}</strong></div>
          <div class="ts-box sl"><small>Data-Based Stop Loss (SL)</small><strong>${ipo.postListing.stopLoss}</strong></div>
        </div>
        <div class="logic-note"><b>💡 Kyun yeh Target & SL?</b><br>${ipo.postListing.logic}</div>

        <div class="calc-box">
          <b style="font-size:12.5px;color:#0f172a;">🧮 Live Listing Price Analyzer (Abhi kya karein?)</b>
          <div class="calc-row">
            <input type="number" id="livePriceInput" placeholder="Live / Listing Price (₹) daalein...">
            <button onclick="analyzeLivePrice(${ipo.id})">Check</button>
          </div>
          <div id="liveCalcResult" class="calc-result hidden"></div>
        </div>
      </div>

      <p class="disclaimer">Disclaimer: HD IPO ka yeh analysis sirf educational aur research purpose ke liye hai. Invest karne se pehle apne SEBI-registered advisor ki salah zaroor lein.</p>
    </div>
  `;

  analysisModal.classList.remove("hidden");
  analysisModal.scrollTop = 0;
}

function closeAnalysis() {
  analysisModal.classList.add("hidden");
}

function analyzeLivePrice(id) {
  const ipo = getAllIPOs().find(item => item.id === id);
  const price = parseFloat(document.getElementById("livePriceInput").value);
  const resBox = document.getElementById("liveCalcResult");

  if (!price || price <= 0) {
    resBox.innerHTML = "Kripya sahi Listing / Live Price (₹) daalein.";
    resBox.classList.remove("hidden");
    return;
  }

  const gainPct = ((price - ipo.issuePrice) / ipo.issuePrice) * 100;
  const peAtLivePrice = +(ipo.pe * (price / ipo.issuePrice)).toFixed(1);
  const fairValue = Math.round(ipo.issuePrice * (ipo.industryPe / ipo.pe));
  const isCheap = peAtLivePrice < ipo.industryPe;
  const strongInst = ipo.qibSub >= 15 && ipo.ofsPercent <= 40;

  let action = "", holdPlan = "", target = "", sl = "", reason = "";

  if (!isCheap && ipo.qibSub < 5) {
    action = "🔴 EXIT / SELL ON RISE";
    holdPlan = "0–2 Days (Hold mat karein)";
    target = "₹" + Math.round(price * 1.04) + " (Sirf minor bounce)";
    sl = "₹" + Math.round(price * 0.97) + " (Tight Exit SL)";
    reason = `Is price par P/E (${peAtLivePrice}x) Industry (${ipo.industryPe}x) se mehnga hai aur QIB/FII demand kamzor hai.`;
  } else if (price >= fairValue * 1.15) {
    action = "🟡 60% PROFIT BOOK, 40% TRAIL";
    holdPlan = "7–15 Days (Anchor 30-Day Lock-in se pehle review)";
    target = "₹" + Math.round(price * (strongInst ? 1.14 : 1.06));
    sl = "₹" + Math.round(ipo.issuePrice + (price - ipo.issuePrice) * 0.65);
    reason = `Share apni Fair Value (₹${fairValue}) se kaafi upar open hua hai (P/E ${peAtLivePrice}x). Aadha profit lock karein aur baaki par high SL lagakar QIB momentum ride karein.`;
  } else if (isCheap && strongInst && gainPct >= 0) {
    action = "🟢 STRONG HOLD / ADD ON DIPS";
    holdPlan = "30–90 Days (Anchor Lock-in aur Qtr Result tak)";
    target = "₹" + Math.round(Math.max(fairValue, price * 1.18)) + " (Industry P/E Re-rating)";
    sl = "₹" + Math.round(Math.max(ipo.issuePrice * 0.96, price * 0.91));
    reason = `₹${price} par bhi P/E (${peAtLivePrice}x) Industry (${ipo.industryPe}x) se sasta hai, QIB ${ipo.qibSub}x tha aur OFS sirf ${ipo.ofsPercent}% hai.`;
  } else if (gainPct < 0 && isCheap && ipo.qibSub >= 10) {
    action = "🔵 HOLD WITH ISSUE SUPPORT SL";
    holdPlan = "15–30 Days (Market stabilize hone tak)";
    target = "₹" + fairValue + " (Fair Value Recovery)";
    sl = "₹" + Math.round(ipo.issuePrice * 0.92);
    reason = `Issue Price (₹${ipo.issuePrice}) se neeche hai lekin fundamental sasta (${peAtLivePrice}x) aur QIB strong hai—panic selling na karein.`;
  } else {
    action = "🟡 PARTIAL BOOK / CAUTIOUS HOLD";
    holdPlan = "5–15 Days";
    target = "₹" + Math.round(Math.max(fairValue, price * 1.08));
    sl = "₹" + Math.round(price * 0.94);
    reason = `Valuation (${peAtLivePrice}x) aur ${ipo.ofsPercent}% OFS supply ko dekhte hue disciplined Stop Loss ke saath hold karein.`;
  }

  resBox.innerHTML = `
    <div><b>Action:</b> ${action}</div>
    <div><b>Listing Gain/Loss:</b> ${gainPct.toFixed(1)}% (Current P/E: ${peAtLivePrice}x vs Industry ${ipo.industryPe}x)</div>
    <div><b>Kitne Din Rakhna Hai:</b> ${holdPlan}</div>
    <div><b>Data Target:</b> ${target} | <b>Stop Loss:</b> ${sl}</div>
    <div style="margin-top:5px;color:#334155;"><b>Logic:</b> ${reason}</div>
  `;
  resBox.classList.remove("hidden");
}

searchInput.addEventListener("input", (e) => { currentSearch = e.target.value; renderIPOs(); });

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentCategory = chip.dataset.category;
    renderIPOs();
  });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    renderIPOs();
  });
});

navItems.forEach((nav) => {
  nav.addEventListener("click", () => {
    navItems.forEach(n => n.classList.remove("active"));
    nav.classList.add("active");
    currentPage = nav.dataset.page;
    renderCurrentPage();
  });
});

renderCurrentPage();
syncLiveData(false);
