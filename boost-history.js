import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (user) {
    loadBoostHistory(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

function loadBoostHistory(uid) {
  const container = document.getElementById("boostHistoryContainer");
  const q = query(collection(db, "boost_orders"), where("userId", "==", uid));

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-state-box">No boost orders yet.</div>`;
      return;
    }

    container.innerHTML = "";
    snapshot.forEach((doc) => {
      const order = doc.data();
      const card = document.createElement("div");
      card.className = "glass-row";
      card.style.marginBottom = "12px";
      card.style.padding = "16px";

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
          <div>
            <div style="font-weight:600; font-size:15px; color:#fff;">${order.serviceName || 'Boost Order'}</div>
            <div style="font-size:12px; color:var(--text-muted);">Quantity: ${order.quantity || 0}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:#10B981;">$${parseFloat(order.charge || 0).toFixed(2)}</div>
            <span class="badge" style="background:rgba(16,185,129,0.15); color:#10B981; padding:2px 8px; border-radius:10px; font-size:10px;">${(order.status || 'PENDING').toUpperCase()}</span>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  });
}

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

// Sign Out Handler
const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.addEventListener("click", () => {
    // Clear local session storage if needed
    localStorage.clear();
    
    // Redirect to index.html
    window.location.href = "index.html";
  });
}

