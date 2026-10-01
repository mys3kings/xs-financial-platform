import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

const ADMIN_PASSWORD = "2007";

const MINIMUM_DEPOSIT = 500;
const DAILY_RETURN = 200;
const CYCLE_DAYS = 3;

type Deposit = {
  id: string;
  userId?: string;
  senderName?: string;
  amount?: number;
  currency?: string;
  status?: string;
  type?: string;
  createdAt?: any;
};

export default function Admin() {
  const navigate = useNavigate();

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ----------------------------------
  // ADMIN LOGIN
  // ----------------------------------

  function handleAdminLogin(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setPasswordError("");

    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setPassword("");
      return;
    }

    setPasswordError("Incorrect admin password.");
  }

  // ----------------------------------
  // LOAD DEPOSITS
  // ----------------------------------

  async function loadDeposits() {
    try {
      setLoading(true);
      setError("");

      const depositsQuery = query(
        collection(db, "deposits"),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(depositsQuery);

      const depositList: Deposit[] =
        snapshot.docs.map((depositDoc) => ({
          id: depositDoc.id,
          ...(depositDoc.data() as Omit<Deposit, "id">),
        }));

      setDeposits(depositList);
    } catch (err) {
      console.error(
        "Admin deposit loading error:",
        err
      );

      setError(
        "Unable to load deposits. Check your Firestore permissions and configuration."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authenticated) return;

    loadDeposits();
  }, [authenticated]);

  // ----------------------------------
  // APPROVE DEPOSIT
  // ----------------------------------

  async function approveDeposit(deposit: Deposit) {
    if (!deposit.userId) {
      setError(
        "This deposit does not have a valid user ID."
      );
      return;
    }

    if (
      !deposit.amount ||
      deposit.amount < MINIMUM_DEPOSIT
    ) {
      setError(
        "This deposit does not meet the minimum deposit requirement."
      );
      return;
    }

    const confirmed = window.confirm(
      `Approve this ${formatMoney(
        deposit.amount
      )} deposit from ${
        deposit.senderName || "Unknown"
      }?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(deposit.id);
      setError("");
      setMessage("");

      // ----------------------------------
      // CREATE / ACTIVATE INVESTMENT
      // ----------------------------------

      const investmentRef = doc(
        db,
        "investments",
        deposit.userId
      );

      await setDoc(
        investmentRef,
        {
          status: "ACTIVE",

          investmentAmount: deposit.amount,

          principalAmount: deposit.amount,

          dailyReturn: DAILY_RETURN,

          totalReturns:
            DAILY_RETURN * CYCLE_DAYS,

          cycleDays: CYCLE_DAYS,

          startedAt: serverTimestamp(),

          nextReturnAt: serverTimestamp(),

          depositId: deposit.id,

          userId: deposit.userId,

          currency: "NGN",

          updatedAt: serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      // ----------------------------------
      // MARK DEPOSIT APPROVED
      // ----------------------------------

      const depositRef = doc(
        db,
        "deposits",
        deposit.id
      );

      await updateDoc(depositRef, {
        status: "approved",

        approvedAt: serverTimestamp(),

        approvedBy: "admin",
      });

      setMessage(
        "Deposit approved and investment activated successfully."
      );

      await loadDeposits();
    } catch (err) {
      console.error(
        "Deposit approval error:",
        err
      );

      setError(
        "The deposit could not be approved. Check your Firestore permissions and try again."
      );
    } finally {
      setProcessingId("");
    }
  }

  // ----------------------------------
  // REJECT DEPOSIT
  // ----------------------------------

  async function rejectDeposit(deposit: Deposit) {
    const confirmed = window.confirm(
      `Reject this deposit request from ${
        deposit.senderName || "Unknown"
      }?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(deposit.id);
      setError("");
      setMessage("");

      const depositRef = doc(
        db,
        "deposits",
        deposit.id
      );

      await updateDoc(depositRef, {
        status: "rejected",

        rejectedAt: serverTimestamp(),

        rejectedBy: "admin",
      });

      setMessage(
        "Deposit request rejected."
      );

      await loadDeposits();
    } catch (err) {
      console.error(
        "Deposit rejection error:",
        err
      );

      setError(
        "The deposit could not be rejected."
      );
    } finally {
      setProcessingId("");
    }
  }

  // ----------------------------------
  // ADMIN LOGOUT
  // ----------------------------------

  async function handleLogout() {
    try {
      await signOut(auth);

      navigate("/login", {
        replace: true,
      });
    } catch (err) {
      console.error(
        "Admin logout error:",
        err
      );
    }
  }

  // ----------------------------------
  // FORMAT MONEY
  // ----------------------------------

  function formatMoney(amount: number) {
    return `₦${amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // ----------------------------------
  // FORMAT DATE
  // ----------------------------------

  function formatDate(value: any) {
    if (!value) return "—";

    try {
      const date =
        typeof value.toDate === "function"
          ? value.toDate()
          : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "—";
      }

      return new Intl.DateTimeFormat(
        "en-NG",
        {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Africa/Lagos",
        }
      ).format(date);
    } catch {
      return "—";
    }
  }

  // ----------------------------------
  // ADMIN PASSWORD SCREEN
  // ----------------------------------

  if (!authenticated) {
    return (
      <main className="admin-page">

        <div className="admin-login-card">

          <div className="admin-logo">
            X
          </div>

          <p className="dashboard-eyebrow">
            XS COMPANY LIMITED
          </p>

          <h1>
            Admin Panel
          </h1>

          <p>
            Enter the administrator password to
            continue.
          </p>

          <form
            onSubmit={handleAdminLogin}
            className="admin-login-form"
          >

            <label>
              Admin password

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter password"
                autoComplete="off"
                autoFocus
              />
            </label>

            {passwordError && (
              <div
                className="form-error"
                role="alert"
              >
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
            >
              Enter Admin Panel
            </button>

          </form>

          <Link
            to="/dashboard"
            className="dashboard-back-link"
          >
            ← Back to dashboard
          </Link>

        </div>

      </main>
    );
  }

  // ----------------------------------
  // FILTER DEPOSITS
  // ----------------------------------

  const pendingDeposits =
    deposits.filter(
      (deposit) =>
        deposit.status?.toLowerCase() ===
        "pending"
    );

  const approvedDeposits =
    deposits.filter(
      (deposit) =>
        deposit.status?.toLowerCase() ===
        "approved"
    );

  const rejectedDeposits =
    deposits.filter(
      (deposit) =>
        deposit.status?.toLowerCase() ===
        "rejected"
    );

  // ----------------------------------
  // ADMIN DASHBOARD
  // ----------------------------------

  return (
    <main className="admin-page">

      {/* ADMIN NAVBAR */}

      <header className="admin-navbar">

        <div className="admin-brand">

          <div className="admin-logo">
            X
          </div>

          <div>
            <strong>
              XS Company Limited
            </strong>

            <span>
              Administrator
            </span>
          </div>

        </div>

        <div className="admin-nav-actions">

          <Link
            to="/dashboard"
            className="dashboard-back-link"
          >
            User Dashboard
          </Link>

          <button
            type="button"
            className="dashboard-logout"
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </header>


      <div className="admin-container">

        {/* ADMIN WELCOME */}

        <section className="admin-welcome">

          <p className="dashboard-eyebrow">
            ADMINISTRATION
          </p>

          <h1>
            Admin Dashboard
          </h1>

          <p>
            Manage deposit requests and
            investment activation.
          </p>

        </section>


        {/* ADMIN SUMMARY */}

        <section className="admin-summary">

          <div className="admin-stat-card">

            <span>
              Pending deposits
            </span>

            <strong>
              {pendingDeposits.length}
            </strong>

          </div>


          <div className="admin-stat-card">

            <span>
              Approved deposits
            </span>

            <strong>
              {approvedDeposits.length}
            </strong>

          </div>


          <div className="admin-stat-card">

            <span>
              Rejected deposits
            </span>

            <strong>
              {rejectedDeposits.length}
            </strong>

          </div>

        </section>


        {/* SUCCESS MESSAGE */}

        {message && (
          <div
            className="admin-success-message"
            role="status"
          >
            {message}
          </div>
        )}


        {/* ERROR MESSAGE */}

        {error && (
          <div
            className="form-error"
            role="alert"
          >
            {error}
          </div>
        )}


        {/* PENDING DEPOSITS */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="dashboard-eyebrow">
                DEPOSITS
              </p>

              <h2>
                Pending deposit requests
              </h2>

            </div>

            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={loadDeposits}
              disabled={loading}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>

          </div>


          {loading ? (

            <div className="admin-empty-card">
              Loading deposit requests...
            </div>

          ) : pendingDeposits.length === 0 ? (

            <div className="admin-empty-card">

              <strong>
                No pending deposits
              </strong>

              <p>
                New deposit requests will appear
                here when users submit them.
              </p>

            </div>

          ) : (

            <div className="admin-deposit-list">

              {pendingDeposits.map(
                (deposit) => (

                  <article
                    key={deposit.id}
                    className="admin-deposit-card"
                  >

                    <div className="admin-deposit-header">

                      <div>

                        <span>
                          Sender name
                        </span>

                        <strong>
                          {deposit.senderName ||
                            "Not provided"}
                        </strong>

                      </div>


                      <div>

                        <span>
                          Amount
                        </span>

                        <strong>
                          {formatMoney(
                            deposit.amount || 0
                          )}
                        </strong>

                      </div>

                    </div>


                    <div className="admin-deposit-details">

                      <div>

                        <span>
                          User ID
                        </span>

                        <p>
                          {deposit.userId ||
                            "—"}
                        </p>

                      </div>


                      <div>

                        <span>
                          Submitted
                        </span>

                        <p>
                          {formatDate(
                            deposit.createdAt
                          )}
                        </p>

                      </div>


                      <div>

                        <span>
                          Status
                        </span>

                        <p>
                          <strong>
                            Pending
                          </strong>
                        </p>

                      </div>

                    </div>


                    <div className="admin-deposit-actions">

                      <button
                        type="button"
                        className="admin-approve-button"
                        onClick={() =>
                          approveDeposit(
                            deposit
                          )
                        }
                        disabled={
                          processingId ===
                          deposit.id
                        }
                      >
                        {processingId ===
                        deposit.id
                          ? "Processing..."
                          : "Approve deposit"}
                      </button>


                      <button
                        type="button"
                        className="admin-reject-button"
                        onClick={() =>
                          rejectDeposit(
                            deposit
                          )
                        }
                        disabled={
                          processingId ===
                          deposit.id
                        }
                      >
                        Reject
                      </button>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>


        {/* APPROVED DEPOSITS */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="dashboard-eyebrow">
                APPROVED
              </p>

              <h2>
                Approved deposits
              </h2>

            </div>

          </div>


          {approvedDeposits.length === 0 ? (

            <div className="admin-empty-card">

              <strong>
                No approved deposits yet
              </strong>

            </div>

          ) : (

            <div className="admin-history-list">

              {approvedDeposits.map(
                (deposit) => (

                  <div
                    key={deposit.id}
                    className="admin-history-item"
                  >

                    <div>

                      <strong>
                        {deposit.senderName ||
                          "Unknown sender"}
                      </strong>

                      <span>
                        {formatDate(
                          deposit.createdAt
                        )}
                      </span>

                    </div>

                    <strong>
                      {formatMoney(
                        deposit.amount || 0
                      )}
                    </strong>

                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* REJECTED DEPOSITS */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="dashboard-eyebrow">
                REJECTED
              </p>

              <h2>
                Rejected deposits
              </h2>

            </div>

          </div>


          {rejectedDeposits.length === 0 ? (

            <div className="admin-empty-card">

              <strong>
                No rejected deposits
              </strong>

            </div>

          ) : (

            <div className="admin-history-list">

              {rejectedDeposits.map(
                (deposit) => (

                  <div
                    key={deposit.id}
                    className="admin-history-item"
                  >

                    <div>

                      <strong>
                        {deposit.senderName ||
                          "Unknown sender"}
                      </strong>

                      <span>
                        {formatDate(
                          deposit.createdAt
                        )}
                      </span>

                    </div>

                    <strong>
                      {formatMoney(
                        deposit.amount || 0
                      )}
                    </strong>

                  </div>

                )
              )}

            </div>

          )}

        </section>


        {/* FOOTER */}

        <footer className="dashboard-footer">

          <strong>
            XS Company Limited
          </strong>

          <span>
            Administrator panel
          </span>

        </footer>

      </div>

    </main>
  );
}
