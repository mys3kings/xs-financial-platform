import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";

const MINIMUM_DEPOSIT = 500;

export default function Deposit() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [senderName, setSenderName] = useState("");
  const [amount, setAmount] = useState(String(MINIMUM_DEPOSIT));

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setUserId(user.uid);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  function formatMoney(value: number) {
    return `₦${value.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    const numericAmount = Number(amount);

    // -----------------------------
    // VALIDATE USER
    // -----------------------------

    if (!userId) {
      setError(
        "Your session has expired. Please sign in again."
      );
      return;
    }

    // -----------------------------
    // VALIDATE SENDER NAME
    // -----------------------------

    const cleanedSenderName = senderName.trim();

    if (!cleanedSenderName) {
      setError(
        "Please enter the name on the account you used to make the deposit."
      );
      return;
    }

    if (cleanedSenderName.length < 2) {
      setError(
        "Please enter the full name on the sending account."
      );
      return;
    }

    // -----------------------------
    // VALIDATE AMOUNT
    // -----------------------------

    if (!Number.isFinite(numericAmount)) {
      setError("Please enter a valid deposit amount.");
      return;
    }

    if (numericAmount < MINIMUM_DEPOSIT) {
      setError(
        `The minimum deposit is ${formatMoney(
          MINIMUM_DEPOSIT
        )}.`
      );
      return;
    }

    if (!Number.isInteger(numericAmount)) {
      setError(
        "Please enter the deposit amount as a whole number."
      );
      return;
    }

    try {
      setSubmitting(true);

      // -----------------------------
      // CREATE PENDING DEPOSIT
      // -----------------------------

      await addDoc(collection(db, "deposits"), {
        userId: userId,

        senderName: cleanedSenderName,

        amount: numericAmount,

        currency: "NGN",

        status: "pending",

        type: "investment",

        createdAt: serverTimestamp(),

        // These fields help the admin system
        // understand what this request is for.
        investmentRequested: true,

        minimumDeposit: MINIMUM_DEPOSIT,
      });

      setSuccess(true);

      setSenderName("");
      setAmount(String(MINIMUM_DEPOSIT));
    } catch (err: unknown) {
      console.error(
        "Deposit request error:",
        err
      );

      const firebaseError = err as {
        code?: string;
      };

      if (
        firebaseError.code ===
          "permission-denied" ||
        firebaseError.code ===
          "firestore/permission-denied"
      ) {
        setError(
          "Your deposit request could not be submitted because Firestore permissions are blocking it."
        );
      } else {
        setError(
          "We could not submit your deposit request. Please check your connection and try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------------
  // LOADING
  // -----------------------------

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loader"></div>

          <p>
            Loading deposit page...
          </p>
        </div>
      </main>
    );
  }

  // -----------------------------
  // SUCCESS
  // -----------------------------

  if (success) {
    return (
      <main className="dashboard-page">

        <header className="dashboard-navbar">

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


        <div className="dashboard-container">

          <section className="deposit-success-card">

            <div className="deposit-success-icon">
              ✓
            </div>

            <p className="dashboard-eyebrow">
              DEPOSIT REQUEST
            </p>

            <h1>
              Request submitted
            </h1>

            <p>
              Your deposit request has been
              submitted successfully and is now
              pending admin approval.
            </p>

            <p>
              Your investment will only become
              active after the administrator
              verifies and approves the deposit.
            </p>

            <div className="deposit-success-actions">

              <Link
                to="/dashboard"
                className="dashboard-small-button"
              >
                Back to dashboard
              </Link>

              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => {
                  setSuccess(false);
                  setError("");
                }}
              >
                Submit another request
              </button>

            </div>

          </section>

        </div>

      </main>
    );
  }

  // -----------------------------
  // MAIN DEPOSIT PAGE
  // -----------------------------

  return (
    <main className="dashboard-page">

      {/* NAVIGATION */}

      <header className="dashboard-navbar">

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
          className="dashboard-back-link"
        >
          ← Dashboard
        </Link>

      </header>


      <div className="dashboard-container">

        {/* PAGE HEADER */}

        <section className="deposit-page-header">

          <p className="dashboard-eyebrow">
            XS COMPANY LIMITED
          </p>

          <h1>
            Deposit to invest in XS
          </h1>

          <p>
            Follow the instructions below to
            submit your investment deposit
            request.
          </p>

        </section>


        <section className="deposit-layout">

          {/* MAIN CARD */}

          <div className="deposit-main-card">

            {/* MINIMUM DEPOSIT */}

            <div className="deposit-amount-box">

              <span>
                Minimum deposit
              </span>

              <strong>
                ₦500
              </strong>

            </div>


            {/* INSTRUCTIONS */}

            <div className="deposit-instructions">

              <h2>
                How to make your deposit
              </h2>

              <ol>

                <li>
                  Transfer at least{" "}
                  <strong>
                    ₦500
                  </strong>{" "}
                  to the official XS Company
                  Limited deposit account.
                </li>

                <li>
                  Make sure the transfer is made
                  from an account belonging to you.
                </li>

                <li>
                  Enter the name of the account
                  you used to make the transfer
                  below.
                </li>

                <li>
                  Enter the exact amount you
                  transferred.
                </li>

                <li>
                  Submit your request and wait
                  for admin approval.
                </li>

              </ol>

            </div>


            {/* DEPOSIT ACCOUNT */}

            <div className="deposit-account-box">

              <div>

                <span>
                  Deposit account
                </span>

                <strong>
                  Admin will provide account
                  details
                </strong>

              </div>

              <p>
                Your official XS deposit account
                details will be displayed here
                once configured.
              </p>

            </div>


            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="deposit-form"
            >

              {/* AMOUNT */}

              <label>

                Deposit amount

                <input
                  type="number"
                  value={amount}
                  onChange={(event) =>
                    setAmount(event.target.value)
                  }
                  min={MINIMUM_DEPOSIT}
                  step="1"
                  inputMode="numeric"
                  placeholder="500"
                  required
                />

              </label>


              <p className="deposit-note">

                Minimum deposit:{" "}
                <strong>
                  ₦500
                </strong>

              </p>


              {/* SENDER NAME */}

              <label>

                Name on the sending account

                <input
                  type="text"
                  value={senderName}
                  onChange={(event) =>
                    setSenderName(event.target.value)
                  }
                  placeholder="e.g. Daniel Isaac"
                  autoComplete="name"
                  required
                />

              </label>


              <p className="deposit-note">

                Enter the name exactly as it
                appears on the account you used
                to make the transfer.

              </p>


              {/* ERROR */}

              {error && (

                <div
                  className="form-error"
                  role="alert"
                >
                  {error}
                </div>

              )}


              {/* SUBMIT */}

              <button
                type="submit"
                className="primary-button register-button"
                disabled={submitting}
                aria-busy={submitting}
              >

                {submitting
                  ? "Submitting request..."
                  : "Submit deposit request"}

              </button>

            </form>

          </div>


          {/* SIDE CARD */}

          <aside className="deposit-side-card">

            <div className="deposit-side-icon">
              ₦
            </div>

            <h2>
              Pending approval
            </h2>

            <p>
              After you submit your request, the
              XS administrator will review the
              deposit before your investment is
              activated.
            </p>

            <div className="deposit-status">

              <span></span>

              Pending admin approval

            </div>

          </aside>

        </section>

      </div>

    </main>
  );
      }
