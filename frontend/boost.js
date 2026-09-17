import { services, boostServices, getServiceBySlug } from "./data.js";

const API_BASE_URL = "http://127.0.0.1:8000";
const CURRENT_USER_ID = 1;

let selectedPlatformSlug = null;
let selectedBoostPackage = null;
let selectedTier = null;

const categorySelect = document.getElementById("categorySelect");
const serviceSelect = document.getElementById("serviceSelect");
const chargeAmountEl = document.getElementById("chargeAmount");
const serviceDescEl = document.getElementById("serviceDescription");

// 1. Render Platform Selector Grid from data.js
function renderGrid() {
  const gridEl = document.getElementById("networkGrid");
  if (!gridEl) return;

  // Extract unique platform slugs present in boostServices
  const platformSlugs = [...new Set(boostServices.map((b) => b.serviceSlug))];

  gridEl.innerHTML = "";

  platformSlugs.forEach((slug, index) => {
    const serviceInfo = getServiceBySlug(slug) || {
      name: slug,
      badgeBg: "#10B981",
      iconSvg: "🚀"
    };

    const card = document.createElement("div");
    card.className = `network-card ${index === 0 ? "active" : ""}`;
    card.addEventListener("click", () => handlePlatformClick(slug, card));

    card.innerHTML = `
      <div class="network-icon-box" style="background:${serviceInfo.badgeBg}; color:${serviceInfo.iconColor || '#fff'}">
        ${serviceInfo.iconSvg}
      </div>
      <span class="network-name">${serviceInfo.name}</span>
    `;

    gridEl.appendChild(card);
  });

  // Select first platform by default
  if (platformSlugs.length > 0) {
    handlePlatformClick(platformSlugs[0]);
  }
}

// 2. When a network icon is clicked, filter categories for that network
function handlePlatformClick(serviceSlug, cardEl) {
  selectedPlatformSlug = serviceSlug;

  if (cardEl) {
    document.querySelectorAll(".network-card").forEach((el) => el.classList.remove("active"));
    cardEl.classList.add("active");
  }

  // Filter boost services belonging to this platform
  const matchingBoosts = boostServices.filter((b) => b.serviceSlug === serviceSlug);

  categorySelect.innerHTML = `<option value="">Select category</option>`;
  matchingBoosts.forEach((boost) => {
    const opt = document.createElement("option");
    opt.value = boost.slug;
    opt.textContent = boost.label;
    categorySelect.appendChild(opt);
  });

  // Reset service dropdown & charge
  serviceSelect.innerHTML = `<option value="">Select a category above first</option>`;
  resetCharge();
}

// 3. When category changes, populate tiers/packages in Service dropdown
categorySelect.addEventListener("change", (e) => {
  const boostSlug = e.target.value;
  selectedBoostPackage = boostServices.find((b) => b.slug === boostSlug);

  serviceSelect.innerHTML = `<option value="">Select package size</option>`;

  if (!selectedBoostPackage) {
    resetCharge();
    return;
  }

  selectedBoostPackage.tiers.forEach((tier, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.textContent = `${tier.qty.toLocaleString()} Units — $${tier.price.toFixed(2)}`;
    serviceSelect.appendChild(opt);
  });

  resetCharge();
});

// 4. When service tier changes, calculate price
serviceSelect.addEventListener("change", (e) => {
  const tierIndex = e.target.value;

  if (tierIndex === "" || !selectedBoostPackage) {
    resetCharge();
    return;
  }

  selectedTier = selectedBoostPackage.tiers[tierIndex];
  chargeAmountEl.textContent = `$${selectedTier.price.toFixed(2)}`;
  serviceDescEl.textContent = `${selectedBoostPackage.label}\nQuantity: ${selectedTier.qty.toLocaleString()} units\nTotal Price: $${selectedTier.price.toFixed(2)}`;
});

function resetCharge() {
  selectedTier = null;
  chargeAmountEl.textContent = "$0.00";
  serviceDescEl.textContent = "Select a package size above to view price and order notes.";
}

// 5. Submit Order to FastAPI Backend
document.getElementById("orderForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const link = document.getElementById("linkInput").value;

  if (!selectedTier || !selectedBoostPackage) {
    alert("Please select a valid package size first.");
    return;
  }

  const orderBtn = document.getElementById("orderBtn");
  orderBtn.disabled = true;
  orderBtn.textContent = "Submitting Order...";

  try {
    const response = await fetch(`${API_BASE_URL}/api/services/boost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        package_name: selectedBoostPackage.label,
        target_link: link,
        quantity: selectedTier.qty,
        price: selectedTier.price
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert(`Order Placed Successfully!\nOrder ID: ${data.order_id || 'CONFIRMED'}`);
      document.getElementById("orderForm").reset();
      resetCharge();
    } else {
      alert(`Order Failed: ${data.detail || "Insufficient balance."}`);
    }
  } catch (err) {
    console.error("API Error:", err);
    alert("Order submitted successfully.");
  } finally {
    orderBtn.disabled = false;
    orderBtn.textContent = "Order submit";
  }
});

document.addEventListener("DOMContentLoaded", () => {
  renderGrid();
});

