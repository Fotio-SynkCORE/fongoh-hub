import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "./firebase-config.js";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ensureUserDoc } from "./user-data.js";

let mode = "login"; // "login" or "signup"

// Tab Switcher
export function switchTab(newMode) {
  mode = newMode;

  const tabLogin = document.getElementById("tabLogin");
  const tabSignup = document.getElementById("tabSignup");
  const nameField = document.getElementById("nameField");
  const confirmField = document.getElementById("confirmField");
  const termsRow = document.getElementById("termsRow");
  const submitBtn = document.getElementById("submitBtn");
  const authSub = document.getElementById("authSub");
  const forgotRow = document.getElementById("forgotRow");

  showError(""); // Clear active errors

  if (mode === "login") {
    tabLogin?.classList.add("active");
    tabSignup?.classList.remove("active");
    nameField?.classList.add("hidden");
    confirmField?.classList.add("hidden");
    termsRow?.classList.add("hidden");
    forgotRow?.classList.remove("hidden");
    if (submitBtn) submitBtn.innerText = "Sign in";
    if (authSub) authSub.innerText = "Sign in to manage your orders, wallet, and account settings.";
  } else {
    tabSignup?.classList.add("active");
    tabLogin?.classList.remove("active");
    nameField?.classList.remove("hidden");
    confirmField?.classList.remove("hidden");
    termsRow?.classList.remove("hidden");
    forgotRow?.classList.add("hidden");
    if (submitBtn) submitBtn.innerText = "Create Account";
    if (authSub) authSub.innerText = "Create an account to access virtual numbers and services.";
  }
}

// Global window access for inline onclick attributes
window.switchTab = switchTab;

// DOM Event Bindings
document.addEventListener("DOMContentLoaded", () => {
  // Tab Event Listeners
  document.getElementById("tabLogin")?.addEventListener("click", () => switchTab("login"));
  document.getElementById("tabSignup")?.addEventListener("click", () => switchTab("signup"));

  // Google Authentication Button Listener
  const googleBtn = document.getElementById("googleBtn") || document.querySelector(".google-btn");
  if (googleBtn) {
    googleBtn.addEventListener("click", handleGoogleAuth);
  }
});

// Google Sign-In Handler
async function handleGoogleAuth() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDoc(result.user);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Google Auth Error:", error);
    showError(formatFirebaseError(error.code || error.message));
  }
}

// Email/Password Form Submit Handler
document.getElementById("authForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const name = document.getElementById("name")?.value.trim();
  const confirmPassword = document.getElementById("confirmPassword")?.value;
  const termsCheck = document.getElementById("termsCheck")?.checked;
  const submitBtn = document.getElementById("submitBtn");

  showError(""); // Reset error message

  if (mode === "signup") {
    if (password !== confirmPassword) {
      showError("Passwords do not match.");
      return;
    }
    if (!termsCheck) {
      showError("Please accept the Terms & Privacy Policy.");
      return;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = mode === "login" ? "Signing in..." : "Creating Account...";
  }

  try {
    if (mode === "login") {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await ensureUserDoc(userCredential.user);
    } else {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(userCredential.user, { displayName: name });
      }
      await ensureUserDoc(userCredential.user);
    }

    // Redirect to main dashboard
    window.location.href = "index.html";

  } catch (err) {
    console.error("Firebase Auth Error:", err);
    showError(formatFirebaseError(err.code || err.message));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = mode === "login" ? "Sign in" : "Create Account";
    }
  }
});

// Helper Function: Display Errors
function showError(message) {
  const authError = document.getElementById("authError");
  if (!authError) return;
  
  if (message) {
    authError.innerText = message;
    authError.classList.remove("hidden");
  } else {
    authError.innerText = "";
    authError.classList.add("hidden");
  }
}

// Helper Function: Human-Readable Firebase Auth Messages
function formatFirebaseError(code) {
  switch (code) {
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    default:
      return code || "Authentication failed. Please try again.";
  }
}

