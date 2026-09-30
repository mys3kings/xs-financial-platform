import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

type CreateUserProfileData = {
  userId: string;
  fullName: string;
  phone: string;
  email: string;
  referralCode?: string;
};

export async function createUserProfile({
  userId,
  fullName,
  phone,
  email,
  referralCode = "",
}: CreateUserProfileData) {
  await setDoc(doc(db, "users", userId), {
    userId,
    fullName,
    phone,
    email,
    referralCode,
    balance: 0,
    totalInvested: 0,
    totalWithdrawn: 0,
    qualifiedReferrals: 0,
    currentInvestmentCycle: null,
    accountStatus: "ACTIVE",
    createdAt: serverTimestamp(),
  });
}
