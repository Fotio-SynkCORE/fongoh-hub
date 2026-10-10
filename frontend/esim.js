import { auth, db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { listenBalance } from "./user-data.js";
import { toXaf, formatXAF } from "./pricing.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

// The buyer is sent to this WhatsApp number to receive the eSIM QR code.
// TODO: change it if the seller uses another number (digits only, with country code).
const SELLER_WHATSAPP = "237654287110";

// ---------------------------------------------------------------------
// eSIM PLANS (USD supplier price, converted to XAF by pricing.js).
// These are the packages seen on Grizzly's eSIM page. Add more lines here.
// ---------------------------------------------------------------------
const plans = [
  { id: "esim-ua", country: "Ukraine", code: "ua", dataMb: 500, days: 1, usd: 0.37 },
  { id: "esim-tr", country: "Turkey", code: "tr", dataMb: 500, days: 1, usd: 0.39 },
  { id: "esim-pl", country: "Poland", code: "pl", dataMb: 500, days: 1, usd: 0.41 },
  { id: "esim-bg", country: "Bulgaria", code: "bg", dataMb: 500, days: 1, usd: 0.42 },
  { id: "esim-dk", country: "Denmark", code: "dk", dataMb: 500, days: 1, usd: 0.42 },
  { id: "esim-ee", country: "Estonia", code: "ee", dataMb: 500, days: 1, usd: 0.42 },
  { id: "esim-fi", country: "Finland", code: "fi", dataMb: 500, days: 1, usd: 0.42 },
  { id: "esim-hu", country: "Hungary", code: "hu", dataMb: 500, days: 1, usd: 0.42 },
  { id: "esim-lt", country: "Lithuania", code: "lt", dataMb: 500, days: 1, usd: 0.42 },
  { id: "esim-ro", country: "Romania", code: "ro", dataMb: 500, days: 1, usd: 0.42 },
  { id: "esim-hr", country: "Croatia", code: "hr", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-cz", country: "Czech Republic", code: "cz", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-fr", country: "France", code: "fr", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-de", country: "Germany", code: "de", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-kg", country: "Kyrgyzstan", code: "kg", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-lv", country: "Latvia", code: "lv", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-lu", country: "Luxembourg", code: "lu", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-no", country: "Norway", code: "no", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-pt", country: "Portugal", code: "pt", dataMb: 500, days: 1, usd: 0.43 },
  { id: "esim-sk", country: "Slovakia", code: "sk", dataMb: 500, days: 1, usd: 0.43 }
];

let userBalance = 0; // XAF, live from Firestore
let unsubscribeBalance = null;
let unsubscribeOrders = null;
let buying = false;

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const fmtData = (mb) => (mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB`);
const fmtDays = (d) => `${d} day${d === 1 ? "" : "s"}`;

function openWhatsApp(order) {
  const text =
    `Hello, I just bought an eSIM on Fongoh Hub.\n` +
    `${order.serviceName} (${fmtData(order.dataMb)}, ${fmtDays(order.days)})\n` +
    `Order ID: ${order.id}\n` +
    `Please send me the QR code.`;
  window.location.href = `https://wa.me/${SELLER_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

// ------------------------------------------------------------------ tabs
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});

function showTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach((s) => s.classList.toggle("active", s.id === `tab-${name}`));
}

// --------------------------------------------------------------- plan list
const searchEl = document.getElementById("countrySearch");
const gbEl = document.getElementById("minGb");
const daysEl = document.getElementById("minDays");

function fillSelect(el, label, values, fmt) {
  el.innerHTML = `<option value="0">${label}: All</option>` +
    values.map((v) => `<option value="${v}">${label}: ${fmt(v)}+</option>`).join("");
}
fillSelect(gbEl, "Min GB", [...new Set(plans.map((p) => p.dataMb / 1000))].sort((a, b) => a - b), (v) => v);
fillSelect(daysEl, "Min days", [...new Set(plans.map((p) => p.days))].sort((a, b) => a - b), (v) => v);

function renderPlans() {
  const container = document.getElementById("plansContainer");
  const text = searchEl.value.trim().toLowerCase();
  const minGb = parseFloat(gbEl.value) || 0;
  const minDays = parseInt(daysEl.value, 10) || 0;

  const list = plans.filter((p) =>
    p.country.toLowerCase().includes(text) && p.dataMb / 1000 >= minGb && p.days >= minDays
  );

  if (list.length === 0) {
    container.innerHTML = `<p class="msg">No eSIM found.</p>`;
    return;
  }

  container.innerHTML = "";
  list.forEach((p) => {
    const card = document.createElement("div");
    card.className = "plan";
    card.innerHTML = `
      <div class="plan-top">
        <div class="plan-country">
          <img src="https://flagcdn.com/w80/${p.code}.png" alt="${esc(p.country)}">
          <span>${esc(p.country)}</span>
        </div>
        <div class="plan-price">${formatXAF(toXaf(p.usd))}</div>
      </div>
      <div class="plan-info">
        <div><span>Type</span>Country</div>
        <div><span>Data</span>${fmtData(p.dataMb)}</div>
        <div><span>Term</span>${fmtDays(p.days)}</div>
      </div>
      <button class="buy-btn">Buy</button>`;
    card.querySelector(".buy-btn").addEventListener("click", () => buyPlan(p));
    container.appendChild(card);
  });
}

[searchEl, gbEl, daysEl].forEach((el) => el.addEventListener("input", renderPlans));

// -------------------------------------------------------------------- buy
async function buyPlan(p) {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in first.");
    return;
  }

  const price = toXaf(p.usd);

  if (userBalance < price) {
    if (confirm(`Insufficient wallet balance!\n\nYour balance: ${formatXAF(userBalance)}\nPrice: ${formatXAF(price)}\n\nTop up your wallet now?`)) {
      window.location.href = "add-funds.html";
    }
    return;
  }

  if (!confirm(
    `Buy eSIM ${p.country}, ${fmtData(p.dataMb)}, ${fmtDays(p.days)} for ${formatXAF(price)}?\n\n` +
    `Mobile data only. Your phone must support eSIM and be carrier unlocked.`
  )) return;

  if (buying) return;
  buying = true;

  try {
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/services/buy-esim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        plan_id: p.id,
        country: p.country,
        data_mb: p.dataMb,
        days: p.days,
        price
      })
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      alert("Payment successful! Opening WhatsApp so you can receive your eSIM QR code.");
      openWhatsApp({
        id: data.order_id || "N/A",
        serviceName: `eSIM ${p.country}`,
        dataMb: p.dataMb,
        days: p.days
      });
    } else {
      alert(data.detail || "Purchase failed. Please try again.");
    }
  } catch (err) {
    console.error("Buy eSIM error:", err);
    alert("Network error. You were not charged. Please try again.");
  } finally {
    buying = false;
  }
}

// -------------------------------------------------- my eSIMs + history
function renderOrders(orders) {
  const mine = document.getElementById("mineContainer");
  const history = document.getElementById("historyContainer");

  if (orders.length === 0) {
    mine.innerHTML = `<p class="msg">You have no eSIMs yet.</p>`;
    history.innerHTML = `<p class="msg">No purchases yet.</p>`;
    return;
  }

  mine.innerHTML = "";
  history.innerHTML = "";

  orders.forEach((o) => {
    const card = document.createElement("div");
    card.className = "plan";
    card.innerHTML = `
      <div class="plan-top">
        <div class="plan-country"><span>${esc(o.serviceName)}</span></div>
        <div class="plan-price">${formatXAF(o.price || 0)}</div>
      </div>
      <div class="plan-info">
        <div><span>Data</span>${fmtData(o.dataMb || 0)}</div>
        <div><span>Term</span>${fmtDays(o.days || 0)}</div>
        <div><span>Status</span><span class="status">${esc(o.status || "processing")}</span></div>
      </div>
      <button class="buy-btn wa-btn">Get QR code on WhatsApp</button>`;
    card.querySelector(".wa-btn").addEventListener("click", () => openWhatsApp(o));
    mine.appendChild(card);

    const when = o.createdAt?.seconds
      ? new Date(o.createdAt.seconds * 1000).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
        })
      : "Recently";
    const row = document.createElement("div");
    row.className = "faq-item";
    row.innerHTML = `<h4>${esc(o.serviceName)} · ${formatXAF(o.price || 0)}</h4><p>${esc(when)} · ${esc(o.status || "processing")}</p>`;
    history.appendChild(row);
  });
}

onAuthStateChanged(auth, (user) => {
  if (unsubscribeBalance) unsubscribeBalance();
  if (unsubscribeOrders) unsubscribeOrders();

  if (!user) {
    userBalance = 0;
    return;
  }

  unsubscribeBalance = listenBalance(user.uid, (b) => { userBalance = Number(b) || 0; });

  const q = query(collection(db, "users", user.uid, "orders"), orderBy("createdAt", "desc"));
  unsubscribeOrders = onSnapshot(
    q,
    (snap) => {
      renderOrders(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((o) => o.type === "esim")
      );
    },
    (err) => console.error("Orders listener error:", err)
  );
});

renderPlans();
