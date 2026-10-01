import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNJ_Vpm9eBYS8vFVreb3TL1Jw5hjo44P8",
  authDomain: "growth-circle-c8157.firebaseapp.com",
  projectId: "growth-circle-c8157",
  storageBucket: "growth-circle-c8157.firebasestorage.app",
  messagingSenderId: "324642765859",
  appId: "1:324642765859:web:b1a5ef399bac21e60c4596",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
