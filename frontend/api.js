import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const API_BASE_URL = "https://fongoh-hub-production.up.railway.app";

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

  if (generateBtn) {
    generateBtn.addEventListener("click", () => handleGenerateKey(user));
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", handleCopyKey);
  }

  // Real-time listener for user's API keys in Firestore
  const q = query(collection(db, "api_keys"), where("userId", "==", user.uid));

  onSnapshot(q, (snapshot) => {
    const keys = [];
    snapshot.forEach((doc) => {
      keys.push({ id: doc.id, ...doc.data() });
    });

    // Sort newest first
    keys.sort((a, b) => {
      const tA = a.createdAt?.seconds || 0;
      const tB = b.createdAt?.seconds || 0;
      return tB - tA;
    });

    renderKeysUI(user, keys);
  }, (err) => {
    console.error("Error fetching API keys:", err);
  });
}

function renderKeysUI(user, keys) {
  const statusTitle = document.getElementById("keyStatusTitle");
  const btnText = document.getElementById("generateBtnText");
  const historyContainer = document.getElementById("keysHistoryList");

  const activeKey = keys.find(k => k.status === "active");

  if (statusTitle && btnText) {
    if (activeKey) {
      statusTitle.innerText = "Your API key is active";
      btnText.innerText = "Regenerate key";
    } else {
      statusTitle.innerText = "No active API key";
      btnText.innerText = "Generate key";
    }
  }

  if (!historyContainer) return;

  if (keys.length === 0) {
    historyContainer.innerHTML = "";
    return;
  }

  historyContainer.innerHTML = "";

  keys.forEach((k) => {
    const isActive = k.status === "active";
    const maskedKey = k.maskedKey || (k.prefix ? `${k.prefix}...` : "fhk_live_...");
    
    let createdDate = "Recent";
    if (k.createdAt && k.createdAt.seconds) {
      const d = new Date(k.createdAt.seconds * 1000);
      createdDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + `, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    let lastUsedDate = "Never";
    if (k.lastUsedAt && k.lastUsedAt.seconds) {
      const d = new Date(k.lastUsedAt.seconds * 1000);
      lastUsedDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    const card = document.createElement("div");
    card.className = "api-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>🔑</span>
          <span style="font-family: monospace; font-size: 14px; font-weight: 600; color: #fff;">${maskedKey}</span>
        </div>
        <span class="${isActive ? 'badge-active' : 'badge-revoked'}">${k.status || 'revoked'}</span>
      </div>

      <div class="key-stat-grid">
        <div>
          <span style="color: var(--text-muted, #a1a1aa);">Requests</span><br>
          <strong style="color: #fff; font-size: 13px;">${k.requestCount || 0}</strong>
        </div>
        <div>
          <span style="color: var(--text-muted, #a1a1aa);">Last used</span><br>
          <strong style="color: #fff; font-size: 13px;">${lastUsedDate}</strong>
        </div>
        <div>
          <span style="color: var(--text-muted, #a1a1aa);">Created</span><br>
          <strong style="color: #fff; font-size: 13px;">${createdDate}</strong>
        </div>
      </div>

      ${isActive ? `<button class="btn-revoke" id="revokeBtn_${k.id}">🗑️ Revoke</button>` : ''}
    `;

    historyContainer.appendChild(card);

    if (isActive) {
      document.getElementById(`revokeBtn_${k.id}`)?.addEventListener("click", () => handleRevokeKey(user, k.id));
    }
  });
}

// Generate Key via Python FastAPI endpoint
async function handleGenerateKey(user) {
  const generateBtn = document.getElementById("generateKeyBtn");
  if (generateBtn) generateBtn.disabled = true;

  try {
    const idToken = await user.getIdToken();

    const response = await fetch(`${BACKEND_URL}/api/keys/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const rawKey = data.apiKey;

      const secretDisplay = document.getElementById("secretKeyDisplay");
      const copyBanner = document.getElementById("copyBanner");

      if (secretDisplay) secretDisplay.innerText = rawKey;
      if (copyBanner) copyBanner.classList.add("active");

    } else {
      const data = await response.json();
      alert(data.detail || "Failed to generate key.");
    }

  } catch (err) {
    console.error("Error generating key on backend:", err);
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

// Sidebar Drawer Control
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.querySelector(".menu-btn, .hamburger-btn, [aria-label='Open menu']");
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

