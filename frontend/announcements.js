import { db } from "./firebase-config.js";
import { collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  loadAnnouncements();
});

function loadAnnouncements() {
  const container = document.getElementById("announcementsList");
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-state-box">No active announcements right now.</div>`;
      return;
    }

    container.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const card = document.createElement("div");
      card.className = "announcement-card";

      let dateStr = "";
      if (data.visibleUntil) {
        const d = data.visibleUntil.seconds ? new Date(data.visibleUntil.seconds * 1000) : new Date(data.visibleUntil);
        dateStr = `Visible until ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
      }

      card.innerHTML = `
        <span class="announcement-badge">Live announcement</span>
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #fff;">${data.title}</h3>
        <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 14px;">${data.body}</p>
        ${dateStr ? `<div style="font-size: 12px; color: var(--text-muted); opacity: 0.8;">${dateStr}</div>` : ''}
      `;

      container.appendChild(card);
    });
  }, (error) => {
    console.error("Error fetching announcements:", error);
    container.innerHTML = `<div class="empty-state-box">Failed to load announcements.</div>`;
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

