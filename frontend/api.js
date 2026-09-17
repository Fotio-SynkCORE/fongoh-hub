import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const BACKEND_URL = "http://127.0.0.1:8000"; // Python FastAPI server
let userKeys = [];

onAuthStateChanged(auth, (user) => {
  if (user) {
    initApiPage(user);
  } else {
    window.location.href = "login.html";
  }
});

function initApiPage(user) {
  const generateBtn = document.getElementById("generateKeyBtn");
  const copyBtn = document.getElementById("copyKeyBtn");

  generateBtn?.addEventListener("click", () => handleGenerateKey(user));
  copyBtn?.addEventListener("click", handleCopyKey);

  // Listen to user's keys stored in Firestore
  const q = query(collection(db, "api_keys"), where("userId", "==", user.uid));

  onSnapshot(q, (snapshot) => {
    userKeys = [];
    snapshot.forEach((docSnap) => {
      userKeys.push({ id: docSnap.id, ...docSnap.data() });
    });

    userKeys.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderKeysUI(user);
  });
}

function renderKeysUI(user) {
  const statusTitle = document.getElementById("keyStatusTitle");
  const generateBtnText = document.getElementById("generateBtnText");
  const historyContainer = document.getElementById("keysHistoryList");

  const activeKey = userKeys.find(k => k.status === "active");

  if (activeKey) {
    if (statusTitle) statusTitle.innerText = "Your API key is active";
    if (generateBtnText) generateBtnText.innerText = "Regenerate key";
  } else {
    if (statusTitle) statusTitle.innerText = "No active API key";
    if (generateBtnText) generateBtnText.innerText = "Generate key";
  }

  if (!historyContainer) return;
  historyContainer.innerHTML = "";

  userKeys.forEach((keyData) => {
    const card = document.createElement("div");
    card.className = "api-card";

    const isActive = keyData.status === "active";
    const statusBadge = isActive 
      ? `<span class="badge-active">Active</span>` 
      : `<span class="badge-revoked">Revoked</span>`;

    let createdDateStr = "Recently";
    if (keyData.createdAt && keyData.createdAt.seconds) {
      const d = new Date(keyData.createdAt.seconds * 1000);
      createdDateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + `, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🔑</span>
          <span style="font-family: monospace; font-size: 14px; font-weight: 600; color: #fff;">${keyData.maskedKey || "gnk_live_••••••••"}</span>
        </div>
        ${statusBadge}
      </div>

      <div class="key-stat-grid">
        <div>
          <div style="color: var(--text-muted); font-weight: 500;">Requests</div>
          <div style="font-size: 13px; font-weight: 600; color: #fff; margin-top: 2px;">${keyData.requestsCount || 0}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-weight: 500;">Last used</div>
          <div style="font-size: 13px; font-weight: 600; color: #fff; margin-top: 2px;">${keyData.lastUsed || "Never"}</div>
        </div>
        <div>
          <div style="color: var(--text-muted); font-weight: 500;">Created</div>
          <div style="font-size: 13px; font-weight: 600; color: #fff; margin-top: 2px;">${createdDateStr}</div>
        </div>
      </div>

      ${isActive ? `<button class="btn-revoke" data-id="${keyData.id}">🗑️ Revoke</button>` : ''}
    `;

    if (isActive) {
      card.querySelector(".btn-revoke")?.addEventListener("click", () => handleRevokeKey(user, keyData.id));
    }

    historyContainer.appendChild(card);
  });
}

// Send request to Python FastAPI endpoint
async function handleGenerateKey(user) {
  const generateBtn = document.getElementById("generateKeyBtn");
  try {
    if (generateBtn) generateBtn.disabled = true;
    
    const idToken = await user.getIdToken();
    
    const response = await fetch(`${BACKEND_URL}/api/keys/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      const copyBanner = document.getElementById("copyBanner");
      const secretDisplay = document.getElementById("secretKeyDisplay");

      if (secretDisplay) secretDisplay.innerText = data.rawSecretKey;
      if (copyBanner) copyBanner.classList.add("active");
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert(data.detail || "Failed to generate API key.");
    }

  } catch (err) {
    console.error("Error communicating with Python backend:", err);
    alert("Backend connection error. Make sure FastAPI server is running.");
  } finally {
    if (generateBtn) generateBtn.disabled = false;
  }
}

// Revoke via Python FastAPI endpoint
async function handleRevokeKey(user, keyId) {
  if (!confirm("Are you sure you want to revoke this API key?")) return;

  try {
    const idToken = await user.getIdToken();
    
    const response = await fetch(`${BACKEND_URL}/api/keys/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ keyId })
    });

    if (response.ok) {
      document.getElementById("copyBanner")?.classList.remove("active");
    } else {
      const data = await response.json();
      alert(data.detail || "Failed to revoke key.");
    }

  } catch (err) {
    console.error("Error revoking key:", err);
    alert("Backend connection error.");
  }
}

function handleCopyKey() {
  const secretDisplay = document.getElementById("secretKeyDisplay");
  if (!secretDisplay) return;

  navigator.clipboard.writeText(secretDisplay.innerText).then(() => {
    const copyBtn = document.getElementById("copyKeyBtn");
    if (copyBtn) {
      copyBtn.innerText = "✓ Copied!";
      setTimeout(() => { copyBtn.innerText = "📋 Copy"; }, 2000);
    }
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

