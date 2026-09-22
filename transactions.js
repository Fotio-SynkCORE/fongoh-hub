import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let rawTransactions = [];

onAuthStateChanged(auth, (user) => {
  if (user) {
    initTransactionsPage(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

function initTransactionsPage(uid) {
  // Toggle Filters Collapsible
  const toggleBtn = document.getElementById("toggleFilterBtn");
  const filterPanel = document.getElementById("filterPanel");
  const filterArrow = document.getElementById("filterArrow");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      filterPanel.classList.toggle("open");
      filterArrow.innerText = filterPanel.classList.contains("open") ? "▲" : "▼";
    });
  }

  // Event Listeners for Filters & Search
  document.getElementById("searchInput")?.addEventListener("input", applyFilters);
  document.getElementById("statusFilter")?.addEventListener("change", applyFilters);
  document.getElementById("fromDate")?.addEventListener("change", applyFilters);
  document.getElementById("toDate")?.addEventListener("change", applyFilters);
  document.getElementById("minAmount")?.addEventListener("input", applyFilters);
  document.getElementById("maxAmount")?.addEventListener("input", applyFilters);

  // Firestore Realtime Listener - Strictly filtered by authenticated user ID
  const q = query(collection(db, "transactions"), where("userId", "==", uid));

  onSnapshot(q, (snapshot) => {
    rawTransactions = [];
    snapshot.forEach((doc) => {
      rawTransactions.push({ id: doc.id, ...doc.data() });
    });
    sortAndApply();
  }, (error) => {
    console.error("Firestore listener error:", error);
    const container = document.getElementById("transactionsContainer");
    if (container) {
      container.innerHTML = `<div class="empty-state-box">No transactions found yet or insufficient permissions.</div>`;
    }
  });
}

function sortAndApply() {
  rawTransactions.sort((a, b) => {
    const tA = a.createdAt?.seconds || a.timestamp?.seconds || 0;
    const tB = b.createdAt?.seconds || b.timestamp?.seconds || 0;
    return tB - tA;
  });
  applyFilters();
}

function applyFilters() {
  const searchTerm = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const statusVal = document.getElementById("statusFilter")?.value || "all";
  const fromDateVal = document.getElementById("fromDate")?.value;
  const toDateVal = document.getElementById("toDate")?.value;
  const minAmt = parseFloat(document.getElementById("minAmount")?.value);
  const maxAmt = parseFloat(document.getElementById("maxAmount")?.value);

  const filtered = rawTransactions.filter(tx => {
    // Search Query
    const desc = (tx.description || tx.method || tx.type || "").toLowerCase();
    const provider = (tx.gateway || tx.provider || "").toLowerCase();
    if (searchTerm && !desc.includes(searchTerm) && !provider.includes(searchTerm)) {
      return false;
    }

    // Status Mapping
    const txStatus = (tx.status || "PENDING").toLowerCase();
    if (statusVal !== "all") {
      if (statusVal === "completed" && txStatus !== "success" && txStatus !== "completed") return false;
      if (statusVal === "pending" && txStatus !== "pending") return false;
      if (statusVal === "failed" && txStatus !== "failed") return false;
    }

    // Amount Range
    const amt = Math.abs(parseFloat(tx.amount || 0));
    if (!isNaN(minAmt) && amt < minAmt) return false;
    if (!isNaN(maxAmt) && amt > maxAmt) return false;

    // Date Range
    const timestamp = tx.createdAt || tx.timestamp;
    if (timestamp && timestamp.seconds) {
      const txDate = new Date(timestamp.seconds * 1000);
      if (fromDateVal) {
        const fDate = new Date(fromDateVal);
        fDate.setHours(0,0,0,0);
        if (txDate < fDate) return false;
      }
      if (toDateVal) {
        const tDate = new Date(toDateVal);
        tDate.setHours(23,59,59,999);
        if (txDate > tDate) return false;
      }
    }

    return true;
  });

  renderList(filtered);
}

function renderList(list) {
  const container = document.getElementById("transactionsContainer");
  const countLabel = document.getElementById("txCountLabel");

  if (countLabel) {
    countLabel.innerText = `Showing ${list.length} of ${rawTransactions.length} transactions`;
  }

  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state-box">No transactions recorded yet.</div>`;
    return;
  }

  container.innerHTML = "";

  list.forEach(tx => {
    const rawStatus = (tx.status || "PENDING").toUpperCase();
    let statusClass = "status-pending";
    if (rawStatus === "SUCCESS" || rawStatus === "COMPLETED") statusClass = "status-success";
    if (rawStatus === "FAILED") statusClass = "status-failed";

    const title = tx.type || tx.description || tx.method || "Wallet Transaction";
    const amount = parseFloat(tx.amount || 0);
    const isPositive = amount >= 0 || title.toLowerCase().includes("top-up");

    let dateStr = "Recent";
    const timestamp = tx.createdAt || tx.timestamp;
    if (timestamp && timestamp.seconds) {
      const d = new Date(timestamp.seconds * 1000);
      dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + `, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    const card = document.createElement("div");
    card.style.cssText = "background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 14px 16px; display: flex; justify-content: space-between; align-items: center;";

    card.innerHTML = `
      <div>
        <div style="font-weight: 600; font-size: 14px; color: #fff;">${title}</div>
        <div style="font-size: 12px; color: #9ca3af; margin-top: 4px;">${dateStr}</div>
      </div>
      <div style="text-align: right;">
        <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 15px; color: ${isPositive ? '#10B981' : '#fff'};">
          ${isPositive ? '+' : ''}${amount}.00 XAF
        </div>
        <span class="status-badge ${statusClass}" style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 4px;">
          ${rawStatus}
        </span>
      </div>
    `;

    container.appendChild(card);
  });
}

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

