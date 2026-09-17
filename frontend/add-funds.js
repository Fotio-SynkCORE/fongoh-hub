import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  listenBalance, 
  listenTransactions, 
  createTopUpRequest, 
  ensureUserDoc 
} from "./user-data.js";

const API_BASE_URL = "http://127.0.0.1:8000";

let currentUser = null;
let unsubscribeBalance = null;
let unsubscribeTransactions = null;

// Initialize Authentication Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await ensureUserDoc(user);
    initWalletListeners(user.uid);
  } else {
    currentUser = null;
    cleanupListeners();
    const balanceElem = document.getElementById("balanceAmount");
    if (balanceElem) balanceElem.innerText = "0.00 XAF";
    
    const txContainer = document.getElementById("transactionsList");
    if (txContainer) {
      txContainer.innerHTML = `
        <p style="color:#9ca3af; font-size:14px; text-align:center; padding:20px 0;">
          Please sign in to view your wallet balance and transactions.
        </p>`;
    }
  }
});

function initWalletListeners(uid) {
  cleanupListeners();

  // 1. Real-Time Balance Listener
  unsubscribeBalance = listenBalance(uid, (balance) => {
    const balanceElem = document.getElementById("balanceAmount");
    if (balanceElem) {
      balanceElem.innerText = `${parseFloat(balance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} XAF`;
    }
  });

  // 2. Real-Time Transactions Listener
  unsubscribeTransactions = listenTransactions(uid, (txs) => {
    const container = document.getElementById("transactionsList");
    if (!container) return;

    if (!txs || txs.length === 0) {
      container.innerHTML = `<p style="color:#9ca3af; font-size:14px; text-align:center; padding:20px 0;">No wallet transactions yet.</p>`;
      return;
    }

    container.innerHTML = "";
    txs.forEach((tx) => {
      const row = document.createElement("div");
      row.className = "tx-row";

      const isCompleted = tx.status === "completed" || tx.status === "SUCCESS";
      const isFailed = tx.status === "failed" || tx.status === "EXPIRED";
      
      const statusColor = isCompleted ? "#10B981" : isFailed ? "#EF4444" : "#F59E0B";
      const displayAmount = tx.amount > 0 ? `+${parseFloat(tx.amount).toFixed(2)} XAF` : `-${Math.abs(parseFloat(tx.amount)).toFixed(2)} XAF`;

      let dateStr = "Recently";
      if (tx.createdAt && tx.createdAt.seconds) {
        dateStr = new Date(tx.createdAt.seconds * 1000).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
        });
      }

      row.innerHTML = `
        <div>
          <div style="font-weight: 600; font-size: 14px; color: #fff;">Top-up via MOMO</div>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 2px;">${dateStr}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: ${statusColor}; font-size: 14px;">${displayAmount}</div>
          <span style="display: inline-block; background: rgba(255,255,255,0.05); color: ${statusColor}; border: 1px solid ${statusColor}40; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-transform: uppercase; margin-top: 4px;">
            ${tx.status || 'pending'}
          </span>
        </div>
      `;
      container.appendChild(row);
    });
  });
}

function cleanupListeners() {
  if (unsubscribeBalance) unsubscribeBalance();
  if (unsubscribeTransactions) unsubscribeTransactions();
}

// Modal Toggle Functions
export function openPaymentModal() {
  const activeUser = currentUser || auth.currentUser;

  if (!activeUser) {
    alert("Authentication loading... Please wait a moment and try again.");
    return;
  }

  const modal = document.getElementById("paymentModal");
  const overlay = document.getElementById("paymentOverlay");

  if (modal) modal.classList.add("open");
  if (overlay) overlay.classList.add("open");
}

export function closePaymentModal() {
  const modal = document.getElementById("paymentModal");
  const overlay = document.getElementById("paymentOverlay");

  if (modal) modal.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
}

export function setQuickAmount(val) {
  const amountInput = document.getElementById("amountInput");
  if (amountInput) amountInput.value = val;
  
  document.querySelectorAll('.amount-chip').forEach(chip => {
    chip.classList.toggle('active', chip.innerText.includes(val.toLocaleString()));
  });
}

window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.setQuickAmount = setQuickAmount;

// Form Submission Handler
document.getElementById("paymentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const activeUser = currentUser || auth.currentUser;

  if (!activeUser) {
    alert("You must be logged in to proceed.");
    return;
  }

  const amountInput = document.getElementById("amountInput");
  const payBtn = document.getElementById("paySubmitBtn");
  const amount = parseFloat(amountInput.value);

  if (isNaN(amount) || amount < 2000) {
    alert("Minimum top-up amount is 2000 XAF.");
    return;
  }

  payBtn.disabled = true;
  payBtn.innerText = "Connecting to Fapshi...";

  try {
    // 1. Store Pending Transaction record in Firestore (phone included to prevent undefined errors)
    await createTopUpRequest(activeUser.uid, {
      amount: amount,
      currency: "XAF",
      method: "MOMO (Fapshi)",
      status: "pending",
      phone: activeUser.phoneNumber || ""
    });

    // 2. Request Fapshi Hosted Checkout Link from Backend
    const response = await fetch(`${API_BASE_URL}/api/payments/fapshi/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: activeUser.uid,
        email: activeUser.email,
        amount: amount
      })
    });

    const data = await response.json();

    if (data && data.link) {
      window.location.href = data.link; // Redirects to checkout.fapshi.com
      return;
    } else {
      throw new Error(data.message || "Failed to generate checkout link.");
    }

  } catch (error) {
    console.error("Fapshi top-up error:", error);
    alert("Could not process Mobile Money request: " + error.message);
  } finally {
    payBtn.disabled = false;
    payBtn.innerText = "Pay with Mobile Money";
  }
});

