import { auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Only for showing the link. The real protection is in the backend (admin.py).
const ADMIN_EMAILS = ["fongohboris90@gmail.com"];

onAuthStateChanged(auth, (user) => {
  const list = document.querySelector("#sidebar ul, .sidebar ul");
  if (!list) return;

  // remove an old copy first, so it never shows twice
  list.querySelector("[data-admin-link]")?.remove();

  const email = (user?.email || "").toLowerCase();
  if (!user || !user.emailVerified || !ADMIN_EMAILS.includes(email)) return;

  const item = document.createElement("li");
  item.setAttribute("data-admin-link", "1");
  item.innerHTML = `<span class="dot"></span>Admin`;
  item.onclick = () => (window.location.href = "admin.html");
  list.appendChild(item);
});

