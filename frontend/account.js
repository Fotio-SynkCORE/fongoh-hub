import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updatePassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // DO NOT REDIRECT AUTOMATICALLY — avoids infinite loop with index.html
    // Simply set default UI states if user is logged out
    const accountName = document.getElementById("accountName");
    const accountEmail = document.getElementById("accountEmail");
    const accountAvatar = document.getElementById("accountAvatar");
    const walletBalance = document.getElementById("walletBalance");

    if (accountName) accountName.innerText = "Guest User";
    if (accountEmail) accountEmail.innerText = "Please sign in";
    if (accountAvatar) accountAvatar.innerText = "GU";
    if (walletBalance) walletBalance.innerText = "0.00 XAF";
    return;
  }

  // Populate basic auth info
  const name = user.displayName || "Fongoh User";
  const nameElem = document.getElementById("accountName");
  const emailElem = document.getElementById("accountEmail");
  const inputElem = document.getElementById("fullNameInput");

  if (nameElem) nameElem.innerText = name;
  if (emailElem) emailElem.innerText = user.email || "";
  if (inputElem) inputElem.value = name;

  // Initials Avatar
  const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const avatarElem = document.getElementById("accountAvatar");
  if (avatarElem) avatarElem.innerText = initials || "FU";

  // Account creation date
  if (user.metadata && user.metadata.creationTime) {
    const createdDate = new Date(user.metadata.creationTime).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric"
    });
    const memberSince = document.getElementById("memberSince");
    if (memberSince) memberSince.innerText = createdDate;
  }

  // Fetch balance from Firestore safely
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const balanceElem = document.getElementById("walletBalance");
      if (balanceElem) {
        balanceElem.innerText = `${(data.balance || 0).toFixed(2)} XAF`;
      }
    }
  } catch (e) {
    console.error("Error fetching user document:", e);
  }
});

// Update Profile
document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
  const nameInput = document.getElementById("fullNameInput");
  const newName = nameInput ? nameInput.value.trim() : "";
  if (!newName) return alert("Please enter a name.");

  try {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: newName });
      alert("Profile updated successfully!");
      location.reload();
    }
  } catch (err) {
    alert("Error updating profile: " + err.message);
  }
});

// Update Password
document.getElementById("updatePasswordBtn")?.addEventListener("click", async () => {
  const passInput = document.getElementById("newPasswordInput");
  const newPass = passInput ? passInput.value : "";
  if (!newPass || newPass.length < 6) return alert("Password must be at least 6 characters.");

  try {
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, newPass);
      alert("Password updated successfully!");
      if (passInput) passInput.value = "";
    }
  } catch (err) {
    alert("Error updating password: " + err.message);
  }
});

// Sign Out Handler — Redirects explicitly to Welcome page
document.getElementById("signOutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("welcome.html"); // Change "welcome.html" if your welcome page filename is different
  } catch (err) {
    console.error("Error signing out:", err);
  }
});
