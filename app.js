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

function getVerdictClass(verdict) {
  if (!verdict) return "verdict-risky";
  if (verdict.includes("AVOID")) return "verdict-avoid";
  if (verdict.includes("RISKY") || verdict.includes("High Risk")) return "verdict-risky";
  return "verdict-apply";
}

function copyTextSafe(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
}

// AUTO-ANALYST ENGINE (Har IPO ka Data Dekh Kar Verdict & Target/SL Banata Hai)
function runAutoAnalyst(ipo) {
  const pe = parseFloat(ipo.pe) || 0;
  const indPe = parseFloat(ipo.industryPe) || 26;
  const roe = parseFloat(ipo.roeVal) || 0;
  const ofs = parseFloat(ipo.ofsPercent) || 0;
  const qib = parseFloat(ipo.qibSub) || 0;
  const gmpPct = parseFloat(ipo.gmpPercent) || 0;
  const price = parseFloat(ipo.issuePrice) || 100;
  const listGain = ipo.actualListingGain;

  let score = 5.5;
  if (pe > 0) { if (pe < indPe) score += 1.4; else if (pe > indPe * 1.3) score -= 1.2; }
  if (roe >= 18) score += 0.9; else if (roe > 0 && roe < 10) score -= 0.7;
  if (ofs <= 30) score += 0.7; else if (ofs >= 70) score -= 1.0;
  if (qib >= 15) score += 1.3; else if (qib >= 5) score += 0.6;
  if (gmpPct >= 20) score += 0.7;
  if (listGain != null && listGain > 15) score += 0.6;
  score = Math.min(9.5, Math.max(3.0, +score.toFixed(1)));

  const verdict = score >= 7.0 ? (ipo.category === "sme" ? "APPLY (High Risk)" : "APPLY")
                : score >= 5.4 ? "RISKY / MAY APPLY" : "AVOID";

  const plus = [];
  const minus = [];
  if (pe > 0 && pe < indPe) plus.push(`Valuation sasta hai (P/E ${pe}x vs Industry ${indPe}x)`);
  else if (pe > indPe) minus.push(`Valuation mehnga lag raha hai (P/E ${pe}x vs Industry ${indPe}x)`);
  if (ofs <= 30) plus.push(`${100 - ofs}% Fresh Issue — paisa company growth mein lagega`);
  else minus.push(`${ofs}% OFS — purane investors hissa bech rahe hain`);
  if (qib >= 10) plus.push(`Strong QIB Institutional Demand (${qib}x)`);
  else if (ipo.status !== "upcoming") minus.push(`QIB Demand abhi kam (${qib}x) hai`);
  if (roe >= 15) plus.push(`Strong ROE (${roe}%)`);
  if (ipo.category === "sme") minus.push("SME IPO mein liquidity risk aur bada lot size hota hai");
  if (!plus.length) plus.push("Official NSE/BSE/SEBI feed se verified data");
  if (!minus.length) minus.push("Listing aur market mood ke hisab se disciplined SL rakhein");

  const fairVal = pe > 0 ? Math.round(price * Math.min(1.6, Math.max(0.85, indPe / pe))) : Math.round(price * 1.15);
  const slPrice = Math.round(price * (qib >= 15 ? 0.94 : 0.92));

  ipo.score = score;
  ipo.verdict = verdict;
  ipo.plusPoints = plus;
  ipo.minusPoints = minus;
  ipo.listingGain = listGain != null ? `Listed: ${listGain > 0 ? '+' : ''}${listGain.toFixed(1)}%`
                  : (gmpPct > 0 ? `Est. ${gmpPct}%` : (qib >= 15 ? "Strong Demand" : "Track Day-3 QIB"));
  ipo.shortTerm = score >= 7.0 ? "Hold 20-45 Days" : "Book on Listing / Wait";
  ipo.longTerm = (pe > 0 && pe < indPe && roe >= 15) ? "Good Fundamental Hold" : "Track Qtr Results";
  ipo.simpleSummary = `Auto-Analysis: Issue Price ₹${price}, QIB ${qib}x, OFS ${ofs}%${pe > 0 ? `, P/E ${pe}x` : ""}. ${score >= 7 ? "Demand aur fundamentals achhe hain." : "Apply ya hold karne se pehle QIB demand aur valuation zaroor dekhein."}`;
  ipo.postListing = ipo.postListing || {
    holdingDays: verdict.includes("AVOID") ? "0 Days (Weak Demand — Exit)" : (qib >= 15 ? "30–60 Days (Anchor Lock-in se pehle review)" : "1–5 Days (Momentum Hold)"),
    target1: `₹${fairVal} (Fair Value Estimate)`,
    target2: `₹${Math.round(fairVal * (qib >= 15 ? 1.12 : 1.05))} (QIB Momentum Target)`,
    stopLoss: `₹${slPrice} (Issue / Institutional Support)`,
    logic: `Yeh Target (₹${fairVal}) aur SL (₹${slPrice}) fixed 10%/5% par nahi, balki P/E (${pe || 'N/A'}x), QIB (${qib}x), aur OFS (${ofs}%) ke hisab se nikala gaya hai.`
  };
  return ipo;
}

// NORMALIZE ANY IPOS.MARKETS RECORD
function mapOfficialRecord(item, subObj) {
  const rawStatus = String(item.status || item.stage || "").toLowerCase();
  const status = (rawStatus === "open" || rawStatus === "live" || rawStatus === "active") ? "live"
               : (rawStatus.includes("upcoming") || rawStatus.includes("pipeline") || rawStatus.includes("drhp") || rawStatus.includes("announce")) ? "upcoming"
               : "closed";

  const board = String(item.board || item.segment || "").toLowerCase();
  const category = board.includes("sme") ? "sme" : "mainboard";
  const issuePrice = Number(item.issue_price || item.price_high || item.upper_price || item.price_band_high || 0) || 100;
  const lowPrice = Number(item.price_low || item.lower_price || item.price_band_low || issuePrice);
  const priceBand = lowPrice && lowPrice !== issuePrice ? `₹${lowPrice} - ₹${issuePrice}` : `₹${issuePrice}`;
  const lotSize = Number(item.lot_size || item.market_lot || 1);
  const minInvest = lotSize > 1 ? `₹${Math.round(issuePrice * lotSize).toLocaleString("en-IN")}` : "Check Lot";

  const openD = item.open_date || item.opens || item.bidding_start || "";
  const closeD = item.close_date || item.closes || item.bidding_end || "";
  const dates = openD && closeD ? `${openD} to ${closeD}` : (openD || item.listing_date || "Check Schedule");

  const totSub = subObj?.total_times ?? subObj?.lower_bound_times ?? item.subscription_total ?? item.total_times;
  const qibSub = Number(subObj?.categories?.QIB?.times ?? item.qib_times ?? 0);
  const niiSub = Number(subObj?.categories?.NII?.times ?? item.nii_times ?? 0);
  const riiSub = Number(subObj?.categories?.RII?.times ?? item.rii_times ?? 0);

  const listPrice = Number(item.listing_close || item.listing_open || item.listing_price || 0);
  const currPrice = Number(item.current_price || item.ltp || listPrice || 0);
  const actualListingGain = (listPrice > 0 && issuePrice > 0) ? ((listPrice - issuePrice) / issuePrice) * 100 : null;
  const gmp = Number(item.gmp || 0);
  const gmpPercent = gmp > 0 && issuePrice > 0 ? +((gmp / issuePrice) * 100).toFixed(1) : (actualListingGain != null ? +actualListingGain.toFixed(1) : 0);

  const mapped = {
    id: item.slug || item.symbol || item.name,
    slug: item.slug || "",
    symbol: item.symbol || item.exchange?.nse || "",
    name: item.name || item.company_name || "IPO Issue",
    category, status, dates,
    listingDate: item.listing_date || item.listed_on || "TBA",
    openSort: openD || item.listing_date || "1999-01-01",
    priceBand, issuePrice, lotSize, minInvest,
    issueSize: item.issue_size_cr ? `₹${item.issue_size_cr} Cr` : (item.issue_size || "NSE/BSE"),
    ofsPercent: Number(item.ofs_pct ?? item.ofs_percent ?? 0),
    freshIssue: item.ofs_pct != null ? `${100 - Number(item.ofs_pct)}% Fresh / ${item.ofs_pct}% OFS` : "Check RHP",
    gmp, gmpPercent, listPrice, currPrice, actualListingGain,
    subscription: {
      total: totSub != null ? Number(totSub).toFixed(2) + "x" : (status === "upcoming" ? "0.0x" : "View"),
      qib: qibSub ? qibSub.toFixed(2) + "x" : "-",
      nii: niiSub ? niiSub.toFixed(2) + "x" : "-",
      retail: riiSub ? riiSub.toFixed(2) + "x" : "-"
    },
    qibSub,
    registrar: item.registrar || item.rta || "NSE / BSE",
    pe: Number(item.pe || item.pe_ratio || 0),
    industryPe: Number(item.industry_pe || 26),
    roeVal: Number(item.roe || item.ronw || 0),
    financials: item.financials || [{ year: "Latest", revenue: "Loading from RHP...", profit: "-", netWorth: "-" }],
    fundamentals: {
      peRatio: item.pe ? `${item.pe}x` : "Tap to Load RHP",
      roe: item.roe ? `${item.roe}%` : "Tap to Load RHP",
      debtToEquity: item.debt_to_equity || "Check RHP"
    },
    smartMoney: {
      fiiAllocation: qibSub ? `QIB ${qibSub.toFixed(2)}x` : "Exchange Book",
      anchorInvestors: item.anchor_amount ? `Anchor ₹${item.anchor_amount} Cr` : "Check RHP",
      anchorLockIn30: item.lock_in_30 || "Listing + 30 Days",
      anchorLockIn90: item.lock_in_90 || "Listing + 90 Days",
      marketMood: "Live Market"
    }
  };
  return runAutoAnalyst(mapped);
}

// 100% AUTOMATIC LIVE + PAST + FUTURE SYNC
async function syncLiveData(manualClick = false) {
  const btn = document.getElementById("syncBtn");
  if (btn) btn.innerHTML = `<span class="dot"></span> SYNCING...`;
  try {
    const [idxRes, subRes] = await Promise.all([
      fetch("https://ipos.markets/data/issues_index.json?v=" + Date.now()),
      fetch("https://ipos.markets/api/v1/subscription?v=" + Date.now()).catch(() => null)
    ]);

    if (!idxRes.ok) throw new Error("Feed error");
    const rawIdx = await idxRes.json();
    const list = Array.isArray(rawIdx) ? rawIdx : (rawIdx.issues || rawIdx.data || Object.values(rawIdx));

    const subMap = {};
    if (subRes && subRes.ok) {
      const rawSub = await subRes.json();
      const sList = Array.isArray(rawSub) ? rawSub : (rawSub.issues || []);
      sList.forEach(s => {
        if (s.slug) subMap[s.slug] = s;
        if (s.symbol) subMap[s.symbol] = s;
      });
    }

    const equityOnly = list
      .filter(i => !String(i.board || i.instrument || "").toLowerCase().includes("debt"))
      .map(i => mapOfficialRecord(i, subMap[i.slug] || subMap[i.symbol]))
      .sort((a, b) => String(b.openSort).localeCompare(String(a.openSort)));

    if (equityOnly.length > 0) {
      remoteIPOs = equityOnly;
      try { localStorage.setItem("hdRemoteIPOs", JSON.stringify(equityOnly.slice(0, 120))); } catch (_) {}
      renderCurrentPage();
      if (manualClick) alert(`Automatic Sync Complete! ✅\nTotal ${equityOnly.length} Past, Live & Upcoming IPOs loaded!`);
    }
  } catch (e) {
    if (manualClick) alert("Internet check karein ya thodi der baad SYNC LIVE dabayein!");
  }
  if (btn) btn.innerHTML = `<span class="dot"></span> SYNC LIVE`;
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
  const q = currentSearch.trim().toLowerCase();
  let filtered = getAllIPOs().filter((ipo) => {
    const matchCategory = currentCategory === "all" || ipo.category === currentCategory;
    const matchTab = q ? true : (ipo.status === currentTab);
    const matchSearch = ipo.name.toLowerCase().includes(q) || String(ipo.symbol || "").toLowerCase().includes(q);
    return matchCategory && matchTab && matchSearch;
  });

  if (filtered.length === 0) {
    mainContent.innerHTML = `<div class="empty-box">Is category mein abhi koi IPO nahi mila. (Upar Search mein koi bhi naam type karein!)</div>`;
    return;
  }

  const totalCount = filtered.length;
  const shown = filtered.slice(0, 50);
  const note = totalCount > 50
    ? `<p style="font-size:11.5px;color:#475569;margin-bottom:8px;">Showing latest 50 of <b>${totalCount}</b> IPOs — kisi bhi purane ya naye IPO ke liye upar Search karein!</p>`
    : (q ? `<p style="font-size:11.5px;color:#1d4ed8;margin-bottom:8px;">Search Results across Past, Live & Future: <b>${totalCount}</b> found</p>` : "");

  mainContent.innerHTML = note + shown.map(buildIPOCard).join("");
}

function buildIPOCard(ipo) {
  const catBadge = ipo.category === "sme"
    ? `<span class="badge badge-sme">SME IPO</span>`
    : `<span class="badge badge-mainboard">Mainboard</span>`;
  const gmpClass = ipo.gmpPercent >= 10 ? "gmp-green" : "gmp-red";
  const rightMetricLabel = ipo.currPrice > 0 ? "Current Price" : (ipo.gmp > 0 ? "Est. GMP" : "Status");
  const rightMetricVal = ipo.currPrice > 0
    ? `₹${ipo.currPrice} (${ipo.actualListingGain != null ? (ipo.actualListingGain >= 0 ? '+' : '') + ipo.actualListingGain.toFixed(1) + '%' : 'Listed'})`
    : (ipo.gmp > 0 ? `₹${ipo.gmp} (${ipo.gmpPercent}%)` : ipo.status.toUpperCase());

  return `
    <div class="ipo-card" onclick="openAnalysis('${String(ipo.id).replace(/'/g, "\\'")}')">
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
        <div><div class="metric-label">${rightMetricLabel}</div><div class="metric-val ${gmpClass}">${rightMetricVal}</div></div>
      </div>

      <div class="card-targets">
        <div class="target-info"><b>Sub:</b> ${ipo.subscription.total} • <b>QIB:</b> ${ipo.subscription.qib}</div>
        <button class="btn-analyze">Full Analysis →</button>
      </div>
    </div>
  `;
}

function renderGMPPage() {
  const top = [...getAllIPOs()]
    .filter(i => i.status === "live" || i.status === "upcoming" || i.actualListingGain != null)
    .slice(0, 40)
    .sort((a, b) => b.gmpPercent - a.gmpPercent);

  mainContent.innerHTML = `
    <div class="page-title">📈 Live Demand & Listing Gains</div>
    ${top.map(ipo => `
      <div class="gmp-row" onclick="openAnalysis('${String(ipo.id).replace(/'/g, "\\'")}')">
        <div class="gmp-left">
          <h4>${ipo.name}</h4>
          <p>Issue: ₹${ipo.issuePrice} ${ipo.currPrice ? `→ Live: <b>₹${ipo.currPrice}</b>` : `(${ipo.status.toUpperCase()})`}</p>
        </div>
        <div class="gmp-right">
          <div class="gmp-big" style="color:${ipo.gmpPercent >= 10 ? '#16a34a' : '#dc2626'}">${ipo.gmpPercent ? (ipo.gmpPercent > 0 ? '+' : '') + ipo.gmpPercent + '%' : ipo.subscription.total}</div>
          <span class="verdict-pill ${getVerdictClass(ipo.verdict)}" style="font-size:10px;padding:2px 6px;">${ipo.verdict}</span>
        </div>
      </div>
    `).join("")}
  `;
}

function renderSavedPage() {
  const savedList = getAllIPOs().filter(ipo => savedIds.includes(String(ipo.id)));
  if (savedList.length === 0) {
    mainContent.innerHTML = `<div class="empty-box"><b>Abhi koi IPO Saved nahi hai!</b><br><br>Kisi bhi IPO ki Analysis screen khol kar upar <b>☆ Save</b> dabayein.</div>`;
    return;
  }
  mainContent.innerHTML = `<div class="page-title">★ Saved Watchlist (${savedList.length})</div>` + savedList.map(buildIPOCard).join("");
}

function renderAllotmentPage() {
  const activeQueueMember = queueIndex >= 0 && familyPans[queueIndex] ? familyPans[queueIndex] : null;
  mainContent.innerHTML = `
    <div class="page-title">👨‍👩‍👧‍👦 Family PAN Vault & Fast Allotment</div>
    <div class="pan-card">
      <div class="section-heading">1️⃣ Registrar Chunein</div>
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
        <div class="form-field"><input type="text" id="panName" placeholder="Name (e.g. Papa)"></div>
        <div class="form-field"><input type="text" id="panNumber" placeholder="PAN (ABCDE1234F)" maxlength="10" style="text-transform:uppercase;"></div>
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
                <button class="btn-copy-open" style="background:#1d4ed8;" onclick="nextFamilyQueue()">Next →</button>
                <button class="del-btn" onclick="stopFamilyQueue()">Close</button>
              </div>
            </div>
          ` : ""}
          ${familyPans.map((p, idx) => `
            <div class="pan-row">
              <div class="pan-info"><b>${p.name}</b><small>${p.pan}</small></div>
              <div class="pan-actions">
                <button class="btn-copy-open" onclick="openRegistrarWithPan('${p.pan}')">Copy & Check ↗</button>
                <button class="del-btn" onclick="deleteFamilyPan(${idx})">✕</button>
              </div>
            </div>
          `).join("")}
        </div>
      ` : `<p style="font-size:11.5px;color:#64748b;margin-top:8px;">Abhi koi Family PAN save nahi hai. Upar se add karein.</p>`}
    </div>
  `;
}

function addFamilyPan() {
  const name = document.getElementById("panName").value.trim();
  const pan = document.getElementById("panNumber").value.trim().toUpperCase();
  if (!name) return alert("Naam likhein!");
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) return alert("Sahi 10-digit PAN daalein (e.g. ABCDE1234F)");
  familyPans.push({ name, pan });
  localStorage.setItem("hdFamilyPans", JSON.stringify(familyPans));
  renderAllotmentPage();
}
function deleteFamilyPan(idx) { familyPans.splice(idx, 1); localStorage.setItem("hdFamilyPans", JSON.stringify(familyPans)); queueIndex = -1; renderAllotmentPage(); }
function openRegistrarWithPan(pan) { copyTextSafe(pan); alert("PAN Copied: " + pan + "\nWebsite par Paste karein!"); window.open(selectedRegistrar, "_blank"); }
function startFamilyQueue() { if (!familyPans.length) return; queueIndex = 0; copyTextSafe(familyPans[0].pan); renderAllotmentPage(); }
function nextFamilyQueue() { if (queueIndex + 1 < familyPans.length) { queueIndex++; copyTextSafe(familyPans[queueIndex].pan); renderAllotmentPage(); } else { alert("Sab check ho gaye!"); queueIndex = -1; renderAllotmentPage(); } }
function stopFamilyQueue() { queueIndex = -1; renderAllotmentPage(); }

function toggleSave(id) {
  const sid = String(id);
  if (savedIds.includes(sid)) savedIds = savedIds.filter(item => item !== sid);
  else savedIds.push(sid);
  localStorage.setItem("hdIpoSaved", JSON.stringify(savedIds));
  const btn = document.getElementById("modalSaveBtn");
  if (btn) btn.textContent = savedIds.includes(sid) ? "★ Saved" : "☆ Save";
  if (currentPage === "watchlist") renderSavedPage();
}

async function openAnalysis(id) {
  let ipo = getAllIPOs().find(item => String(item.id) === String(id));
  if (!ipo) return;
  drawModal(ipo, Boolean(ipo.slug));

  if (ipo.slug) {
    try {
      const [detRes, subRes] = await Promise.all([
        fetch(`https://ipos.markets/data/issue/${ipo.slug}.json?v=${Date.now()}`).catch(() => null),
        fetch(`https://ipos.markets/api/v1/subscription?symbol=${encodeURIComponent(ipo.slug)}`).catch(() => null)
      ]);

      if (detRes && detRes.ok) {
        const d = await detRes.json();
        if (d.pe || d.fundamentals?.pe) ipo.pe = Number(d.pe || d.fundamentals.pe);
        if (d.roe || d.fundamentals?.roe) ipo.roeVal = Number(d.roe || d.fundamentals.roe);
        if (d.ofs_pct != null) { ipo.ofsPercent = Number(d.ofs_pct); ipo.freshIssue = `${100 - ipo.ofsPercent}% Fresh / ${ipo.ofsPercent}% OFS`; }
        if (Array.isArray(d.financials) && d.financials.length) {
          ipo.financials = d.financials.map(f => ({
            year: f.year || f.fy || "-",
            revenue: f.revenue ? `₹${f.revenue} Cr` : "-",
            profit: (f.pat ?? f.profit) != null ? `₹${f.pat ?? f.profit} Cr` : "-",
            netWorth: f.net_worth ? `₹${f.net_worth} Cr` : "-"
          }));
        }
        if (d.registrar) ipo.registrar = d.registrar;
        if (d.current_price) ipo.currPrice = Number(d.current_price);
        ipo.fundamentals = {
          peRatio: ipo.pe ? `${ipo.pe}x` : "N/A",
          roe: ipo.roeVal ? `${ipo.roeVal}%` : "N/A",
          debtToEquity: d.debt_to_equity || ipo.fundamentals.debtToEquity
        };
      }

      if (subRes && subRes.ok) {
        const s = await subRes.json();
        const tot = s.total_times ?? s.lower_bound_times;
        if (tot != null) ipo.subscription.total = Number(tot).toFixed(2) + "x";
        if (s.categories?.QIB?.times != null) { ipo.qibSub = Number(s.categories.QIB.times); ipo.subscription.qib = ipo.qibSub.toFixed(2) + "x"; }
        if (s.categories?.NII?.times != null) ipo.subscription.nii = Number(s.categories.NII.times).toFixed(2) + "x";
        if (s.categories?.RII?.times != null) ipo.subscription.retail = Number(s.categories.RII.times).toFixed(2) + "x";
      }
      ipo = runAutoAnalyst(ipo);
      drawModal(ipo, false);
    } catch (_) { drawModal(ipo, false); }
  }
}

function drawModal(ipo, isLoading) {
  const isSaved = savedIds.includes(String(ipo.id));
  const safeId = String(ipo.id).replace(/'/g, "\\'");
  analysisModal.innerHTML = `
    <div class="modal-header">
      <button class="back-btn" onclick="closeAnalysis()">← Back</button>
      <div class="modal-title">${ipo.name}</div>
      <button id="modalSaveBtn" class="save-btn" onclick="toggleSave('${safeId}')">${isSaved ? "★ Saved" : "☆ Save"}</button>
    </div>
    <div class="modal-body">
      ${isLoading ? `<p style="font-size:11.5px;color:#1d4ed8;margin-bottom:8px;">⏳ Official RHP Financials & Live Subscription load ho raha hai...</p>` : ""}
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
        <div class="section-heading">✅ Plus Points & ⚠️ Risks</div>
        <ul class="pm-list">${ipo.plusPoints.map(p => `<li>🟢 ${p}</li>`).join("")}</ul>
        <ul class="pm-list" style="margin-top:8px;">${ipo.minusPoints.map(m => `<li>🔴 ${m}</li>`).join("")}</ul>
      </div>

      <div class="section-card">
        <div class="section-heading">📊 Pichhla Data (Financials)</div>
        <table class="fin-table">
          <thead><tr><th>Year</th><th>Revenue</th><th>Profit (PAT)</th><th>Net Worth</th></tr></thead>
          <tbody>${ipo.financials.map(f => `<tr><td><b>${f.year}</b></td><td>${f.revenue}</td><td style="color:#15803d;font-weight:700;">${f.profit}</td><td>${f.netWorth}</td></tr>`).join("")}</tbody>
        </table>
      </div>

      <div class="section-card">
        <div class="section-heading">🏦 Fundamental + QIB / Anchor / Registrar</div>
        <div class="kv-row"><span class="kv-label">Issue Price / Size</span><span class="kv-val">${ipo.priceBand} | ${ipo.issueSize}</span></div>
        <div class="kv-row"><span class="kv-label">P/E Ratio / ROE</span><span class="kv-val">${ipo.fundamentals.peRatio} | ${ipo.fundamentals.roe}</span></div>
        <div class="kv-row"><span class="kv-label">Fresh vs OFS</span><span class="kv-val">${ipo.freshIssue}</span></div>
        <div class="kv-row"><span class="kv-label">Subscription (Total / QIB / NII / Ret)</span><span class="kv-val">${ipo.subscription.total} | ${ipo.subscription.qib} / ${ipo.subscription.nii} / ${ipo.subscription.retail}</span></div>
        <div class="kv-row"><span class="kv-label">Anchor Lock-in (30 / 90 Day)</span><span class="kv-val">${ipo.smartMoney.anchorLockIn30} | ${ipo.smartMoney.anchorLockIn90}</span></div>
        <div class="kv-row" style="border:none;"><span class="kv-label">Registrar</span><span class="kv-val">${ipo.registrar}</span></div>
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
          <b style="font-size:12.5px;">🧮 Live Listing Price Analyzer</b>
          <div class="calc-row">
            <input type="number" id="livePriceInput" value="${ipo.currPrice || ''}" placeholder="Live Price (₹) daalein...">
            <button onclick="analyzeLivePrice('${safeId}')">Check</button>
          </div>
          <div id="liveCalcResult" class="calc-result hidden"></div>
        </div>
      </div>
      <p class="disclaimer">Data powered by ipos.markets (Official NSE/BSE/SEBI feeds). Educational purpose only — consult your advisor before investing.</p>
    </div>
  `;
  analysisModal.classList.remove("hidden");
  analysisModal.scrollTop = 0;
}

function closeAnalysis() { analysisModal.classList.add("hidden"); }

function analyzeLivePrice(id) {
  const ipo = getAllIPOs().find(item => String(item.id) === String(id));
  const price = parseFloat(document.getElementById("livePriceInput").value);
  const resBox = document.getElementById("liveCalcResult");
  if (!price || price <= 0) { resBox.innerHTML = "Sahi Live Price (₹) daalein."; resBox.classList.remove("hidden"); return; }

  const gainPct = ((price - ipo.issuePrice) / ipo.issuePrice) * 100;
  const pe = ipo.pe || 24;
  const indPe = ipo.industryPe || 26;
  const peLive = +(pe * (price / ipo.issuePrice)).toFixed(1);
  const fairVal = Math.round(ipo.issuePrice * (indPe / pe));
  const strongInst = ipo.qibSub >= 15 && ipo.ofsPercent <= 40;

  let action, hold, target, sl, reason;
  if (peLive > indPe * 1.15 && ipo.qibSub < 5) {
    action = "🔴 EXIT / SELL ON RISE"; hold = "0–2 Days";
    target = "₹" + Math.round(price * 1.04); sl = "₹" + Math.round(price * 0.97);
    reason = `P/E (${peLive}x) mehanga hai aur QIB support kamzor hai.`;
  } else if (price >= fairVal * 1.15) {
    action = "🟡 60% PROFIT BOOK, 40% TRAIL"; hold = "7–15 Days";
    target = "₹" + Math.round(price * (strongInst ? 1.14 : 1.06));
    sl = "₹" + Math.round(ipo.issuePrice + (price - ipo.issuePrice) * 0.65);
    reason = `Fair Value (₹${fairVal}) se upar hai—aadha profit lock karein.`;
  } else if (peLive <= indPe && strongInst && gainPct >= 0) {
    action = "🟢 STRONG HOLD / ADD ON DIPS"; hold = "30–90 Days";
    target = "₹" + Math.round(Math.max(fairVal, price * 1.18));
    sl = "₹" + Math.round(Math.max(ipo.issuePrice * 0.96, price * 0.91));
    reason = `P/E (${peLive}x) sasta hai aur QIB (${ipo.qibSub}x) mazboot hai.`;
  } else {
    action = "🟡 CAUTIOUS HOLD WITH SL"; hold = "5–15 Days";
    target = "₹" + Math.round(Math.max(fairVal, price * 1.08));
    sl = "₹" + Math.round(price * 0.94);
    reason = `Valuation (${peLive}x) aur ${ipo.ofsPercent}% OFS ke hisab se tight SL rakhein.`;
  }
  resBox.innerHTML = `<div><b>Action:</b> ${action}</div><div><b>Gain/Loss:</b> ${gainPct.toFixed(1)}% (Live P/E: ${peLive}x)</div><div><b>Hold:</b> ${hold}</div>
