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

  // Setup Event Listeners for Filters & Search
  document.getElementById("searchInput")?.addEventListener("input", applyFilters);
  document.getElementById("statusFilter")?.addEventListener("change", applyFilters);
  document.getElementById("fromDate")?.addEventListener("change", applyFilters);
  document.getElementById("toDate")?.addEventListener("change", applyFilters);
  document.getElementById("minAmount")?.addEventListener("input", applyFilters);
  document.getElementById("maxAmount")?.addEventListener("input", applyFilters);

  // Firestore Realtime Listener
  const q = query(collection(db, "transactions"), where("userId", "==", uid));
  onSnapshot(q, (snapshot) => {
    rawTransactions = [];
    snapshot.forEach((doc) => {
      rawTransactions.push({ id: doc.id, ...doc.data() });
    });

    // Sort newest first
    rawTransactions.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });

    applyFilters();
  });
}

function applyFilters() {
  const searchTerm = document.getElementById("searchInput")?.value.toLowerCase().trim() || "";
  const statusVal = document.getElementById("statusFilter")?.value || "all";
  const fromDateVal = document.getElementById("fromDate")?.value;
  const toDateVal = document.getElementById("toDate")?.value;
  const minAmt = parseFloat(document.getElementById("minAmount")?.value);
  const maxAmt = parseFloat(document.getElementById("maxAmount")?.value);

  const filtered = rawTransactions.filter(tx => {
    // 1. Search Query
    const desc = (tx.description || tx.method || "").toLowerCase();
    const provider = (tx.gateway || tx.provider || "").toLowerCase();
    if (searchTerm && !desc.includes(searchTerm) && !provider.includes(searchTerm)) {
      return false;
    }

    // 2. Status
    const txStatus = (tx.status || "PENDING").toLowerCase();
    if (statusVal !== "all" && txStatus !== statusVal) {
      return false;
    }

    // 3. Amount Range
    const amt = Math.abs(parseFloat(tx.amount || 0));
    if (!isNaN(minAmt) && amt < minAmt) return false;
    if (!isNaN(maxAmt) && amt > maxAmt) return false;

    // 4. Date Range
    if (tx.createdAt && tx.createdAt.seconds) {
      const txDate = new Date(tx.createdAt.seconds * 1000);
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
    container.innerHTML = `<div class="empty-state-box">No transactions match your criteria.</div>`;
    return;
  }

  container.innerHTML = "";
  list.forEach((tx) => {
    const card = document.createElement("div");
    card.className = "glass-row";
    card.style.padding = "14px 16px";
    card.style.display = "flex";
    card.style.justifyContent = "space-between";
    card.style.alignItems = "center";
    card.style.background = "rgba(255,255,255,0.02)";
    card.style.border = "1px solid rgba(255,255,255,0.06)";
    card.style.borderRadius = "12px";

    const status = (tx.status || "PENDING").toUpperCase();
    const statusColor = status === "COMPLETED" ? "#10B981" : status === "FAILED" ? "#EF4444" : "#F59E0B";

    let dateFormatted = "Recently";
    if (tx.createdAt && tx.createdAt.seconds) {
      const d = new Date(tx.createdAt.seconds * 1000);
      dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + `, ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
    }

    const gatewayTag = tx.provider || tx.gateway || (tx.method ? tx.method.toUpperCase() : "WALLET");

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: rgba(245, 158, 11, 0.15); display: flex; align-items: center; justify-content: center; font-size: 16px;">
          ⏳
        </div>
        <div>
          <div style="font-weight: 600; font-size: 14px; color: #fff;">
            ${tx.description || `Wallet top-up via ${tx.method || 'Online'}`}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${dateFormatted}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
          <span style="background: rgba(255,255,255,0.08); font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; color: #aaa;">${gatewayTag}</span>
          <span style="font-weight: 700; font-size: 14px; color: #F59E0B;">$${parseFloat(tx.amount || 0).toFixed(2)}</span>
        </div>
        <span class="badge" style="color: ${statusColor}; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; display: inline-block; margin-top: 4px;">${status}</span>
      </div>
    `;

    container.appendChild(card);
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

