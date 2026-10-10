import { auth, db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { listenBalance } from "./user-data.js";
import { formatXAF } from "./pricing.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

// After a successful purchase the buyer is sent to this WhatsApp number
// (customer care) to receive the account login.
// TODO: change it if the seller uses another number (digits only, with country code).
const SELLER_WHATSAPP = "237654287110";

// Seconds the "Redirecting to WhatsApp" message stays before WhatsApp opens
const REDIRECT_SECONDS = 4;

// ---------------------------------------------------------------------
// ACCOUNTS FOR SALE (prices are in XAF). Change price / stock here.
// TODO: the 6 new accounts at the bottom use PLACEHOLDER prices and stock.
// ---------------------------------------------------------------------
const defaultAccounts = [
  {
    id: "test-500",
    title: "Test Account (500 XAF)", // TODO delete this line block after testing
    price: 500,
    stock: 5,
    image_url: "https://img.icons8.com/color/144/gender-neutral-user.png"
  },
  {
    id: "def-1",
    title: "Old Google Voice",
    price: 3500,
    stock: 5,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/d/d7/Google_Voice_icon_%282020%29.svg"
  },
  {
    id: "def-2",
    title: "TextPlus",
    price: 1500,
    stock: 10,
    image_url: "https://img.icons8.com/color/144/message-squared.png"
  },
  {
    id: "def-3",
    title: "ExpressVPN",
    price: 2500,
    stock: 8,
    image_url: "https://img.icons8.com/color/144/expressvpn.png"
  },
  {
    id: "def-4",
    title: "Old Telegram",
    price: 2000,
    stock: 4,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg"
  },
  {
    id: "def-5",
    title: "Netflix",
    price: 2000,
    stock: 6,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_N_logo.svg"
  },
  {
    id: "def-6",
    title: "NordVPN",
    price: 2500,
    stock: 3,
    image_url: "https://img.icons8.com/color/144/nordvpn.png"
  },
  {
    id: "def-7",
    title: "Claude Premium Account",
    price: 12000, // TODO set real price
    stock: 5,     // TODO set real stock
    image_url: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Claude_AI_symbol.svg"
  },
  {
    id: "def-8",
    title: "Facebook Ads Account",
    price: 8000,  // TODO set real price
    stock: 5,     // TODO set real stock
    image_url: "https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg"
  },
  {
    id: "def-9",
    title: "Monetized TikTok UK",
    price: 25000, // TODO set real price
    stock: 2,     // TODO set real stock
    image_url: "https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg"
  },
  {
    id: "def-10",
    title: "ChatGPT Premium Account",
    price: 12000, // TODO set real price
    stock: 5,     // TODO set real stock
    image_url: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg"
  },
  {
    id: "def-11",
    title: "Old Facebook Account",
    price: 3000,  // TODO set real price
    stock: 10,    // TODO set real stock
    image_url: "https://img.icons8.com/color/144/facebook-new.png"
  },
  {
    id: "def-12",
    title: "Old IG Accounts",
    price: 3000,  // TODO set real price
    stock: 10,    // TODO set real stock
    image_url: "https://img.icons8.com/color/144/instagram-new.png"
  }
];

let allAccounts = [...defaultAccounts];
let firestoreAccounts = [];
let userBalance = 0; // XAF, live from Firestore
let unsubscribeBalance = null;
let unsubscribeOrders = null;
let buying = false;
let redirectTimer = null;

// ---------------------------------------------------------------- helpers
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Shown if an icon link is broken: green square with the first letter
function fallbackIcon(title) {
  const letter = escapeHtml((title || "?").trim().charAt(0).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" rx="28" fill="#10B981"/><text x="72" y="98" font-size="72" font-family="Arial" font-weight="700" text-anchor="middle" fill="#ffffff">${letter}</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function attachIconFallback(root, title) {
  const img = root.querySelector("img");
  if (!img) return;
  img.onerror = () => {
    img.onerror = null;
    img.src = fallbackIcon(title);
  };
}

// Opens WhatsApp with a ready message so the buyer can receive the login
function openWhatsAppForOrder(title, orderId) {
  const text =
    `Hello, I just bought "${title}" on Fongoh Hub.\n` +
    `Order ID: ${orderId}\n` +
    `Please send me the account details.`;
  window.location.href = `https://wa.me/${SELLER_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------- dialog (popup)
function closeDialog() {
  clearInterval(redirectTimer);
  document.getElementById("shopDialog")?.remove();
}

// buttons: [{ label, kind: "primary" | "ghost", onClick }]
function showDialog({ icon = "", title, html = "", buttons = [] }) {
  clearInterval(redirectTimer);
  document.getElementById("shopDialog")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "shopDialog";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px;";

  overlay.innerHTML = `
    <div style="background:#161b22;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:24px;width:100%;max-width:360px;text-align:center;color:#f0f6fc;box-shadow:0 20px 40px rgba(0,0,0,0.6);">
      ${icon ? `<div style="font-size:38px;margin-bottom:8px;">${icon}</div>` : ""}
      <h3 style="margin:0 0 10px;font-size:18px;">${title}</h3>
      <div id="shopDialogBody" style="font-size:14px;line-height:1.5;color:#9ca3af;">${html}</div>
      <div id="shopDialogBtns" style="display:flex;gap:10px;margin-top:20px;"></div>
    </div>`;

  const row = overlay.querySelector("#shopDialogBtns");
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

// ------------------------------------------------------- wallet + orders
onAuthStateChanged(auth, (user) => {
  if (unsubscribeBalance) unsubscribeBalance();
  if (unsubscribeOrders) unsubscribeOrders();

  if (!user) {
    userBalance = 0;
    renderBought([]);
    return;
  }

  unsubscribeBalance = listenBalance(user.uid, (balance) => {
    userBalance = Number(balance) || 0;
  });

  const ordersQuery = query(
    collection(db, "users", user.uid, "orders"),
    orderBy("createdAt", "desc")
  );
  unsubscribeOrders = onSnapshot(
    ordersQuery,
    (snap) => {
      const bought = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((o) => o.type === "account");
      renderBought(bought);
    },
    (err) => {
      console.error("Orders listener error:", err);
      renderBought([]);
    }
  );
});

// -------------------------------------------------------------------- tabs
window.switchTab = function (tabName) {
  const tabs = document.querySelectorAll(".tab-btn");
  const buySection = document.getElementById("buySection");
  const boughtSection = document.getElementById("boughtSection");

  tabs.forEach((btn) => btn.classList.remove("active"));

  if (tabName === "buy") {
    tabs[0].classList.add("active");
    buySection.classList.add("active");
    boughtSection.classList.remove("active");
  } else {
    tabs[1].classList.add("active");
    boughtSection.classList.add("active");
    buySection.classList.remove("active");
  }
};

// ----------------------------------------------------- accounts for sale
// Extra accounts added in Firestore (collection "accounts") appear here too
try {
  onSnapshot(
    collection(db, "accounts"),
    (snap) => {
      firestoreAccounts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      allAccounts = [...defaultAccounts, ...firestoreAccounts];
      window.filterAccounts();
    },
    () => console.log("Firestore accounts not loaded, showing default accounts.")
  );
} catch (e) {
  console.log("Firestore accounts not loaded, showing default accounts.");
}

function renderAccounts(accounts) {
  const container = document.getElementById("accountsContainer");
  container.innerHTML = "";

  if (!accounts || accounts.length === 0) {
    container.innerHTML = `<p style="color:#9ca3af; text-align:center; grid-column:1/-1; padding: 30px 0;">No accounts available right now.</p>`;
    return;
  }

  accounts.forEach((acc) => {
    const isSoldOut = Number(acc.stock) <= 0;
    const card = document.createElement("div");
    card.className = `account-card ${isSoldOut ? "sold-out" : ""}`;

    card.innerHTML = `
      <img src="${escapeHtml(acc.image_url)}" alt="${escapeHtml(acc.title)}" class="account-img">
      <div class="account-title">${escapeHtml(acc.title)}</div>
      <div class="account-price">${formatXAF(acc.price)}</div>
      <div class="account-stock">${acc.stock} item${Number(acc.stock) !== 1 ? "s" : ""} left</div>
      ${
        isSoldOut
          ? `<div class="badge-sold-out">Sold Out</div>`
          : `<button class="buy-btn">Buy Now</button>`
      }
    `;

    attachIconFallback(card, acc.title);
    card.querySelector(".buy-btn")?.addEventListener("click", () => handleBuy(acc));
    container.appendChild(card);
  });
}

// STEP 1: ask the customer to confirm before anything is bought
function handleBuy(acc) {
  if (buying) return;

  if (!auth.currentUser) {
    showDialog({
      icon: "🔒",
      title: "Please sign in",
      html: "You need to be signed in to buy an account.",
      buttons: [{ label: "OK", onClick: closeDialog }]
    });
    return;
  }

  if (userBalance < acc.price) {
    showDialog({
      icon: "💳",
      title: "Insufficient balance",
      html: `Your balance: <b style="color:#fff">${formatXAF(userBalance)}</b><br>
             Price: <b style="color:#fff">${formatXAF(acc.price)}</b><br><br>
             Top up your wallet to continue.`,
      buttons: [
        { label: "Cancel", kind: "ghost", onClick: closeDialog },
        { label: "Top up", onClick: () => (window.location.href = "add-funds.html") }
      ]
    });
    return;
  }

  showDialog({
    icon: "🛒",
    title: "Confirm your order",
    html: `<b style="color:#fff">${escapeHtml(acc.title)}</b><br>
           Price: <b style="color:#10B981">${formatXAF(acc.price)}</b><br>
           Balance after payment: ${formatXAF(userBalance - acc.price)}<br><br>
           Do you want to continue to payment?`,
    buttons: [
      { label: "Cancel", kind: "ghost", onClick: closeDialog },   // nothing is bought
      { label: "Yes, buy", onClick: () => payForAccount(acc) }
    ]
  });
}

// STEP 2: payment, then the redirect message, then WhatsApp customer care
async function payForAccount(acc) {
  if (buying) return;
  buying = true;

  showDialog({
    icon: "⏳",
    title: "Processing payment...",
    html: "Please wait, do not close this page."
  });

  try {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/services/buy-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        account_id: String(acc.id),
        title: acc.title,
        price: Math.round(Number(acc.price))
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      showRedirectMessage(acc, data.order_id || "N/A");
    } else {
      showDialog({
        icon: "⚠️",
        title: "Purchase failed",
        html: escapeHtml(data.detail || "Something went wrong. You were not charged."),
        buttons: [{ label: "Close", onClick: closeDialog }]
      });
    }
  } catch (err) {
    console.error("Buy account error:", err);
    showDialog({
      icon: "⚠️",
      title: "Network error",
      html: "Please check your connection and try again. You were not charged.",
      buttons: [{ label: "Close", onClick: closeDialog }]
    });
  } finally {
    buying = false;
  }
}

function showRedirectMessage(acc, orderId) {
  let seconds = REDIRECT_SECONDS;

  const overlay = showDialog({
    icon: "✅",
    title: "Payment successful!",
    html: `Your order for <b style="color:#fff">${escapeHtml(acc.title)}</b> has been placed.<br><br>
           Redirecting you to WhatsApp customer care in
           <b id="redirectCount" style="color:#10B981">${seconds}</b>s to receive your account details...`,
    buttons: [
      { label: "Open WhatsApp now", onClick: () => openWhatsAppForOrder(acc.title, orderId) }
    ]
  });

  redirectTimer = setInterval(() => {
    seconds -= 1;
    const el = overlay.querySelector("#redirectCount");
    if (el) el.textContent = Math.max(seconds, 0);
    if (seconds <= 0) {
      clearInterval(redirectTimer);
      openWhatsAppForOrder(acc.title, orderId);
    }
  }, 1000);
}

// Search Filter
window.filterAccounts = function () {
  const queryText = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const filtered = allAccounts.filter((acc) =>
    String(acc.title).toLowerCase().includes(queryText)
  );
  renderAccounts(filtered);
};

// --------------------------------------------------------- bought accounts
function renderBought(orders) {
  const container = document.getElementById("boughtContainer");
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `<p style="color:#9ca3af; text-align:center; grid-column:1/-1; padding: 30px 0;">You haven't purchased any accounts yet.</p>`;
    return;
  }

  container.innerHTML = "";
  orders.forEach((order) => {
    const match = allAccounts.find((a) => String(a.id) === String(order.accountId));
    const imageUrl = match?.image_url || fallbackIcon(order.serviceName);

    const card = document.createElement("div");
    card.className = "account-card";
    card.innerHTML = `
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(order.serviceName)}" class="account-img">
      <div class="account-title">${escapeHtml(order.serviceName)}</div>
      <div class="account-price">${formatXAF(order.price || 0)}</div>
      <div class="account-stock" style="text-transform: capitalize;">${escapeHtml(order.status || "processing")}</div>
      <button class="buy-btn" style="background:#25D366;">Get on WhatsApp</button>
    `;
    attachIconFallback(card, order.serviceName);
    card.querySelector(".buy-btn").addEventListener("click", () =>
      openWhatsAppForOrder(order.serviceName, order.id)
    );
    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderAccounts(allAccounts);
});
