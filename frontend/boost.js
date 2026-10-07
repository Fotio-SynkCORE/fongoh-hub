import { boostServices, getServiceBySlug } from "./data.js";
import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { listenBalance } from "./user-data.js";
import { toXaf, formatXAF } from "./pricing.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

let currentPlatform = null;
let currentCategory = null;
let currentService = null;
let selectedQty = 0;
let calculatedPrice = 0; // always in XAF

let userBalance = 0; // XAF, live from Firestore
let unsubscribeBalance = null;

// Drawer Controls
window.openSidebar = function () {
  document.getElementById("sidebar")?.classList.add("active");
  document.getElementById("overlay")?.classList.add("active");
};

window.closeSidebar = function () {
  document.getElementById("sidebar")?.classList.remove("active");
  document.getElementById("overlay")?.classList.remove("active");
};

// View Switcher
window.goToStep = function (stepId) {
  document.querySelectorAll(".view-step").forEach((el) => el.classList.remove("active"));
  document.getElementById(stepId)?.classList.add("active");
};

// Live wallet balance (same source as the wallet page)
function showBalance() {
  const el = document.getElementById("balanceAmount");
  if (el) el.textContent = formatXAF(userBalance);
}

onAuthStateChanged(auth, (user) => {
  if (unsubscribeBalance) unsubscribeBalance();
  if (!user) {
    userBalance = 0;
    showBalance();
    return;
  }
  unsubscribeBalance = listenBalance(user.uid, (balance) => {
    userBalance = Number(balance) || 0;
    showBalance();
  });
});

// STEP 1: Render Platforms List
function renderPlatforms(filterText = "") {
  const container = document.getElementById("platformListContainer");
  if (!container) return;

  const platformSlugs = [...new Set(boostServices.map((b) => b.serviceSlug))];
  container.innerHTML = "";

  platformSlugs.forEach((slug) => {
    const info = getServiceBySlug(slug) || { name: slug.toUpperCase(), badgeBg: "#10B981", iconSvg: "🚀" };

    if (filterText && !info.name.toLowerCase().includes(filterText.toLowerCase())) {
      return;
    }

    const item = document.createElement("div");
    item.className = "list-item";
    item.onclick = () => selectPlatform(slug, info);

    item.innerHTML = `
      <div class="list-item-left">
        <div class="icon-circle" style="background:${info.badgeBg}; color:${info.iconColor || '#fff'}">
          ${info.iconSvg}
        </div>
        <span class="list-item-title">${info.name}</span>
      </div>
      <span class="arrow-icon">›</span>
    `;

    container.appendChild(item);
  });
}

// STEP 2: Render Categories List for Platform (with Auto-Skip for single category)
function selectPlatform(slug, info) {
  currentPlatform = { slug, ...info };
  document.getElementById("selectedPlatformHeader").textContent = info.name;

  const categories = boostServices.filter((b) => b.serviceSlug === slug);

  // IF THERE IS ONLY 1 CATEGORY: Skip Step 2 and go straight to Step 3
  if (categories.length === 1) {
    selectCategory(categories[0]);

    // Dynamically point Step 3 back button straight to Platforms (Step 1)
    const step3BackBtn = document.querySelector("#stepServices .back-btn");
    if (step3BackBtn) {
      step3BackBtn.setAttribute("onclick", "goToStep('stepPlatforms')");
    }
    return;
  }

  // IF MULTIPLE CATEGORIES: Point Step 3 back button to Categories (Step 2)
  const step3BackBtn = document.querySelector("#stepServices .back-btn");
  if (step3BackBtn) {
    step3BackBtn.setAttribute("onclick", "goToStep('stepCategories')");
  }

  const container = document.getElementById("categoryListContainer");
  container.innerHTML = "";

  categories.forEach((cat) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.onclick = () => selectCategory(cat);

    item.innerHTML = `
      <div class="list-item-left">
        <div class="icon-circle" style="background:${info.badgeBg}; color:${info.iconColor || '#fff'}">
          ${info.iconSvg}
        </div>
        <span class="list-item-title">${cat.label}</span>
      </div>
      <span class="arrow-icon">›</span>
    `;

    container.appendChild(item);
  });

  goToStep("stepCategories");
}

// STEP 3: Render Services List for Category
function selectCategory(categoryObj) {
  currentCategory = categoryObj;
  document.getElementById("selectedCategoryHeader").textContent = categoryObj.label;

  const container = document.getElementById("serviceListContainer");
  container.innerHTML = "";

  categoryObj.tiers.forEach((tier, index) => {
    const priceXaf = toXaf(tier.price || 0);
    const item = document.createElement("div");
    item.className = "list-item";
    item.style.flexDirection = "column";
    item.style.alignItems = "flex-start";
    item.onclick = () => selectServicePackage(categoryObj, tier);

    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
        <div class="list-item-left">
          <div class="icon-circle" style="background:${currentPlatform.badgeBg}; color:${currentPlatform.iconColor || '#fff'}">
            ${currentPlatform.iconSvg}
          </div>
          <span class="list-item-title">${categoryObj.label}</span>
        </div>
        <span class="arrow-icon">›</span>
      </div>
      <div style="margin-top: 8px; margin-left: 50px;">
        <span style="background: rgba(255,255,255,0.08); padding: 4px 10px; border-radius: 20px; font-size: 12px; color: #10B981; font-weight: 600;">
          🛒 ${formatXAF(priceXaf)} per ${tier.qty.toLocaleString()}
        </span>
        ${index === 0 ? '<span class="badge-tag">🔥 Most popular</span>' : ''}
      </div>
    `;

    container.appendChild(item);
  });

  goToStep("stepServices");
}

// STEP 4: Order Creation View
function selectServicePackage(categoryObj, tierObj) {
  currentService = { category: categoryObj, tier: tierObj };
  document.getElementById("orderServiceTitle").textContent = categoryObj.label;

  const presetGrid = document.getElementById("presetGrid");
  presetGrid.innerHTML = "";

  categoryObj.tiers.forEach((t, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `preset-btn ${idx === 0 ? 'active' : ''}`;
    btn.innerHTML = `${currentPlatform.iconSvg} ${t.qty.toLocaleString()}`;
    btn.onclick = () => setQuantity(t.qty, t.price, btn);
    presetGrid.appendChild(btn);
  });

  const customBtn = document.createElement("button");
  customBtn.type = "button";
  customBtn.className = "preset-btn";
  customBtn.textContent = "Choose own";
  customBtn.onclick = () => enableCustomQuantity(customBtn);
  presetGrid.appendChild(customBtn);

  if (categoryObj.tiers.length > 0) {
    setQuantity(categoryObj.tiers[0].qty, categoryObj.tiers[0].price, presetGrid.children[0]);
  }

  goToStep("stepOrderForm");
}

// priceUsd comes from data.js, it is converted to XAF here
function setQuantity(qty, priceUsd, activeBtn) {
  document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");

  document.getElementById("customQtyContainer").style.display = "none";

  selectedQty = qty;
  calculatedPrice = toXaf(priceUsd);

  updateSummary();
}

function enableCustomQuantity(activeBtn) {
  document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
  activeBtn.classList.add("active");

  const customContainer = document.getElementById("customQtyContainer");
  const customInput = document.getElementById("customQtyInput");
  customContainer.style.display = "block";
  customInput.focus();

  const calculateCustom = () => {
    const qty = parseInt(customInput.value, 10) || 0;
    const baseQty = currentService.tier.qty || 1000;
    const baseXaf = toXaf(currentService.tier.price || 1);
    const unitPrice = baseXaf / baseQty;

    selectedQty = qty;
    calculatedPrice = qty > 0 ? Math.max(1, Math.ceil(qty * unitPrice)) : 0;
    updateSummary();
  };

  customInput.oninput = calculateCustom;
  calculateCustom();
}

function updateSummary() {
  document.getElementById("summaryQty").textContent = selectedQty.toLocaleString();
  document.getElementById("summaryPrice").textContent = formatXAF(calculatedPrice);
}

// Order Form Submit Handler
document.getElementById("orderForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in first.");
    return;
  }

  const linkInput = document.getElementById("linkInput");
  const link = linkInput ? linkInput.value.trim() : "";

  if (!selectedQty || selectedQty <= 0) {
    alert("Please select or enter a valid quantity.");
    return;
  }

  if (!link) {
    alert("Please enter a target link/URL.");
    return;
  }

  if (userBalance < calculatedPrice) {
    if (confirm("Insufficient wallet balance. Top up your wallet now?")) {
      window.location.href = "add-funds.html";
    }
    return;
  }

  const orderBtn = document.getElementById("orderBtn");
  orderBtn.disabled = true;
  orderBtn.textContent = "Submitting...";

  try {
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/services/boost`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        package_name: currentCategory.label,
        target_link: link,
        quantity: selectedQty,
        price: calculatedPrice
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      alert(`Order placed successfully!\nOrder ID: ${data.order_id || "CONFIRMED"}`);
      document.getElementById("orderForm").reset();
      goToStep("stepPlatforms");
      // balance updates live from Firestore
    } else {
      alert(`Order failed: ${data.detail || "Please try again."}`);
    }
  } catch (err) {
    console.error("API Error:", err);
    alert("Could not complete order. You were not charged. Please check your connection.");
  } finally {
    orderBtn.disabled = false;
    orderBtn.textContent = "Create order";
  }
});

// Search bar filtering
document.getElementById("platformSearch")?.addEventListener("input", (e) => {
  renderPlatforms(e.target.value);
});

// Initial Setup
document.addEventListener("DOMContentLoaded", () => {
  renderPlatforms();
  showBalance();
  updateSummary();
});

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
