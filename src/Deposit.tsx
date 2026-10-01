import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";

const MINIMUM_DEPOSIT = 500;

export default function Deposit() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [senderName, setSenderName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
        return;
      }

      setUserId(user.uid);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!senderName.trim()) {
      setError("Please enter the name on the account you used to make the deposit.");
      return;
    }

    if (!userId) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setSubmitting(true);

      await addDoc(collection(db, "deposits"), {
        userId,
        senderName: senderName.trim(),
        amount: MINIMUM_DEPOSIT,
        currency: "NGN",
        status: "pending",
        type: "investment",
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
      setSenderName("");
    } catch (err: unknown) {
      console.error("Deposit request error:", err);

      const firebaseError = err as { code?: string };

      if (
        firebaseError.code === "permission-denied" ||
        firebaseError.code === "firestore/permission-denied"
      ) {
        setError(
          "Your deposit request could not be submitted because Firestore permissions are blocking it."
        );
      } else {
        setError(
          "We could not submit your deposit request. Please try again."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loader"></div>
          <p>Loading deposit page...</p>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="dashboard-page">
        <header className="dashboard-navbar">
          <Link to="/dashboard" className="dashboard-brand">
            <span className="brand-x">X</span>
            <span className="brand-s">S</span>
            <span className="brand-name">Company Limited</span>
          </Link>
        </header>

        <div className="dashboard-container">
          <section className="deposit-success-card">
            <div className="deposit-success-icon">✓</div>

            <p className="dashboard-eyebrow">DEPOSIT REQUEST</p>

            <h1>Request submitted</h1>

            <p>
              Your ₦{MINIMUM_DEPOSIT.toLocaleString()} deposit request has
              been submitted successfully and is now pending admin approval.
            </p>

            <p>
              You will be able to start your investment cycle after the
              deposit has been approved.
            </p>

            <div className="deposit-success-actions">
              <Link to="/dashboard" className="dashboard-small-button">
                Back to dashboard
              </Link>

              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => setSuccess(false)}
              >
                Submit another request
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-navbar">
        <Link to="/dashboard" className="dashboard-brand">
          <span className="brand-x">X</span>
          <span className="brand-s">S</span>
          <span className="brand-name">Company Limited</span>
        </Link>

        <Link to="/dashboard" className="dashboard-back-link">
          ← Dashboard
        </Link>
      </header>

      <div className="dashboard-container">
        <section className="deposit-page-header">
          <p className="dashboard-eyebrow">XS COMPANY LIMITED</p>

          <h1>Deposit to invest in XS</h1>

          <p>
            Follow the instructions below to submit your investment
            deposit request.
          </p>
        </section>

        <section className="deposit-layout">
          <div className="deposit-main-card">
            <div className="deposit-amount-box">
              <span>Minimum deposit</span>
              <strong>₦{MINIMUM_DEPOSIT.toLocaleString()}</strong>
            </div>

            <div className="deposit-instructions">
              <h2>How to make your deposit</h2>

              <ol>
                <li>
                  Transfer <strong>₦500</strong> to the XS Company Limited
                  deposit account provided by the administrator.
                </li>

                <li>
                  Make sure the transfer is made from an account belonging
                  to you.
                </li>

                <li>
                  Enter the name of the account you used to make the
                  transfer below.
                </li>

                <li>
                  Submit your request and wait for admin approval.
                </li>
              </ol>
            </div>

            <div className="deposit-account-box">
              <div>
                <span>Deposit account</span>
                <strong>Admin will provide account details</strong>
              </div>

              <p>
                Your official deposit account details will be displayed
                here once configured.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="deposit-form">
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
                Enter the name exactly as it appears on the account you
                used to make the transfer.
              </p>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="primary-button register-button"
                disabled={submitting}
              >
                {submitting
                  ? "Submitting request..."
                  : "Submit deposit request"}
              </button>
            </form>
          </div>

          <aside className="deposit-side-card">
            <div className="deposit-side-icon">₦</div>

            <h2>Pending approval</h2>

            <p>
              After you submit your request, the XS administrator will
              review the deposit before your investment is activated.
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
    
