import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { listenBalance } from "./user-data.js";
import { toXaf, formatXAF } from "./pricing.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

let userBalance = 0;        // always in XAF, read live from Firestore
let balanceReady = false;
let unsubscribeBalance = null;
let buying = false;

// Keep the wallet balance live (same source as the wallet page)
onAuthStateChanged(auth, (user) => {
  if (unsubscribeBalance) unsubscribeBalance();
  if (!user) {
    userBalance = 0;
    balanceReady = true;
    return;
  }
  unsubscribeBalance = listenBalance(user.uid, (balance) => {
    userBalance = Number(balance) || 0;
    balanceReady = true;
  });
});

function initOffers() {
  const urlParams = new URLSearchParams(window.location.search);
  const serviceSlug = urlParams.get("serviceSlug") || "whatsapp-1";
  const serviceName = urlParams.get("serviceName") || "WhatsApp";
  const countryId = urlParams.get("country") || "us";
  const countryName = urlParams.get("countryName") || "USA";
  const countryCode = urlParams.get("code") || "us";
  const minPriceUsd = parseFloat(urlParams.get("minPrice")) || 2.0;
  const pools = parseInt(urlParams.get("pools"), 10) || 1;

  document.getElementById("platformTitle").textContent = `${serviceName} — ${countryName}`;

  const backUrl = `country-select.html?serviceSlug=${encodeURIComponent(serviceSlug)}&serviceName=${encodeURIComponent(serviceName)}`;
  document.getElementById("backLink").href = backUrl;
  document.getElementById("backBtnNav").href = backUrl;

  const container = document.getElementById("offersContainer");
  container.innerHTML = "";

  for (let i = 1; i <= pools; i++) {
    const usd = i === 1 ? minPriceUsd : minPriceUsd + (i - 1) * 0.25;

    const offer = {
      poolId: `${countryId}-pool-${i}`,
      poolNumber: i,
      priceXaf: toXaf(usd)
    };

    const card = document.createElement("div");
    card.className = "offer-card";
    card.innerHTML = `
      <div class="offer-meta">
        <h4>
          <img src="https://flagcdn.com/w40/${countryCode}.png" width="22" style="border-radius:2px;" alt="${countryName}" />
          ${countryName} (Pool ${offer.poolNumber})
        </h4>
        <p>Live inventory ready</p>
        <div class="offer-price">${formatXAF(offer.priceXaf)}</div>
      </div>
      <button class="get-btn">GET</button>
    `;

    card.querySelector(".get-btn").onclick = () =>
      processPurchase(offer, countryCode, serviceName);
    container.appendChild(card);
  }
}

async function processPurchase(offer, code, serviceName) {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in first.");
    return;
  }
  if (!balanceReady) {
    alert("Loading your balance... please try again in a moment.");
    return;
  }

  if (userBalance < offer.priceXaf) {
    const modal = document.getElementById("balanceModal");
    document.getElementById("modalFlag").src = `https://flagcdn.com/w80/${code}.png`;
    document.getElementById("modalServiceName").textContent = serviceName;
    modal.style.display = "flex";
    return;
  }

  if (buying) return;
  buying = true;

  try {
    const token = await user.getIdToken();
    const res = await fetch(`${API_BASE_URL}/api/services/buy-number`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        service: serviceName,
        country: code,
        pool_id: offer.poolId,
        price: offer.priceXaf
      })
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      alert("Order placed! Your number is being prepared.");
      // balance updates live from Firestore, no reload needed
    } else {
      alert(data.detail || "Transaction failed. Please try again.");
    }
  } catch (err) {
    console.error("Purchase error:", err);
    alert("Network error. You were not charged. Please try again.");
  } finally {
    buying = false;
  }
}

window.closeModal = function () {
  document.getElementById("balanceModal").style.display = "none";
};

initOffers();

// Sidebar Toggle Helper Code
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.querySelector(".menu-btn, .hamburger-btn, [aria-label='Toggle menu']");
  const sidebar = document.querySelector(".sidebar, .vertical-navbar, .nav-drawer, #sidebar");
  const overlay = document.querySelector(".overlay, .nav-overlay, #overlay");
  const closeBtn = document.querySelector(".close-sidebar-btn, .sidebar .close-btn");

  const openNavbar = () => {
    if (sidebar) sidebar.classList.add("open", "active");
    if (overlay) overlay.classList.add("open", "active");
  };

  const closeNavbar = () => {
    if (sidebar) sidebar.classList.remove("open", "active");
    if (overlay) overlay.classList.remove("open", "active");
  };

  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openNavbar();
    });
  }

  if (overlay) overlay.addEventListener("click", closeNavbar);
  if (closeBtn) closeBtn.addEventListener("click", closeNavbar);
});
