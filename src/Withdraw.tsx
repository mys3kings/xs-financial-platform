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
  const randomPart = Math.floor(
    100000 + Math.random() * 900000,
  );

  return `WDR-${Date.now()
    .toString()
    .slice(-6)}-${randomPart}`;
}

function getWithdrawalErrorMessage(error: any) {
  const code = error?.code || "";

  switch (code) {
    case "permission-denied":
      return "Your withdrawal request could not be submitted because you do not currently have permission to create a withdrawal request.";

    case "unavailable":
      return "The service is temporarily unavailable. Please check your internet connection and try again.";

    case "failed-precondition":
      return "The withdrawal request could not be completed right now. Please try again.";

    case "network-request-failed":
      return "A network error occurred. Please check your internet connection and try again.";

    default:
      return "Your withdrawal request could not be submitted. Please try again.";
  }
}

export default function Withdraw() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [amount, setAmount] = useState("");

  const [bankName, setBankName] = useState("");

  const [accountNumber, setAccountNumber] =
    useState("");

  const [accountHolderName, setAccountHolderName] =
    useState("");

  const [availableBalance, setAvailableBalance] =
    useState(0);

  const [loading, setLoading] = useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] = useState("");

  const [reference, setReference] =
    useState("");

  const [submittedAmount, setSubmittedAmount] =
    useState(0);

  // --------------------------------------------------
  // WITHDRAWAL PORTAL LOCK
  // --------------------------------------------------

  const [withdrawalPortalLocked, setWithdrawalPortalLocked] =
    useState(false);

  const [portalLoading, setPortalLoading] =
    useState(true);

  // --------------------------------------------------
  // LOAD USER + WITHDRAWAL PORTAL STATUS
  // --------------------------------------------------

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setLoading(false);
          setPortalLoading(false);

          navigate("/login", {
            replace: true,
          });

          return;
        }

        setUserId(user.uid);

        try {
          // ------------------------------------------
          // LOAD USER PROFILE
          // ------------------------------------------

          const userRef = doc(
            db,
            "users",
            user.uid,
          );

          const userSnapshot =
            await getDoc(userRef);

          if (userSnapshot.exists()) {
            const userData =
              userSnapshot.data() as UserProfile;

            setProfile({
              ...userData,
              email:
                userData.email ||
                user.email ||
                "",
            });

            const balance =
              typeof userData.availableBalance ===
              "number"
                ? userData.availableBalance
                : typeof userData.balance ===
                    "number"
                  ? userData.balance
                  : 0;

            setAvailableBalance(balance);
          } else {
            setProfile({
              fullName:
                user.displayName ||
                "XS User",

              email:
                user.email || "",
            });

            setAvailableBalance(0);
          }

          // ------------------------------------------
          // LOAD WITHDRAWAL PORTAL STATUS
          // ------------------------------------------

          const settingsRef = doc(
            db,
            "settings",
            "withdrawalPortal",
          );

          const settingsSnapshot =
            await getDoc(settingsRef);

          if (settingsSnapshot.exists()) {
            const settingsData =
              settingsSnapshot.data();

            setWithdrawalPortalLocked(
              settingsData.locked === true,
            );
          } else {
            // If the setting doesn't exist,
            // withdrawals remain open.
            setWithdrawalPortalLocked(false);
          }
        } catch (err) {
          console.error(
            "WITHDRAW PAGE LOAD ERROR:",
            err,
          );

          setProfile({
            fullName:
              user.displayName ||
              "XS User",

            email:
              user.email || "",
          });

          setAvailableBalance(0);

          setWithdrawalPortalLocked(false);

          setError(
            "We could not load your withdrawal account. Please refresh the page and try again.",
          );
        } finally {
          setLoading(false);
          setPortalLoading(false);
        }
      },
    );

    return () => unsubscribe();
  }, [navigate]);

  const numericAmount = Number(amount);

  const amountIsValid =
    Number.isFinite(numericAmount) &&
    numericAmount >= MINIMUM_WITHDRAWAL;

  // --------------------------------------------------
  // SUBMIT WITHDRAWAL
  // --------------------------------------------------

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    // ------------------------------------------
    // PORTAL LOCK CHECK
    // ------------------------------------------

    if (withdrawalPortalLocked) {
      setError(
        "The withdrawal portal is currently locked or unavailable. Please try again later.",
      );

      return;
    }

    if (!userId) {
      setError(
        "Your session has expired. Please log in again.",
      );

      navigate("/login", {
        replace: true,
      });

      return;
    }

    if (
      !amount ||
      !Number.isFinite(numericAmount)
    ) {
      setError(
        "Please enter a valid withdrawal amount.",
      );

      return;
    }

    if (
      numericAmount <
      MINIMUM_WITHDRAWAL
    ) {
      setError(
        `The minimum withdrawal amount is ${formatNaira(
          MINIMUM_WITHDRAWAL,
        )}.`,
      );

      return;
    }

    if (numericAmount <= 0) {
      setError(
        "Withdrawal amount must be greater than zero.",
      );

      return;
    }

    if (
      numericAmount >
      availableBalance
    ) {
      setError(
        "Your requested withdrawal is greater than your currently available balance.",
      );

      return;
    }

    const cleanBankName =
      bankName.trim();

    const cleanAccountNumber =
      accountNumber.trim();

    const cleanAccountHolderName =
      accountHolderName.trim();

    if (!cleanBankName) {
      setError(
        "Please enter your bank name.",
      );

      return;
    }

    if (
      !/^\d{10}$/.test(
        cleanAccountNumber,
      )
    ) {
      setError(
        "Please enter a valid 10-digit Nigerian bank account number.",
      );

      return;
    }

    if (
      cleanAccountHolderName.length <
      2
    ) {
      setError(
        "Please enter the account holder name.",
      );

      return;
    }

    try {
      setSubmitting(true);

      // ------------------------------------------
      // CHECK PORTAL STATUS AGAIN
      // ------------------------------------------
      // This prevents the user from submitting
      // if the admin locked the portal after
      // the page was first opened.

      const settingsRef = doc(
        db,
        "settings",
        "withdrawalPortal",
      );

      const settingsSnapshot =
        await getDoc(settingsRef);

      const currentlyLocked =
        settingsSnapshot.exists() &&
        settingsSnapshot.data().locked === true;

      if (currentlyLocked) {
        setWithdrawalPortalLocked(true);

        setError(
          "The withdrawal portal has been locked by XS Company Limited. New withdrawal requests cannot be submitted at this time.",
        );

        return;
      }

      // ------------------------------------------
      // CHECK EXISTING PENDING WITHDRAWAL
      // ------------------------------------------

      const pendingQuery = query(
        collection(db, "withdrawals"),

        where(
          "userId",
          "==",
          userId,
        ),

        where(
          "status",
          "==",
          "PENDING",
        ),

        limit(1),
      );

      const pendingSnapshot =
        await getDocs(
          pendingQuery,
        );

      if (
        !pendingSnapshot.empty
      ) {
        setError(
          "You already have a pending withdrawal request. Please wait for it to be processed before submitting another request.",
        );

        return;
      }

      // ------------------------------------------
      // CREATE WITHDRAWAL REQUEST
      // ------------------------------------------

      const withdrawalReference =
        generateWithdrawalReference();

      await addDoc(
        collection(
          db,
          "withdrawals",
        ),
        {
          userId,

          userFullName:
            profile?.fullName ||
            auth.currentUser
              ?.displayName ||
            "XS User",

          userEmail:
            profile?.email ||
            auth.currentUser
              ?.email ||
            "",

          amount:
            numericAmount,

          currency: "NGN",

          bankName:
            cleanBankName,

          accountNumber:
            cleanAccountNumber,

          accountHolderName:
            cleanAccountHolderName,

          reference:
            withdrawalReference,

          status: "PENDING",

          createdAt:
            serverTimestamp(),

          reviewedAt: null,

          reviewedBy: null,

          paidAt: null,

          paidBy: null,

          paymentReference:
            null,

          rejectionReason:
            null,
        },
      );

      setReference(
        withdrawalReference,
      );

      setSubmittedAmount(
        numericAmount,
      );

      setSuccess(true);

      setAmount("");

      setBankName("");

      setAccountNumber("");

      setAccountHolderName("");
    } catch (err) {
      console.error(
        "WITHDRAWAL SUBMISSION ERROR:",
        err,
      );

      setError(
        getWithdrawalErrorMessage(
          err,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------------------------
  // LOADING SCREEN
  // --------------------------------------------------

  if (
    loading ||
    portalLoading
  ) {
    return (
      <main className="withdraw-page">
        <div className="withdraw-loading">
          <div className="dashboard-loader"></div>

          <p>
            Loading your withdrawal account...
          </p>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // WITHDRAWAL PORTAL LOCKED
  // --------------------------------------------------

  if (withdrawalPortalLocked) {
    return (
      <main className="withdraw-page">
        <header className="withdraw-navbar">
          <Link
            to="/dashboard"
            className="dashboard-brand"
          >
            <span className="brand-x">
              X
            </span>

            <span className="brand-s">
              S
            </span>

            <span className="brand-name">
              Company Limited
            </span>
          </Link>

          <Link
            to="/dashboard"
            className="withdraw-back-link"
          >
            ← Dashboard
          </Link>
        </header>

        <div className="withdraw-container">
          <section className="withdraw-locked-card">

            <div className="withdraw-locked-icon">
              🔒
            </div>

            <p className="dashboard-eyebrow">
              WITHDRAWALS
            </p>

            <h1>
              Withdrawal portal unavailable
            </h1>

            <p>
              The withdrawal portal is
              currently locked by XS Company
              Limited.
            </p>

            <p>
              New withdrawal requests cannot
              be submitted at this time.
              Please check again later.
            </p>

            <div className="withdraw-locked-status">
              <strong>
                🔒 Withdrawals temporarily unavailable
              </strong>

              <span>
                The portal will become available
                again when it is unlocked.
              </span>
            </div>

            <Link
              to="/dashboard"
              className="primary-button"
            >
              ← Back to Dashboard
            </Link>

          </section>

          <footer className="dashboard-footer">
            <strong>
              XS Company Limited
            </strong>

            <span>
              ©{" "}
              {new Date().getFullYear()}{" "}
              All rights reserved.
            </span>
          </footer>
        </div>
      </main>
    );
  }

  // --------------------------------------------------
  // SUCCESS SCREEN
  // --------------------------------------------------

  if (success) {
    return (
      <main className="withdraw-page">
        <header className="withdraw-navbar">
          <Link
            to="/dashboard"
            className="dashboard-brand"
          >
            <span className="brand-x">
              X
            </span>

            <span className="brand-s">
              S
            </span>

            <span className="brand-name">
              Company Limited
            </span>
          </Link>
        </header>

        <div className="withdraw-container">
          <section className="withdraw-success-card">
            <div className="withdraw-success-icon">
              ✓
            </div>

            <p className="dashboard-eyebrow">
              WITHDRAWAL REQUEST RECEIVED
            </p>

            <h1>
              Request submitted
              successfully
            </h1>

            <p>
              Your withdrawal request
              has been received and is
              currently awaiting
              administrator review.
            </p>

            <div className="withdraw-success-details">
              <div>
                <span>
                  Reference
                </span>

                <strong>
                  {reference}
                </strong>
              </div>

              <div>
                <span>
                  Amount
                </span>

                <strong>
                  {formatNaira(
                    submittedAmount,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Status
                </span>

                <strong className="withdraw-status-pending">
                  PENDING
                </strong>
              </div>
            </div>

            <p className="withdraw-note">
              XS will only show a
              withdrawal as paid after
              the administrator has
              processed the payment and
              marked the request as paid.
            </p>

            <div className="withdraw-success-actions">
              <Link
                to="/dashboard"
                className="primary-button"
              >
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

  // --------------------------------------------------
  // NORMAL WITHDRAWAL PAGE
  // --------------------------------------------------

  return (
    <main className="withdraw-page">
      <header className="withdraw-navbar">
        <Link
          to="/dashboard"
          className="dashboard-brand"
        >
          <span className="brand-x">
            X
          </span>

          <span className="brand-s">
            S
          </span>

          <span className="brand-name">
            Company Limited
          </span>
        </Link>

        <Link
          to="/dashboard"
          className="withdraw-back-link"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="withdraw-container">
        <section className="withdraw-heading">
          <p className="dashboard-eyebrow">
            WITHDRAW FUNDS
          </p>

          <h1>
            Request a withdrawal
          </h1>

          <p>
            Enter the amount you want
            to withdraw and the bank
            account where you want to
            receive your payment.
          </p>
        </section>

        <section className="withdraw-balance-card">
          <div>
            <span>
              Available Balance
            </span>

            <strong>
              {formatNaira(
                availableBalance,
              )}
            </strong>
          </div>

          <div className="withdraw-minimum">
            <span>
              Minimum Withdrawal
            </span>

            <strong>
              {formatNaira(
                MINIMUM_WITHDRAWAL,
              )}
            </strong>
          </div>
        </section>

        <section className="withdraw-form-card">
          <div className="withdraw-form-heading">
            <h2>
              Bank payment details
            </h2>

            <p>
              Make sure the information
              matches the bank account
              that should receive your
              withdrawal.
            </p>
          </div>

          {error && (
            <div
              className="withdraw-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="withdraw-form"
          >
            <div className="withdraw-form-group">
              <label htmlFor="withdrawAmount">
                Withdrawal Amount
              </label>

              <div className="withdraw-input-prefix">
                <span>₦</span>

                <input
                  id="withdrawAmount"
                  type="number"
                  inputMode="decimal"
                  min={
                    MINIMUM_WITHDRAWAL
                  }
                  step="1"
                  value={amount}
                  onChange={(event) => {
                    setAmount(
                      event.target
                        .value,
                    );

                    setError("");
                              }}
                  placeholder="500"
                  disabled={
                    submitting
                  }
                />
              </div>

              <small>
                Minimum withdrawal:{" "}
                {formatNaira(
                  MINIMUM_WITHDRAWAL,
                )}
              </small>
            </div>

            <div className="withdraw-form-group">
              <label htmlFor="bankName">
                Bank Name
              </label>

              <input
                id="bankName"
                type="text"
                value={bankName}
                onChange={(event) => {
                  setBankName(
                    event.target
                      .value,
                  );

                  setError("");
                }}
                placeholder="e.g. Moniepoint MFB"
                autoComplete="organization"
                disabled={
                  submitting
                }
              />
            </div>

            <div className="withdraw-form-group">
              <label htmlFor="accountNumber">
                Account Number
              </label>

              <input
                id="accountNumber"
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={
                  accountNumber
                }
                onChange={(event) => {
                  const value =
                    event.target
                      .value
                      .replace(
                        /\D/g,
                        "",
                      )
                      .slice(
                        0,
                        10,
                      );

                  setAccountNumber(
                    value,
                  );

                  setError("");
                }}
                placeholder="10-digit account number"
                autoComplete="off"
                disabled={
                  submitting
                }
              />
            </div>

            <div className="withdraw-form-group">
              <label htmlFor="accountHolderName">
                Account Holder Name
              </label>

              <input
                id="accountHolderName"
                type="text"
                value={
                  accountHolderName
                }
                onChange={(event) => {
                  setAccountHolderName(
                    event.target
                      .value,
                  );

                  setError("");
                }}
                placeholder="Enter the exact account holder name"
                autoComplete="name"
                disabled={
                  submitting
                }
              />

              <small>
                Enter the name registered
                on the receiving bank
                account.
              </small>
            </div>

            <div className="withdraw-summary">
              <div>
                <span>
                  Available balance
                </span>

                <strong>
                  {formatNaira(
                    availableBalance,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Requested withdrawal
                </span>

                <strong>
                  {amount &&
                  amountIsValid
                    ? formatNaira(
                        numericAmount,
                      )
                    : "₦0.00"}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              className="primary-button withdraw-submit-button"
              disabled={
                submitting
              }
            >
              {submitting
                ? "Submitting request..."
                : "Request Withdrawal"}
            </button>
          </form>
        </section>

        <section className="withdraw-info-card">
          <div className="withdraw-info-icon">
            i
          </div>

          <div>
            <h3>
              How withdrawals work
            </h3>

            <ol>
              <li>
                Submit your withdrawal
                request.
              </li>

              <li>
                XS reviews your request
                and bank information.
              </li>

              <li>
                The administrator
                approves or rejects the
                request.
              </li>

              <li>
                If approved, payment is
                sent manually to your bank
                account.
              </li>

              <li>
                The withdrawal is marked{" "}
                <strong>PAID</strong> only
                after the payment has
                actually been sent.
              </li>
            </ol>
          </div>
        </section>

        <footer className="dashboard-footer">
          <strong>
            XS Company Limited
          </strong>

          <span>
            ©{" "}
            {new Date().getFullYear()}{" "}
            All rights reserved.
          </span>
        </footer>
      </div>
    </main>
  );
                }
