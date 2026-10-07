import { auth, db, collection, query, orderBy, onSnapshot } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { listenBalance } from "./user-data.js";
import { formatXAF } from "./pricing.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

// ---------------------------------------------------------------------
// ACCOUNTS FOR SALE (prices are in XAF). Change price / stock here.
// TODO: the 6 new accounts at the bottom use PLACEHOLDER prices and stock.
// ---------------------------------------------------------------------
const defaultAccounts = [
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

async function handleBuy(acc) {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in first.");
    return;
  }

  if (userBalance < acc.price) {
    const goTopUp = confirm(
      `Insufficient wallet balance!\n\nYour balance: ${formatXAF(userBalance)}\nItem price: ${formatXAF(acc.price)}\n\nTop up your wallet now?`
    );
    if (goTopUp) window.location.href = "add-funds.html";
    return;
  }

  if (!confirm(`Buy ${acc.title} for ${formatXAF(acc.price)}?`)) return;
  if (buying) return;
  buying = true;

  try {
    const token = await user.getIdToken();
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
      alert(`Order placed for ${acc.title}! Find it under "Bought accounts".`);
      window.switchTab("bought");
    } else {
      alert(data.detail || "Purchase failed. Please try again.");
    }
  } catch (err) {
    console.error("Buy account error:", err);
    alert("Network error. You were not charged. Please try again.");
  } finally {
    buying = false;
  }
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
    `;
    attachIconFallback(card, order.serviceName);
    container.appendChild(card);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderAccounts(allAccounts);
});
