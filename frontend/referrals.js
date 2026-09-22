import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const code = await ensureReferralCode(user.uid);
    loadReferralStats(user.uid, code);
  } else {
    window.location.href = "login.html";
  }
});

// Ensures every user gets a STATIC referral code starting with FON-
async function ensureReferralCode(uid) {
  const userRef = doc(db, "users", uid);
  
  try {
    const snap = await getDoc(userRef);
    
    if (snap.exists() && snap.data().referralCode) {
      let code = snap.data().referralCode;
      
      // Auto-migrate legacy "GEN-" or "FONGOH-" codes to "FON-"
      if (code.startsWith("GEN-") || code.startsWith("FONGOH-")) {
        code = code.replace("GEN-", "FON-").replace("FONGOH-", "FON-");
        await setDoc(userRef, { referralCode: code }, { merge: true });
      }

      document.getElementById("userRefCode").innerText = code;
      return code;
    }

    // Generate new static code using user's UID snippet (e.g., FON-A8K29L)
    const uniqueSuffix = uid.substring(0, 6).toUpperCase();
    const staticCode = `FON-${uniqueSuffix}`;

    // Save to Firestore so it remains static
    await setDoc(userRef, { referralCode: staticCode }, { merge: true });

    document.getElementById("userRefCode").innerText = staticCode;
    return staticCode;

  } catch (err) {
    console.error("Error securing referral code:", err);
    const fallbackCode = `FON-${uid.substring(0, 6).toUpperCase()}`;
    document.getElementById("userRefCode").innerText = fallbackCode;
    return fallbackCode;
  }
}

// Fetch stats and referral records in real-time
function loadReferralStats(uid, referralCode) {
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
      card.style.cssText = "padding: 12px 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);";

      card.innerHTML = `
        <div>
          <div style="font-weight: 600; font-size: 14px; color: #fff;">${data.fullName || data.email || 'Referred User'}</div>
          <div style="font-size: 11px; color: var(--text-muted, #a1a1aa);">Joined via your code</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: #10B981; font-size: 14px;">+${earned.toFixed(2)} XAF</div>
        </div>
      `;

      container.appendChild(card);
    });

    document.getElementById("commissionEarned").innerText = `${totalEarned.toFixed(2)} XAF`;
  });
}

// Sidebar Drawer Control
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.querySelector(".menu-btn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const closeBtn = document.querySelector(".close-btn");

  const openNavbar = () => {
    if (sidebar) sidebar.classList.add("open", "active");
    if (overlay) overlay.classList.add("open", "active");
  };

  const closeNavbar = () => {
    if (sidebar) sidebar.classList.remove("open", "active");
    if (overlay) overlay.classList.remove("open", "active");
  };

  if (menuBtn) menuBtn.addEventListener("click", openNavbar);
  if (overlay) overlay.addEventListener("click", closeNavbar);
  if (closeBtn) closeBtn.addEventListener("click", closeNavbar);
});

