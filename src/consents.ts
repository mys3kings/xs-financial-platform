import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const CONSENT_VERSIONS = {
  terms: "1.0",
  privacy: "1.0",
  investment: "1.0",
  referral: "1.0",
  platform: "1.0",
};

export async function saveUserConsents(userId: string) {
  await setDoc(doc(db, "userConsents", userId), {
    userId,

    termsVersion: CONSENT_VERSIONS.terms,
    privacyVersion: CONSENT_VERSIONS.privacy,
    investmentTermsVersion: CONSENT_VERSIONS.investment,
    referralTermsVersion: CONSENT_VERSIONS.referral,
    platformStructureVersion: CONSENT_VERSIONS.platform,

    acceptedAt: serverTimestamp(),
  });
}
