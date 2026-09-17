import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  runTransaction 
} from "./firebase-config.js";

/**
 * Initializes the user document in Firestore upon sign-in if it doesn't exist yet.
 */
export async function ensureUserDoc(user) {
  if (!user || !user.uid) return;
  
  const ref = doc(db, "users", user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        displayName: user.displayName || "",
        email: user.email || "",
        balance: 0,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error creating user document:", error);
  }
}

/**
 * Listens for real-time wallet balance changes.
 */
export function listenBalance(uid, callback) {
  if (!uid) return () => {};
  
  const ref = doc(db, "users", uid);
  return onSnapshot(
    ref, 
    (snap) => {
      const data = snap.data();
      callback(snap.exists() && data && typeof data.balance === "number" ? data.balance : 0);
    },
    (error) => {
      console.error("Error fetching balance snapshot:", error);
      callback(0);
    }
  );
}

/**
 * Listens for the count of active orders/rentals for the user.
 */
export function listenOrderCount(uid, callback) {
  if (!uid) return () => {};

  const ref = collection(db, "users", uid, "orders");
  return onSnapshot(
    ref, 
    (snap) => callback(snap.size),
    (error) => {
      console.error("Error fetching active orders count:", error);
      callback(0);
    }
  );
}

/**
 * Records a virtual number purchase order.
 */
export async function purchaseVirtualNumber(uid, { serviceName, country, phone, price }) {
  if (!uid) throw new Error("User must be authenticated.");

  const userRef = doc(db, "users", uid);
  const ordersRef = collection(db, "users", uid, "orders");
  const txRef = collection(db, "users", uid, "transactions");

  return runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) {
      throw new Error("User profile does not exist.");
    }

    const currentBalance = userDoc.data().balance || 0;
    if (currentBalance < price) {
      throw new Error("Insufficient balance.");
    }

    // Deduct balance
    transaction.update(userRef, { balance: currentBalance - price });

    // Record order
    const newOrderRef = doc(ordersRef);
    transaction.set(newOrderRef, {
      serviceName,
      country,
      phone,
      price,
      status: "active",
      createdAt: serverTimestamp(),
    });

    // Log transaction history
    const newTxRef = doc(txRef);
    transaction.set(newTxRef, {
      type: "purchase",
      serviceName,
      amount: -price,
      status: "completed",
      createdAt: serverTimestamp(),
    });

    return newOrderRef.id;
  });
}

/**
 * Listens for user's favorite services.
 */
export function listenFavorites(uid, callback) {
  if (!uid) return () => {};

  const ref = collection(db, "users", uid, "favorites");
  return onSnapshot(
    ref, 
    (snap) => callback(snap.docs.map((d) => d.id)),
    (error) => {
      console.error("Error fetching favorites:", error);
      callback([]);
    }
  );
}

/**
 * Toggles or sets a service as favorite.
 */
export async function setFavorite(uid, slug, isFavorite, serviceData = {}) {
  if (!uid || !slug) return;

  const ref = doc(db, "users", uid, "favorites", slug);
  try {
    if (isFavorite) {
      await setDoc(ref, { addedAt: serverTimestamp(), ...serviceData });
    } else {
      await deleteDoc(ref);
    }
  } catch (error) {
    console.error("Error updating favorites:", error);
  }
}

/**
 * Creates a pending deposit/top-up transaction request.
 */
export async function createTopUpRequest(uid, { amount, phone, method }) {
  if (!uid) throw new Error("User must be authenticated.");

  const ref = collection(db, "users", uid, "transactions");
  return addDoc(ref, {
    type: "topup",
    amount: Number(amount),
    phone,
    method,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

/**
 * Listens for transaction history updates in real-time.
 */
export function listenTransactions(uid, callback) {
  if (!uid) return () => {};

  const ref = query(
    collection(db, "users", uid, "transactions"),
    orderBy("createdAt", "desc")
  );
  
  return onSnapshot(
    ref, 
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      console.error("Error fetching transactions:", error);
      callback([]);
    }
  );
}

