import { auth, db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { listenBalance } from "./user-data.js";
import { toXaf, formatXAF } from "./pricing.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

// After payment the buyer is sent to this WhatsApp number (customer care)
// to receive the eSIM QR code. Digits only, with country code.
const SELLER_WHATSAPP = "237654287110";
const REDIRECT_SECONDS = 4;

// ---------------------------------------------------------------------
// DESTINATIONS AND PACKAGES (supplier price in USD, shown in XAF).
// scope: "local" (one country), "regional" or "global".
// popular: true puts it in the Popular tab with a badge.
// unlimited: true on a plan shows the Unlimited tag.
// A destination can have several plans: add more P(...) entries.
// For a regional or global eSIM, use scope "regional"/"global" and set
// icon: "globe" (no flag).
// ---------------------------------------------------------------------
const P = (id, dataMb, days, usd, unlimited = false) => ({ id, dataMb, days, usd, unlimited });

const destinations = [
  { id: "ua", name: "Ukraine", code: "ua", scope: "local", popular: false, plans: [P("esim-ua", 500, 1, 0.37)] },
  { id: "tr", name: "Turkey", code: "tr", scope: "local", popular: true, plans: [P("esim-tr", 500, 1, 0.39)] },
  { id: "pl", name: "Poland", code: "pl", scope: "local", popular: true, plans: [P("esim-pl", 500, 1, 0.41)] },
  { id: "bg", name: "Bulgaria", code: "bg", scope: "local", popular: false, plans: [P("esim-bg", 500, 1, 0.42)] },
  { id: "dk", name: "Denmark", code: "dk", scope: "local", popular: false, plans: [P("esim-dk", 500, 1, 0.42)] },
  { id: "ee", name: "Estonia", code: "ee", scope: "local", popular: false, plans: [P("esim-ee", 500, 1, 0.42)] },
  { id: "fi", name: "Finland", code: "fi", scope: "local", popular: false, plans: [P("esim-fi", 500, 1, 0.42)] },
  { id: "hu", name: "Hungary", code: "hu", scope: "local", popular: false, plans: [P("esim-hu", 500, 1, 0.42)] },
  { id: "lt", name: "Lithuania", code: "lt", scope: "local", popular: false, plans: [P("esim-lt", 500, 1, 0.42)] },
  { id: "ro", name: "Romania", code: "ro", scope: "local", popular: false, plans: [P("esim-ro", 500, 1, 0.42)] },
  { id: "hr", name: "Croatia", code: "hr", scope: "local", popular: false, plans: [P("esim-hr", 500, 1, 0.43)] },
  { id: "cz", name: "Czech Republic", code: "cz", scope: "local", popular: false, plans: [P("esim-cz", 500, 1, 0.43)] },
  { id: "fr", name: "France", code: "fr", scope: "local", popular: true, plans: [P("esim-fr", 500, 1, 0.43)] },
  { id: "de", name: "Germany", code: "de", scope: "local", popular: true, plans: [P("esim-de", 500, 1, 0.43)] },
  { id: "kg", name: "Kyrgyzstan", code: "kg", scope: "local", popular: false, plans: [P("esim-kg", 500, 1, 0.43)] },
  { id: "lv", name: "Latvia", code: "lv", scope: "local", popular: false, plans: [P("esim-lv", 500, 1, 0.43)] },
  { id: "lu", name: "Luxembourg", code: "lu", scope: "local", popular: false, plans: [P("esim-lu", 500, 1, 0.43)] },
  { id: "no", name: "Norway", code: "no", scope: "local", popular: false, plans: [P("esim-no", 500, 1, 0.43)] },
  { id: "pt", name: "Portugal", code: "pt", scope: "local", popular: false, plans: [P("esim-pt", 500, 1, 0.43)] },
  { id: "sk", name: "Slovakia", code: "sk", scope: "local", popular: false, plans: [P("esim-sk", 500, 1, 0.43)] }
];

const SCOPE_LABEL = { local: "Local eSIMs", regional: "Regional eSIMs", global: "Global eSIMs" };

let userBalance = 0; // XAF, live from Firestore
let unsubscribeBalance = null;
let unsubscribeOrders = null;
let buying = false;
let redirectTimer = null;
let activeScope = "popular";
let showAll = false;
let currentDest = null;
let selectedPlan = null;

// ---------------------------------------------------------------- helpers
const $ = (id) => document.getElementById(id);

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const fmtData = (mb) => (mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`);
const fmtDays = (d) => `${d} day${d === 1 ? "" : "s"}`;

function range(values, fmt) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`;
}

const minPrice = (d) => Math.min(...d.plans.map((p) => toXaf(p.usd)));
const hasUnlimited = (d) => d.plans.some((p) => p.unlimited);

const GLOBE_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 34"><rect width="48" height="34" rx="6" fill="#1e3a8a"/><circle cx="24" cy="17" r="11" fill="#3b82f6"/><path d="M17 14c3-4 8-3 10 0 1 3-2 4-5 4s-7 1-5-4z" fill="#34d399"/></svg>`
  );

function flag(d) {
  return d.code ? `https://flagcdn.com/w160/${d.code}.png` : GLOBE_ICON;
}

function sortDest(list) {
  return [...list].sort((a, b) => {
    if (a.popular !== b.popular) return a.popular ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function openWhatsApp(order) {
  const text =
    `Hello, I just bought an eSIM on Fongoh Hub.\n` +
    `${order.serviceName} (${fmtData(order.dataMb)}, ${fmtDays(order.days)})\n` +
    `Order ID: ${order.id}\n` +
    `Please send me the QR code.`;
  window.location.href = `https://wa.me/${SELLER_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------- dialog (popup)
function closeDialog() {
  clearInterval(redirectTimer);
  $("shopDialog")?.remove();
}

// buttons: [{ label, kind: "primary" | "ghost", onClick }]; stack puts them in a column
function showDialog({ icon = "", title, html = "", buttons = [], stack = false }) {
  clearInterval(redirectTimer);
  $("shopDialog")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "shopDialog";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px;";
  overlay.innerHTML = `
    <div style="background:#161b22;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:24px;width:100%;max-width:360px;text-align:center;color:#f0f6fc;box-shadow:0 20px 40px rgba(0,0,0,0.6);">
      ${icon ? `<div style="font-size:38px;margin-bottom:8px;">${icon}</div>` : ""}
      <h3 style="margin:0 0 10px;font-size:18px;line-height:1.3;">${title}</h3>
      <div style="font-size:14px;line-height:1.5;color:#9ca3af;">${html}</div>
      <div class="dlgBtns" style="display:flex;${stack ? "flex-direction:column;" : ""}gap:10px;margin-top:20px;"></div>
    </div>`;

  const row = overlay.querySelector(".dlgBtns");
  buttons.forEach((b) => {
    const btn = document.createElement("button");
    btn.textContent = b.label;
    btn.style.cssText =
      "flex:1;padding:12px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;" +
      (b.kind === "ghost"
        ? "background:transparent;border:1px solid rgba(255,255,255,0.25);color:#fff;"
        : "background:#10B981;border:none;color:#fff;");
    btn.onclick = b.onClick;
    row.appendChild(btn);
  });
  if (buttons.length === 0) row.remove();

  document.body.appendChild(overlay);
  return overlay;
}

// ------------------------------------------------------------------ views
function showView(name) {
  ["store", "detail", "mine"].forEach((v) => $(`view-${v}`).classList.toggle("active", v === name));
  $("sharedInfo").style.display = name === "mine" ? "none" : "block";
  document.querySelectorAll("#mainSwitch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === (name === "detail" ? "store" : name));
  });
  window.scrollTo({ top: 0 });
}

document.querySelectorAll("#mainSwitch button").forEach((b) => {
  b.addEventListener("click", () => showView(b.dataset.view));
});
$("crumbStore").addEventListener("click", () => showView("store"));

// ------------------------------------------------------------ store list
function renderTabs() {
  const tabs = [];
  if (destinations.some((d) => d.popular)) tabs.push({ key: "popular", label: "Popular" });
  ["local", "regional", "global"].forEach((s) => {
    if (destinations.some((d) => d.scope === s)) tabs.push({ key: s, label: SCOPE_LABEL[s].replace(" eSIMs", "") });
  });
  if (destinations.some(hasUnlimited)) tabs.push({ key: "unlimited", label: "Unlimited" });

  if (!tabs.some((t) => t.key === activeScope)) activeScope = tabs[0]?.key || "local";

  const box = $("scopeTabs");
  box.innerHTML = "";
  tabs.forEach((t) => {
    const el = document.createElement("button");
    el.className = `tab ${t.key === activeScope ? "active" : ""}`;
    el.textContent = t.label;
    el.onclick = () => { activeScope = t.key; showAll = false; renderTabs(); renderGrid(); };
    box.appendChild(el);
  });
}

function destCard(d) {
  const card = document.createElement("div");
  card.className = "dest";
  const allData = d.plans.map((p) => p.dataMb);
  card.innerHTML = `
    <div class="dest-top">
      <img src="${flag(d)}" alt="${esc(d.name)}">
      <div class="dest-name">${esc(d.name)}</div>
      ${d.popular ? `<span class="badge">Popular</span>` : ""}
    </div>
    <div class="meta">
      <span>${range(allData, fmtData)}</span>
      ${hasUnlimited(d) ? `<span>Unlimited</span>` : ""}
      <span>${range(d.plans.map((p) => p.days), fmtDays)}</span>
      <span>Data only</span>
    </div>
    <div class="dest-bottom">
      <div class="from">from<b>${formatXAF(minPrice(d))}</b></div>
      <button class="btn">View plans</button>
    </div>`;
  card.onclick = () => confirmCoverage(d);
  return card;
}

function renderGrid() {
  const text = $("searchInput").value.trim().toLowerCase();
  let list;

  if (text) {
    list = destinations.filter((d) => d.name.toLowerCase().includes(text));
  } else if (activeScope === "popular") {
    list = showAll ? destinations : destinations.filter((d) => d.popular);
  } else if (activeScope === "unlimited") {
    list = destinations.filter(hasUnlimited);
  } else {
    list = destinations.filter((d) => d.scope === activeScope);
  }
  list = sortDest(list);

  const grid = $("destGrid");
  grid.innerHTML = "";
  if (list.length === 0) {
    grid.innerHTML = `<p class="msg" style="grid-column:1/-1;">No packages in this category right now.</p>`;
  } else {
    list.forEach((d) => grid.appendChild(destCard(d)));
  }

  const browse = $("browseAll");
  const canBrowse = !text && activeScope === "popular" && !showAll && destinations.length > list.length;
  browse.style.display = canBrowse ? "block" : "none";
  browse.textContent = `Browse all ${destinations.length} destinations`;
}

$("searchInput").addEventListener("input", renderGrid);
$("browseAll").addEventListener("click", () => { showAll = true; renderGrid(); });

// STEP 1: tell the customer where the eSIM works before opening the plans
function confirmCoverage(d) {
  const globalDest = destinations.find((x) => x.scope === "global");
  const buttons = [{ label: `Continue to ${d.name} eSIMs`, onClick: () => { closeDialog(); openDetail(d); } }];
  if (globalDest && globalDest.id !== d.id) {
    buttons.push({ label: "Buy Global eSIM", kind: "ghost", onClick: () => { closeDialog(); openDetail(globalDest); } });
  }
  buttons.push({ label: "Cancel", kind: "ghost", onClick: closeDialog });

  showDialog({
    icon: "📍",
    title: `Only buy this eSIM if you are in ${esc(d.name)} or travelling there`,
    html: `Check that ${esc(d.name)} covers the country you are travelling to.<br><br>
           It connects to networks there, so it is no use anywhere else.
           ${globalDest && globalDest.id !== d.id ? "<br><br>Not going there? One eSIM can cover you worldwide." : ""}`,
    buttons,
    stack: true
  });
}

// ----------------------------------------------------------- detail view
function openDetail(d) {
  currentDest = d;
  selectedPlan = d.plans[0];

  $("crumbScope").textContent = SCOPE_LABEL[d.scope] || "eSIMs";
  $("crumbName").textContent = d.name;
  $("scopeChip").textContent = d.scope === "local" ? "Local eSIM" : d.scope === "regional" ? "Regional eSIM" : "Global eSIM";
  $("detailFlag").src = flag(d);
  $("detailTitle").textContent = `${d.name} eSIMs`;

  const globalDest = destinations.find((x) => x.scope === "global");
  $("detailNotice").innerHTML =
    `<b>ONLY BUY THIS IF YOU ARE IN ${esc(d.name.toUpperCase())} OR TRAVELLING THERE</b>` +
    `It only works on networks in ${esc(d.name)}.` +
    (globalDest && globalDest.id !== d.id
      ? ` Not headed there? <a id="goGlobal">Buy ${esc(globalDest.name)} instead</a> for worldwide coverage.`
      : "");
  $("goGlobal")?.addEventListener("click", () => openDetail(globalDest));

  // change country or region
  const sel = $("changeDest");
  sel.innerHTML = sortDest(destinations)
    .map((x) => `<option value="${x.id}" ${x.id === d.id ? "selected" : ""}>${esc(x.name)}</option>`)
    .join("");
  sel.onchange = () => openDetail(destinations.find((x) => x.id === sel.value));

  renderPlanOptions();

  // broader coverage = regional and global eSIMs only
  const wider = destinations.filter((x) => x.scope !== "local" && x.id !== d.id).slice(0, 6);
  $("moreWrap").style.display = wider.length ? "block" : "none";
  const more = $("moreGrid");
  more.innerHTML = "";
  wider.forEach((x) => more.appendChild(destCard(x)));

  showView("detail");
}

function renderPlanOptions() {
  const d = currentDest;
  const box = $("planList");
  box.innerHTML = "";

  d.plans.forEach((p) => {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = `opt ${p.id === selectedPlan.id ? "sel" : ""}`;
    opt.innerHTML = `<b>${p.unlimited ? "Unlimited" : fmtData(p.dataMb)}</b><span>${fmtDays(p.days)} · Data only</span><em>${formatXAF(toXaf(p.usd))}</em>`;
    opt.onclick = () => { selectedPlan = p; renderPlanOptions(); };
    box.appendChild(opt);
  });

  const p = selectedPlan;
  $("sumCoverage").textContent = d.name;
  $("sumPackage").textContent = `${p.unlimited ? "Unlimited" : fmtData(p.dataMb)} · ${fmtDays(p.days)}`;
  $("sumTotal").textContent = formatXAF(toXaf(p.usd));
  $("tblCoverage").textContent = d.name;
  $("tblData").textContent = p.unlimited ? "Unlimited" : fmtData(p.dataMb);
  $("tblDays").textContent = fmtDays(p.days);
}

$("buyNow").addEventListener("click", () => {
  if (currentDest && selectedPlan) handleBuy(currentDest, selectedPlan);
});

// ----------------------------------------------------------------- buying
// STEP 2: confirm the order
function handleBuy(d, p) {
  if (buying) return;
  const price = toXaf(p.usd);

  if (!auth.currentUser) {
    showDialog({
      icon: "🔒", title: "Please sign in",
      html: "You need to be signed in to buy an eSIM.",
      buttons: [{ label: "OK", onClick: closeDialog }]
    });
    return;
  }

  if (userBalance < price) {
    showDialog({
      icon: "💳", title: "Insufficient balance",
      html: `Your balance: <b style="color:#fff">${formatXAF(userBalance)}</b><br>
             Price: <b style="color:#fff">${formatXAF(price)}</b><br><br>Top up your wallet to continue.`,
      buttons: [
        { label: "Cancel", kind: "ghost", onClick: closeDialog },
        { label: "Top up", onClick: () => (window.location.href = "add-funds.html") }
      ]
    });
    return;
  }

  showDialog({
    icon: "🛒", title: "Confirm your order",
    html: `<b style="color:#fff">eSIM ${esc(d.name)}</b><br>
           ${p.unlimited ? "Unlimited" : fmtData(p.dataMb)} · ${fmtDays(p.days)} · Data only<br>
           Price: <b style="color:#10B981">${formatXAF(price)}</b><br>
           Balance after payment: ${formatXAF(userBalance - price)}<br><br>
           Your phone must support eSIM and be carrier unlocked.<br>
           Do you want to continue to payment?`,
    buttons: [
      { label: "Cancel", kind: "ghost", onClick: closeDialog },
      { label: "Yes, buy", onClick: () => pay(d, p, price) }
    ]
  });
}

// STEP 3: payment, then the redirect message, then WhatsApp
async function pay(d, p, price) {
  if (buying) return;
  buying = true;

  showDialog({ icon: "⏳", title: "Processing payment...", html: "Please wait, do not close this page." });

  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/services/buy-esim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        plan_id: p.id,
        country: d.name,
        data_mb: p.dataMb,
        days: p.days,
        price
      })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      showRedirect({ id: data.order_id || "N/A", serviceName: `eSIM ${d.name}`, dataMb: p.dataMb, days: p.days });
    } else {
      showDialog({
        icon: "⚠️", title: "Purchase failed",
        html: esc(data.detail || "Something went wrong. You were not charged."),
        buttons: [{ label: "Close", onClick: closeDialog }]
      });
    }
  } catch (err) {
    console.error("Buy eSIM error:", err);
    showDialog({
      icon: "⚠️", title: "Network error",
      html: "Please check your connection and try again. You were not charged.",
      buttons: [{ label: "Close", onClick: closeDialog }]
    });
  } finally {
    buying = false;
  }
}

function showRedirect(order) {
  let seconds = REDIRECT_SECONDS;
  const overlay = showDialog({
    icon: "✅", title: "Payment successful!",
    html: `Your <b style="color:#fff">${esc(order.serviceName)}</b> order has been placed.<br><br>
           Redirecting you to WhatsApp customer care in
           <b class="count" style="color:#10B981">${seconds}</b>s to receive your QR code...`,
    buttons: [{ label: "Open WhatsApp now", onClick: () => openWhatsApp(order) }]
  });

  redirectTimer = setInterval(() => {
    seconds -= 1;
    const el = overlay.querySelector(".count");
    if (el) el.textContent = Math.max(seconds, 0);
    if (seconds <= 0) {
      clearInterval(redirectTimer);
      openWhatsApp(order);
    }
  }, 1000);
}

// -------------------------------------------------------------- my eSIMs
function renderOrders(orders) {
  const box = $("mineContainer");
  if (orders.length === 0) {
    box.innerHTML = `<p class="msg">You have no eSIMs yet.</p>`;
    return;
  }
  box.innerHTML = "";
  orders.forEach((o) => {
    const when = o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        })
      : "Recently";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="plan">
        <div class="plan-info"><b>${esc(o.serviceName)}</b><span>${fmtData(o.dataMb || 0)} · ${fmtDays(o.days || 0)} · ${esc(when)}</span></div>
        <div class="plan-price">${formatXAF(o.price || 0)}</div>
      </div>
      <div class="status" style="margin-top:8px;">${esc(o.status || "processing")}</div>
      <button class="btn wa">Get QR code on WhatsApp</button>`;
    card.querySelector(".wa").addEventListener("click", () => openWhatsApp(o));
    box.appendChild(card);
  });
}

onAuthStateChanged(auth, (user) => {
  if (unsubscribeBalance) unsubscribeBalance();
  if (unsubscribeOrders) unsubscribeOrders();

  if (!user) {
    userBalance = 0;
    renderOrders([]);
    return;
  }

  unsubscribeBalance = listenBalance(user.uid, (b) => { userBalance = Number(b) || 0; });

  const q = query(collection(db, "users", user.uid, "orders"), orderBy("createdAt", "desc"));
  unsubscribeOrders = onSnapshot(
    q,
    (snap) => renderOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => o.type === "esim")),
    (err) => console.error("Orders listener error:", err)
  );
});

renderTabs();
renderGrid();
