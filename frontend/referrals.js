import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const code = await ensureReferralCode(user.uid);
    loadReferralStats(user.uid, code);
  } else {
    window.location.href = "login.html";
  }
});

// Ensures every user has a dynamic referral code
async function ensureReferralCode(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  
  if (snap.exists() && snap.data().referralCode) {
    const code = snap.data().referralCode;
    document.getElementById("userRefCode").innerText = code;
    return code;
  }

  // Generate a code if none exists
  const generatedCode = "GEN-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  try {
    await updateDoc(userRef, { referralCode: generatedCode });
  } catch (err) {
    console.error("Error setting referral code:", err);
  }

  document.getElementById("userRefCode").innerText = generatedCode;
  return generatedCode;
}

// Fetch stats and referral records in real-time
function loadReferralStats(uid, referralCode) {
  // Listen to referred users
  const q = query(collection(db, "users"), where("referredBy", "==", referralCode));
  
  onSnapshot(q, (snapshot) => {
    const count = snapshot.size;
    document.getElementById("usersReferredCount").innerText = count;

    const container = document.getElementById("referralsList");
    if (!container) return;

    if (snapshot.empty) {
      container.innerHTML = `<div class="empty-state-box">No referrals recorded yet.</div>`;
      return;
    }

    container.innerHTML = "";
    let totalEarned = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const earned = parseFloat(data.commissionFromUser || 0);
      totalEarned += earned;

      const card = document.createElement("div");
      card.className = "glass-row";
      card.style.padding = "12px 16px";
      card.style.marginBottom = "8px";
      card.style.display = "flex";
      card.style.justifyContent = "space-between";
      card.style.alignItems = "center";
      card.style.background = "rgba(255,255,255,0.02)";
      card.style.borderRadius = "10px";

      card.innerHTML = `
        <div>
          <div style="font-weight: 600; font-size: 14px; color: #fff;">${data.fullName || data.email || 'Referred User'}</div>
          <div style="font-size: 11px; color: var(--text-muted);">Joined via your code</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: #10B981; font-size: 14px;">+$${earned.toFixed(2)}</div>
        </div>
      `;

      container.appendChild(card);
    });

    document.getElementById("commissionEarned").innerText = `$${totalEarned.toFixed(2)}`;
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

