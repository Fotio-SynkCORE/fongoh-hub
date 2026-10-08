import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { listenBalance } from "./user-data.js";
import { toXaf, formatXAF } from "./pricing.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

let userBalance = 0;        // always in XAF, read live from Firestore
let balanceReady = false;
let unsubscribeBalance = null;
let buying = false;
let pollTimer = null;

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
      priceXaf: toXaf(usd),
      serviceSlug
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

async function authFetch(path, method = "GET", body) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
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
    const { ok, data } = await authFetch("/api/numbers/buy", "POST", {
      service_slug: offer.serviceSlug,
      service: serviceName,
      country: code,
      pool_id: offer.poolId,
      price: offer.priceXaf
    });

    if (ok) {
      showWaitingScreen(data.order_id, data.phone, serviceName);
    } else {
      alert(data.detail || "Could not get a number. You were not charged.");
    }
  } catch (err) {
    console.error("Purchase error:", err);
    alert("Network error. Please check your wallet before trying again.");
  } finally {
    buying = false;
  }
}

// ---------------------------------------------------- waiting-for-code screen
function showWaitingScreen(orderId, phone, serviceName) {
  document.getElementById("waitOverlay")?.remove();
  clearInterval(pollTimer);

  const overlay = document.createElement("div");
  overlay.id = "waitOverlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px;";
  overlay.innerHTML = `
    <div style="background:#18191c;border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:24px;width:100%;max-width:380px;text-align:center;color:#fff;">
      <div style="font-size:13px;color:#9ca3af;">${serviceName}</div>
      <div id="waitPhone" style="font-size:22px;font-weight:700;margin:10px 0;word-break:break-all;">${phone}</div>
      <button id="copyPhone" style="background:transparent;border:1px solid rgba(255,255,255,0.2);color:#fff;border-radius:8px;padding:6px 14px;cursor:pointer;">Copy number</button>
      <div id="waitStatus" style="margin:20px 0 6px;font-size:15px;color:#F59E0B;">Waiting for the code...</div>
      <div id="waitCode" style="font-size:34px;font-weight:700;letter-spacing:4px;color:#10B981;margin:6px 0;"></div>
      <p id="waitHint" style="font-size:12px;color:#9ca3af;margin:10px 0 18px;">Use this number now. If no code arrives in about 19 minutes, your money is returned automatically.</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button id="cancelNumber" style="background:transparent;border:1px solid #ef4444;color:#ef4444;border-radius:10px;padding:10px 18px;cursor:pointer;">Cancel &amp; refund</button>
        <button id="closeWait" style="background:#10B981;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const statusEl = overlay.querySelector("#waitStatus");
  const codeEl = overlay.querySelector("#waitCode");
  const cancelBtn = overlay.querySelector("#cancelNumber");

  const stop = () => clearInterval(pollTimer);
  overlay.querySelector("#closeWait").onclick = () => { stop(); overlay.remove(); };
  overlay.querySelector("#copyPhone").onclick = () => navigator.clipboard?.writeText(phone);

  cancelBtn.onclick = async () => {
    cancelBtn.disabled = true;
    try {
      const { ok, data } = await authFetch(`/api/numbers/cancel/${orderId}`, "POST");
      if (ok && data.status === "refunded") {
        stop();
        statusEl.style.color = "#9ca3af";
        statusEl.textContent = "Cancelled. Your money was returned.";
        cancelBtn.style.display = "none";
      } else {
        alert(data.detail || "Could not cancel yet. Please try again shortly.");
        cancelBtn.disabled = false;
      }
    } catch (e) {
      alert("Network error. Please try again.");
      cancelBtn.disabled = false;
    }
  };

  const check = async () => {
    try {
      const { ok, data } = await authFetch(`/api/numbers/status/${orderId}`);
      if (!ok) return;
      if (data.status === "completed" && data.code) {
        stop();
        statusEl.style.color = "#10B981";
        statusEl.textContent = "Your code:";
        codeEl.textContent = data.code;
        cancelBtn.style.display = "none";
      } else if (data.status === "refunded") {
        stop();
        statusEl.style.color = "#9ca3af";
        statusEl.textContent = "No code arrived. Your money was returned.";
        cancelBtn.style.display = "none";
      }
    } catch (e) {
      console.warn("Status check failed:", e);
    }
  };

  pollTimer = setInterval(check, 5000);
  check();
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
