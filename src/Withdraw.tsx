import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";

const MINIMUM_WITHDRAWAL = 500;

type UserProfile = {
  fullName?: string;
  email?: string;
  phone?: string;
  balance?: number;
  availableBalance?: number;
};

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function generateWithdrawalReference() {
  const randomPart = Math.floor(100000 + Math.random() * 900000);

  return `WDR-${Date.now().toString().slice(-6)}-${randomPart}`;
}

function getWithdrawalErrorMessage(error: any) {
  const code = error?.code || "";

  if (code === "permission-denied") {
    return "Your withdrawal request could not be submitted because your account does not currently have permission to create this request.";
  }

  if (code === "unavailable") {
    return "The service is temporarily unavailable. Please check your internet connection and try again.";
  }

  if (code === "failed-precondition") {
    return "The withdrawal request could not be completed right now. Please try again.";
  }

  return "Your withdrawal request could not be submitted. Please try again.";
}

export default function Withdraw() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");

  const [availableBalance, setAvailableBalance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [reference, setReference] = useState("");
  const [submittedAmount, setSubmittedAmount] = useState(0);

  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setUserId(user.uid);

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
          const userData = userSnapshot.data() as UserProfile;

          setProfile({
            ...userData,
            email: userData.email || user.email || "",
          });

          const balance =
            typeof userData.availableBalance === "number"
              ? userData.availableBalance
              : typeof userData.balance === "number"
                ? userData.balance
                : 0;

          setAvailableBalance(balance);
        } else {
          setProfile({
            fullName: user.displayName || "XS User",
            email: user.email || "",
          });

          setAvailableBalance(0);
        }
      } catch (err) {
        console.error("WITHDRAW PROFILE ERROR:", err);

        setProfile({
          fullName: user.displayName || "XS User",
          email: user.email || "",
        });

        setAvailableBalance(0);

        setError(
          "We could not load your current account balance. Please refresh the page and try again.",
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const numericAmount = Number(amount);

  const amountIsValid =
    Number.isFinite(numericAmount) &&
    numericAmount >= MINIMUM_WITHDRAWAL;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    if (!userId) {
      setError("Your session has expired. Please log in again.");
      navigate("/login", { replace: true });
      return;
    }

    if (!amount || !Number.isFinite(numericAmount)) {
      setError("Please enter a valid withdrawal amount.");
      return;
    }

    if (numericAmount < MINIMUM_WITHDRAWAL) {
      setError(
        `The minimum withdrawal amount is ${formatNaira(
          MINIMUM_WITHDRAWAL,
        )}.`,
      );
      return;
    }

    if (numericAmount > availableBalance) {
      setError(
        "Your requested withdrawal is greater than your currently available balance.",
      );
      return;
    }

    const cleanBankName = bankName.trim();
    const cleanAccountNumber = accountNumber.trim();
    const cleanAccountHolderName = accountHolderName.trim();

    if (!cleanBankName) {
      setError("Please enter your bank name.");
      return;
    }

    if (!/^\d{10}$/.test(cleanAccountNumber)) {
      setError(
        "Please enter a valid 10-digit Nigerian bank account number.",
      );
      return;
    }

    if (cleanAccountHolderName.length < 2) {
      setError("Please enter the account holder name.");
      return;
    }

    try {
      setSubmitting(true);

      /*
       * This checks whether the user already has a pending
       * withdrawal. Backend/security rules must also enforce
       * the actual financial restrictions.
       */
      const pendingQuery = query(
        collection(db, "withdrawals"),
        where("userId", "==", userId),
        where("status", "==", "PENDING"),
        limit(1),
      );

      const pendingSnapshot = await getDocs(pendingQuery);

      if (!pendingSnapshot.empty) {
        setError(
          "You already have a pending withdrawal request. Please wait for it to be processed before submitting another request.",
        );
        return;
      }

      const withdrawalReference = generateWithdrawalReference();

      await addDoc(collection(db, "withdrawals"), {
        userId,

        userFullName:
          profile?.fullName ||
          auth.currentUser?.displayName ||
          "XS User",

        userEmail:
          profile?.email ||
          auth.currentUser?.email ||
          "",

        amount: numericAmount,
        currency: "NGN",

        bankName: cleanBankName,
        accountNumber: cleanAccountNumber,
        accountHolderName: cleanAccountHolderName,

        reference: withdrawalReference,

        status: "PENDING",

        createdAt: serverTimestamp(),

        reviewedAt: null,
        reviewedBy: null,

        paidAt: null,
        paidBy: null,
        paymentReference: null,

        rejectionReason: null,
      });

      setReference(withdrawalReference);
      setSubmittedAmount(numericAmount);
      setSuccess(true);

      setAmount("");
      setBankName("");
      setAccountNumber("");
      setAccountHolderName("");
    } catch (err) {
      console.error("WITHDRAWAL SUBMISSION ERROR:", err);

      setError(getWithdrawalErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="withdraw-page">
        <div className="withdraw-loading">
          <div className="dashboard-loader"></div>
          <p>Loading your withdrawal account...</p>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="withdraw-page">
        <header className="withdraw-navbar">
          <Link to="/dashboard" className="dashboard-brand">
            <span className="brand-x">X</span>
            <span className="brand-s">S</span>
            <span className="brand-name">Company Limited</span>
          </Link>
        </header>

        <div className="withdraw-container">
          <section className="withdraw-success-card">
            <div className="withdraw-success-icon">✓</div>

            <p className="dashboard-eyebrow">
              WITHDRAWAL REQUEST RECEIVED
            </p>

            <h1>Request submitted successfully</h1>

            <p>
              Your withdrawal request has been received and is
              currently awaiting administrator review.
            </p>

            <div className="withdraw-success-details">
              <div>
                <span>Reference</span>
                <strong>{reference}</strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>{formatNaira(submittedAmount)}</strong>
              </div>

              <div>
                <span>Status</span>
                <strong className="withdraw-status-pending">
                  PENDING
                </strong>
              </div>
            </div>

            <p className="withdraw-note">
              XS will only show a withdrawal as paid after the
              administrator has processed the payment and marked the
              request as paid.
            </p>

            <div className="withdraw-success-actions">
              <Link to="/dashboard" className="primary-button">
                Back to Dashboard
              </Link>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSuccess(false);
                  setReference("");
                  setSubmittedAmount(0);
                  setError("");
                }}
              >
                Make another request
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="withdraw-page">
      <header className="withdraw-navbar">
        <Link to="/dashboard" className="dashboard-brand">
          <span className="brand-x">X</span>
          <span className="brand-s">S</span>
          <span className="brand-name">
