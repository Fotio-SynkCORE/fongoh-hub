import { services } from "./data.js";
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const API_BASE_URL = "http://127.0.0.1:8000";

// Load user favorites from LocalStorage
let favorites = JSON.parse(localStorage.getItem("fongoh_favorites") || "[]");

// Clean Initial Helper Function ("Faith" -> "F")
function extractInitial(user) {
  if (user && user.displayName) {
    const cleanName = user.displayName.trim();
    if (cleanName.length > 0) {
      return cleanName[0].toUpperCase();
    }
  }
  if (user && user.email) {
    return user.email[0].toUpperCase();
  }
  return "F";
}

// Authentication Guard & User Initial Sync (NO AUTO-REDIRECT BOUNCE)
onAuthStateChanged(auth, async (user) => {
  const topAvatar = document.getElementById("topAvatar");
  const balanceEl = document.getElementById("balanceAmount");

  if (!user) {
    // If not signed in, set defaults safely without redirecting/bouncing
    if (topAvatar) topAvatar.innerText = "?";
    if (balanceEl) balanceEl.innerText = "0.00 XAF";
    return;
  }

  // Update topbar avatar initial dynamically when user is verified
  if (topAvatar) {
    topAvatar.innerText = extractInitial(user);
  }

  // Fetch balance from Firestore safely
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (balanceEl) {
        balanceEl.innerText = `${(data.balance || 0).toFixed(2)} XAF`;
      }
    }
  } catch (err) {
    console.warn("Firestore balance load warning:", err.message);
  }
});

// Render service list with favorite toggle hearts
function renderServices(list) {
  const container = document.getElementById("serviceList");
  if (!container) return;
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:14px; text-align:center; padding:20px 0;">No services match your search.</p>`;
    return;
  }

  list.forEach((s) => {
    const card = document.createElement("div");
    card.className = "service-card";
    card.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 10px; cursor: pointer;";

    const isFav = favorites.includes(s.slug);

    card.innerHTML = `
      <div class="service-info" style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <button class="fav-heart-btn" data-slug="${s.slug}" title="Toggle favorite">
          ${isFav ? "❤️" : "🤍"}
        </button>
        <div class="service-badge" style="background:${s.badgeBg}; color:${s.iconColor}">
          ${s.iconSvg}
        </div>
        <div class="service-text">
          <span class="service-name">${s.name}</span>
          <span class="service-count">${s.count} pcs</span>
        </div>
      </div>
      <span class="service-price">${s.price} XAF</span>
    `;

    // Click on main row navigates to country select
    card.addEventListener("click", (e) => {
      if (e.target.closest(".fav-heart-btn")) return; // Don't redirect on heart click
      window.location.href = `country-select.html?serviceSlug=${encodeURIComponent(s.slug)}&serviceName=${encodeURIComponent(s.name)}`;
    });

    container.appendChild(card);
  });

  // Attach heart click listeners
  document.querySelectorAll(".fav-heart-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slug = btn.getAttribute("data-slug");
      toggleFavorite(slug);
    });
  });

  updateFavoritesUI();
}

// Favorite Toggle Logic
function toggleFavorite(slug) {
  if (favorites.includes(slug)) {
    favorites = favorites.filter((item) => item !== slug);
  } else {
    favorites.push(slug);
  }
  localStorage.setItem("fongoh_favorites", JSON.stringify(favorites));

  const searchInput = document.getElementById("searchInput");
  const query = searchInput ? searchInput.value.toLowerCase() : "";
  renderServices(services.filter((s) => s.name.toLowerCase().includes(query)));
}

// Favorites UI & Accordion Drawer
function updateFavoritesUI() {
  const badge = document.getElementById("favoritesBadge");
  if (badge) {
    badge.innerText = `${favorites.length}/${services.length}`;
  }

  const favList = document.getElementById("favoritesList");
  if (!favList) return;

  const favServices = services.filter((s) => favorites.includes(s.slug));

  if (favServices.length === 0) {
    favList.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">No favorite services added yet. Click 🤍 on any service below!</p>`;
    return;
  }

  favList.innerHTML = favServices
    .map(
      (s) => `
    <a href="country-select.html?serviceSlug=${encodeURIComponent(s.slug)}&serviceName=${encodeURIComponent(s.name)}" 
       style="display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.08); padding: 6px 10px; border-radius: 12px; color: #fff; text-decoration: none; font-size: 12px;">
      <span>${s.name}</span>
    </a>
  `
    )
    .join("");
}

// Search Filter
function filterServices() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  const query = input.value.toLowerCase();
  renderServices(services.filter((s) => s.name.toLowerCase().includes(query)));
}

window.filterServices = filterServices;

// Favorites Row Accordion Toggle
document.getElementById("favoritesRow")?.addEventListener("click", () => {
  const dropdown = document.getElementById("favoritesDropdown");
  const chevron = document.getElementById("favChevron");
  if (dropdown) {
    dropdown.classList.toggle("open");
    if (chevron) {
      chevron.innerText = dropdown.classList.contains("open") ? "⌃" : "⌄";
    }
  }
});

// Sidebar Navigation Controls
function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("open");
}

window.openSidebar = openSidebar;

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
}

window.closeSidebar = closeSidebar;

// Sign Out Handler
document.getElementById("signOutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("index.html");
});

// Bottom nav highlight
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Initialize Page
document.addEventListener("DOMContentLoaded", () => {
  renderServices(services);
});

