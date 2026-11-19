import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB8LRp5rmhgZg2MPx49rSCQt9VtHt2c_ro",
  authDomain: "uploadproofs-17497.firebaseapp.com",
  databaseURL: "https://uploadproofs-17497-default-rtdb.firebaseio.com/",
  projectId: "uploadproofs-17497",
  storageBucket: "uploadproofs-17497.firebasestorage.app",
  messagingSenderId: "959169332007",
  appId: "1:959169332007:web:0c5c602908dc55f4499f02"
};

// Thay bằng UID tài khoản admin trong Firebase Authentication
export const ADMIN_UID = "aENmK8TCjycWaYoW3YT2mvTLrHn1";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
