import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDN_JVpm9eBYS8vFVreb3TL1Jw5hjo44P8",
  authDomain: "growth-circle-c8157.firebaseapp.com",
  databaseURL:
    "https://growth-circle-c8157-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "growth-circle-c8157",
  storageBucket: "growth-circle-c8157.firebasestorage.app",
  messagingSenderId: "324642765859",
  appId: "1:324642765859:web:e61c2c88571b5fec0c4596",
  measurementId: "G-38TCTKVQS3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
