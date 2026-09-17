import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { listenBalance, listenTransactions } from "./user-data.js";

// Listen for Firebase Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await loadUserProfile(user);
    initDashboardListeners(user.uid);
  } else {
    window.location.href = "login.html";
  }
});

// Load dynamic user profile information
async function loadUserProfile(user) {
  let displayName = user.displayName || "";
  
  try {
    const userDocRef = doc(db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists() && snap.data().fullName) {
      displayName = snap.data().fullName;
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
  }

  if (!displayName) {
    displayName = user.email ? user.email.split("@")[0] : "User";
  }

  // Set dynamic welcome text
  const welcomeElem = document.getElementById("welcomeUser");
  if (welcomeElem) {
    welcomeElem.innerText = `Welcome back, ${displayName}.`;
  }

  // Update Avatar initials
  const topAvatar = document.getElementById("topAvatar");
  if (topAvatar) {
    const parts = displayName.trim().split(" ");
    const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase();
    topAvatar.innerText = initials;
  }
}

// Listen to User Transactions and Balance from Firestore
function initDashboardListeners(uid) {
  // Listen Balance
  listenBalance(uid, (balance) => {
    const balFormatted = `$${parseFloat(balance || 0).toFixed(2)}`;
    const dashBal = document.getElementById("dashboardBalance");
    if (dashBal) dashBal.innerText = balFormatted;
  });

  // Listen Transactions
  listenTransactions(uid, (transactions) => {
    const container = document.getElementById("dashboardTransactionsList");
    if (!container) return;

    if (!transactions || transactions.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted); font-size:14px; text-align:center; padding:16px 0;">No wallet transactions recorded yet.</p>`;
      return;
    }

    container.innerHTML = "";
    let totalSpentVal = 0;

    transactions.forEach((tx) => {
      if (tx.amount < 0 || tx.type === "purchase") {
        totalSpentVal += Math.abs(tx.amount || 0);
      }

      const row = document.createElement("div");
      row.className = "glass-row";

      const status = tx.status || "PENDING";
      const statusColor = status.toLowerCase() === "completed" ? "#10B981" : "#F59E0B";

      let timeFormatted = "Recently";
      if (tx.createdAt && tx.createdAt.seconds) {
        const d = new Date(tx.createdAt.seconds * 1000);
        timeFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + `, ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
      }

      row.innerHTML = `
        <div class="row-body" style="padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div>
            <div class="row-title" style="font-size: 14px; font-weight: 600; color: #fff;">
              ${tx.method ? `Wallet top-up via ${tx.method}` : tx.description || 'Transaction'}
            </div>
            <p class="row-sub" style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${timeFormatted}</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 700; color: #F59E0B;">$${parseFloat(tx.amount || 0).toFixed(2)}</div>
            <span class="badge" style="color:${statusColor}; font-size: 10px; font-weight: 700; letter-spacing: 0.05em;">${status.toUpperCase()}</span>
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    const spentElem = document.getElementById("totalSpent");
    if (spentElem) spentElem.innerText = `$${totalSpentVal.toFixed(2)}`;
  });
}

// Sign-out action
document.getElementById("signOutBtn")?.addEventListener("click", () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
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

