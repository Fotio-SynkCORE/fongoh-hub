import { boostServices, getServiceBySlug } from "./data.js";

const API_BASE_URL = "http://127.0.0.1:8000";
const CURRENT_USER_ID = 1;

let currentPlatform = null;
let currentCategory = null;
let currentService = null;
let selectedQty = 0;
let calculatedPrice = 0;

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

// Fetch User Balance
async function fetchUserBalance() {
  const balanceAmountEl = document.getElementById("balanceAmount");
  if (!balanceAmountEl) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${CURRENT_USER_ID}/balance`);
    if (res.ok) {
      const data = await res.json();
      balanceAmountEl.textContent = `$${Number(data.balance || 0).toFixed(2)}`;
    }
  } catch (err) {
    console.warn("Unable to fetch balance:", err);
  }
}

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
    const basePrice = tier.price || 0;
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
          🛒 $${basePrice.toFixed(2)} per ${tier.qty.toLocaleString()}
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

function setQuantity(qty, price, activeBtn) {
  document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
  if (activeBtn) activeBtn.classList.add("active");

  document.getElementById("customQtyContainer").style.display = "none";

  selectedQty = qty;
  calculatedPrice = price;

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
    const basePrice = currentService.tier.price || 1;
    const unitPrice = basePrice / baseQty;

    selectedQty = qty;
    calculatedPrice = qty * unitPrice;
    updateSummary();
  };

  customInput.oninput = calculateCustom;
  calculateCustom();
}

function updateSummary() {
  document.getElementById("summaryQty").textContent = selectedQty.toLocaleString();
  document.getElementById("summaryPrice").textContent = `$${calculatedPrice.toFixed(2)}`;
}

// Order Form Submit Handler
document.getElementById("orderForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

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

  const orderBtn = document.getElementById("orderBtn");
  orderBtn.disabled = true;
  orderBtn.textContent = "Submitting...";

  try {
    const response = await fetch(`${API_BASE_URL}/api/services/boost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        package_name: currentCategory.label,
        target_link: link,
        quantity: selectedQty,
        price: calculatedPrice
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert(`Order Placed Successfully!\nOrder ID: ${data.order_id || 'CONFIRMED'}`);
      document.getElementById("orderForm").reset();
      goToStep("stepPlatforms");
      fetchUserBalance();
    } else {
      alert(`Order Failed: ${data.detail || "Insufficient wallet balance."}`);
    }
  } catch (err) {
    console.error("API Error:", err);
    alert("Could not complete order. Please check network connection.");
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
  fetchUserBalance();
});
// Sidebar Toggle Helper Code
document.addEventListener("DOMContentLoaded", () => {
  // 1. Locate trigger button and target elements dynamically
  const menuBtn = document.querySelector(".menu-btn, .hamburger-btn, [aria-label='Toggle menu']");
  const sidebar = document.querySelector(".sidebar, .vertical-navbar, .nav-drawer, #sidebar");
  const overlay = document.querySelector(".overlay, .nav-overlay, #overlay");
  const closeBtn = document.querySelector(".close-sidebar-btn, .sidebar .close-btn");

  // Function to open navigation drawer
  const openNavbar = () => {
    if (sidebar) sidebar.classList.add("open", "active");
    if (overlay) overlay.classList.add("open", "active");
  };

  // Function to close navigation drawer
  const closeNavbar = () => {
    if (sidebar) sidebar.classList.remove("open", "active");
    if (overlay) overlay.classList.remove("open", "active");
  };

  // Attach click listener to menu button
  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openNavbar();
    });
  }

  // Attach close listeners
  if (overlay) overlay.addEventListener("click", closeNavbar);
  if (closeBtn) closeBtn.addEventListener("click", closeNavbar);
});

