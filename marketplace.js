// Firestore imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase Config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. Default accounts list with high-res SVG/PNG icons
const defaultAccounts = [
  {
    id: "def-1",
    title: "Old Google Voice",
    price: 3500,
    stock: 5,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/d/d7/Google_Voice_icon_%282020%29.svg"
  },
  {
    id: "def-2",
    title: "TextPlus",
    price: 1500,
    stock: 10,
    image_url: "https://img.icons8.com/color/144/message-squared.png"
  },
  {
    id: "def-3",
    title: "ExpressVPN",
    price: 2500,
    stock: 8,
    image_url: "https://img.icons8.com/color/144/expressvpn.png"
  },
  {
    id: "def-4",
    title: "Old Telegram",
    price: 2000,
    stock: 4,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg"
  },
  {
    id: "def-5",
    title: "Netflix",
    price: 2000,
    stock: 6,
    image_url: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_N_logo.svg"
  },
  {
    id: "def-6",
    title: "NordVPN",
    price: 2500,
    stock: 3,
    image_url: "https://img.icons8.com/color/144/nordvpn.png"
  }
];

let allAccounts = [];

// Get User's Current Wallet Balance (Reads from localStorage or dynamic state)
function getUserWalletBalance() {
  const balance = localStorage.getItem("userWalletBalance");
  return balance ? parseFloat(balance) : 0; // Default to 0 if not stored
}

// Switch Tabs between Buy and Bought
window.switchTab = function(tabName) {
  const tabs = document.querySelectorAll(".tab-btn");
  const buySection = document.getElementById("buySection");
  const boughtSection = document.getElementById("boughtSection");

  tabs.forEach(btn => btn.classList.remove("active"));

  if (tabName === "buy") {
    tabs[0].classList.add("active");
    buySection.classList.add("active");
    boughtSection.classList.remove("active");
  } else {
    tabs[1].classList.add("active");
    boughtSection.classList.add("active");
    buySection.classList.remove("active");
    loadBoughtAccounts();
  }
};

// Fetch accounts from both default list and Firestore
async function loadMarketplaceAccounts() {
  allAccounts = [...defaultAccounts];

  try {
    const querySnapshot = await getDocs(collection(db, "accounts"));
    querySnapshot.forEach((doc) => {
      allAccounts.push({ id: doc.id, ...doc.data() });
    });
  } catch (error) {
    console.log("Firestore accounts not loaded, displaying default accounts.");
  }

  renderAccounts(allAccounts);
}

// Render cards into the grid
function renderAccounts(accounts) {
  const container = document.getElementById("accountsContainer");
  container.innerHTML = "";

  if (!accounts || accounts.length === 0) {
    container.innerHTML = `<p style="color:#9ca3af; text-align:center; grid-column:1/-1; padding: 30px 0;">No accounts available right now.</p>`;
    return;
  }

  accounts.forEach(acc => {
    const isSoldOut = Number(acc.stock) <= 0;
    const card = document.createElement("div");
    card.className = `account-card ${isSoldOut ? "sold-out" : ""}`;

    card.innerHTML = `
      <img src="${acc.image_url}" alt="${acc.title}" class="account-img" onerror="this.src='https://img.icons8.com/color/144/gender-neutral-user.png'">
      <div class="account-title">${acc.title}</div>
      <div class="account-price">${acc.price} XAF</div>
      <div class="account-stock">${acc.stock} item${Number(acc.stock) !== 1 ? "s" : ""} left</div>
      
      ${
        isSoldOut
          ? `<div class="badge-sold-out">Sold Out</div>`
          : `<button class="buy-btn" onclick="handleBuy('${acc.id}', ${acc.price}, '${acc.title}')">Buy Now</button>`
      }
    `;

    container.appendChild(card);
  });
}

// In-App Wallet Purchase Handler
window.handleBuy = function(accId, price, title) {
  const currentBalance = getUserWalletBalance();

  if (currentBalance < price) {
    const confirmTopUp = confirm(
      `Insufficient wallet balance!\n\nYour balance: ${currentBalance} XAF\nItem price: ${price} XAF\n\nWould you like to top up your wallet now?`
    );

    if (confirmTopUp) {
      window.location.href = "add-funds.html";
    }
  } else {
    // Deduct balance and process order
    const newBalance = currentBalance - price;
    localStorage.setItem("userWalletBalance", newBalance.toString());

    alert(`Successfully purchased ${title}!`);
    window.location.reload();
  }
};

// Search Filter
window.filterAccounts = function() {
  const queryText = document.getElementById("searchInput").value.toLowerCase();
  const filtered = allAccounts.filter(acc => acc.title.toLowerCase().includes(queryText));
  renderAccounts(filtered);
};

// Bought accounts loader
async function loadBoughtAccounts() {
  const container = document.getElementById("boughtContainer");
  container.innerHTML = `<p style="color:#9ca3af; text-align:center; grid-column:1/-1; padding: 30px 0;">You haven't purchased any accounts yet.</p>`;
}

document.addEventListener("DOMContentLoaded", loadMarketplaceAccounts);

