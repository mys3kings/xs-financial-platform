import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  doc,
  getDoc,
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
const CYCLE_TOTAL_RETURN = DAILY_RETURN * CYCLE_DAYS;

// --------------------------------------------------
// GET CURRENT NIGERIAN TIME
// --------------------------------------------------

function getNigeriaNow(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const values: Record<string, string> = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });

  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    )
  );
}

// --------------------------------------------------
// GET NEXT 12:00 AM NIGERIAN TIME
// --------------------------------------------------

function getNextNigeriaMidnight(): Date {
  const nigeriaNow = getNigeriaNow();

  nigeriaNow.setUTCDate(
    nigeriaNow.getUTCDate() + 1
  );

  nigeriaNow.setUTCHours(0, 0, 0, 0);

  return nigeriaNow;
}

// --------------------------------------------------
// DEPOSIT TYPE
// --------------------------------------------------

type Deposit = {
  id: string;
  userId?: string;
  senderName?: string;
  amount?: number;
  currency?: string;
  status?: string;
  type?: string;
  createdAt?: any;
  approvedAt?: any;
  rejectedAt?: any;
};

// --------------------------------------------------
// WITHDRAWAL TYPE
// --------------------------------------------------

type Withdrawal = {
  id: string;
  userId?: string;
  userFullName?: string;
  userEmail?: string;
  amount?: number;
  currency?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  reference?: string;
  status?: string;
  createdAt?: any;
  reviewedAt?: any;
  reviewedBy?: string | null;
  paidAt?: any;
  paidBy?: string | null;
  paymentReference?: string | null;
  rejectionReason?: string | null;
};

// --------------------------------------------------
// ADMIN COMPONENT
// --------------------------------------------------

export default function Admin() {
  const navigate = useNavigate();

  const [authenticated, setAuthenticated] =
    useState(false);

  const [password, setPassword] = useState("");

  const [passwordError, setPasswordError] =
    useState("");

  const [deposits, setDeposits] =
    useState<Deposit[]>([]);

  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [processingId, setProcessingId] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // --------------------------------------------------
  // WITHDRAWAL PORTAL LOCK STATE
  // --------------------------------------------------

  const [
    withdrawalPortalLocked,
    setWithdrawalPortalLocked,
  ] = useState(false);

  const [
    withdrawalPortalLoading,
    setWithdrawalPortalLoading,
  ] = useState(false);

  // --------------------------------------------------
  // ADMIN LOGIN
  // --------------------------------------------------

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

    setPasswordError(
      "Incorrect admin password."
    );
  }

  // --------------------------------------------------
  // LOAD DEPOSITS
  // --------------------------------------------------

  async function loadDeposits() {
    const depositsQuery = query(
      collection(db, "deposits"),
      orderBy("createdAt", "desc")
    );

    const snapshot =
      await getDocs(depositsQuery);

    const depositList: Deposit[] =
      snapshot.docs.map((depositDoc) => ({
        id: depositDoc.id,
        ...(depositDoc.data() as Omit<
          Deposit,
          "id"
        >),
      }));

    setDeposits(depositList);
  }

  // --------------------------------------------------
  // LOAD WITHDRAWALS
  // --------------------------------------------------

  async function loadWithdrawals() {
    const withdrawalsQuery = query(
      collection(db, "withdrawals"),
      orderBy("createdAt", "desc")
    );

    const snapshot =
      await getDocs(withdrawalsQuery);

    const withdrawalList: Withdrawal[] =
      snapshot.docs.map((withdrawalDoc) => ({
        id: withdrawalDoc.id,
        ...(withdrawalDoc.data() as Omit<
          Withdrawal,
          "id"
        >),
      }));

    setWithdrawals(withdrawalList);
  }

  // --------------------------------------------------
  // LOAD WITHDRAWAL PORTAL STATUS
  // --------------------------------------------------

  async function loadWithdrawalPortalStatus() {
    try {
      const settingsRef = doc(
        db,
        "settings",
        "withdrawalPortal"
      );

      const snapshot =
        await getDoc(settingsRef);

      if (snapshot.exists()) {
        const data = snapshot.data();

        setWithdrawalPortalLocked(
          data.locked === true
        );
      } else {
        // If the setting doesn't exist yet,
        // the withdrawal portal is open.
        setWithdrawalPortalLocked(false);
      }
    } catch (err) {
      console.error(
        "Withdrawal portal status error:",
        err
      );

      throw new Error(
        "Unable to load withdrawal portal status."
      );
    }
  }

  // --------------------------------------------------
  // LOAD EVERYTHING
  // --------------------------------------------------

  async function loadAdminData() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      await Promise.all([
        loadDeposits(),
        loadWithdrawals(),
        loadWithdrawalPortalStatus(),
      ]);
    } catch (err) {
      console.error(
        "Admin data loading error:",
        err
      );

      setError(
        "Unable to load admin data. Check your Firestore permissions and configuration."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authenticated) return;

    loadAdminData();
  }, [authenticated]);

  // --------------------------------------------------
  // LOCK / UNLOCK WITHDRAWAL PORTAL
  // --------------------------------------------------

  async function toggleWithdrawalPortal() {
    const newLockedState =
      !withdrawalPortalLocked;

    const actionText = newLockedState
      ? "lock"
      : "unlock";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} the withdrawal portal?`
    );

    if (!confirmed) return;

    try {
      setWithdrawalPortalLoading(true);
      setError("");
      setMessage("");

      const settingsRef = doc(
        db,
        "settings",
        "withdrawalPortal"
      );

      await setDoc(
        settingsRef,
        {
          locked: newLockedState,
          updatedAt: serverTimestamp(),
          updatedBy: "admin",
        },
        {
          merge: true,
        }
      );

      setWithdrawalPortalLocked(
        newLockedState
      );

      if (newLockedState) {
        setMessage(
          "Withdrawal portal has been locked. Users will no longer be able to submit withdrawal requests."
        );
      } else {
        setMessage(
          "Withdrawal portal has been unlocked. Users can submit withdrawal requests again."
        );
      }
    } catch (err) {
      console.error(
        "Withdrawal portal update error:",
        err
      );

      setError(
        "The withdrawal portal status could not be changed. Check your Firestore permissions."
      );
    } finally {
      setWithdrawalPortalLoading(false);
    }
  }

  // --------------------------------------------------
  // APPROVE DEPOSIT
  // --------------------------------------------------

  async function approveDeposit(
    deposit: Deposit
  ) {
    if (!deposit.userId) {
      setError(
        "This deposit does not have a valid user ID."
      );
      return;
    }

    if (
      typeof deposit.amount !== "number" ||
      !Number.isFinite(deposit.amount) ||
      deposit.amount < MINIMUM_DEPOSIT
    ) {
      setError(
        `This deposit does not meet the minimum deposit requirement of ₦${MINIMUM_DEPOSIT.toLocaleString(
          "en-NG"
        )}.`
      );
      return;
    }

    if (
      deposit.status?.toLowerCase() ===
      "approved"
    ) {
      setError(
        "This deposit has already been approved."
      );
      return;
    }

    if (
      deposit.status?.toLowerCase() ===
      "rejected"
    ) {
      setError(
        "A rejected deposit cannot be approved."
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

      const nextNigeriaMidnight =
        getNextNigeriaMidnight();

      const investmentRef = doc(
        db,
        "investments",
        deposit.userId
      );

      await setDoc(
        investmentRef,
        {
          status: "ACTIVE",

          investmentAmount:
            deposit.amount,

          principalAmount:
            deposit.amount,

          dailyReturn:
            DAILY_RETURN,

          totalReturns:
            CYCLE_TOTAL_RETURN,

          cycleDays:
            CYCLE_DAYS,

          startedAt:
            serverTimestamp(),

          nextReturnAt:
            nextNigeriaMidnight,

          depositId:
            deposit.id,

          userId:
            deposit.userId,

          currency:
            "NGN",

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      const depositRef = doc(
        db,
        "deposits",
        deposit.id
      );

      await updateDoc(
        depositRef,
        {
          status: "approved",

          approvedAt:
            serverTimestamp(),

          approvedBy:
            "admin",
        }
      );

      setMessage(
        "Deposit approved and investment activated successfully."
      );

      await loadAdminData();
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

  // --------------------------------------------------
  // REJECT DEPOSIT
  // --------------------------------------------------

  async function rejectDeposit(
    deposit: Deposit
  ) {
    if (
      deposit.status?.toLowerCase() ===
      "approved"
    ) {
      setError(
        "An approved deposit cannot be rejected from this section."
      );
      return;
    }

    if (
      deposit.status?.toLowerCase() ===
      "rejected"
    ) {
      setError(
        "This deposit has already been rejected."
      );
      return;
    }

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

      await updateDoc(
        depositRef,
        {
          status: "rejected",

          rejectedAt:
            serverTimestamp(),

          rejectedBy:
            "admin",
        }
      );

      setMessage(
        "Deposit request rejected."
      );

      await loadAdminData();
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

  // --------------------------------------------------
  // PROCESS WITHDRAWAL
  // --------------------------------------------------

  async function processWithdrawal(
    withdrawal: Withdrawal
  ) {
    if (!withdrawal.userId) {
      setError(
        "This withdrawal does not have a valid user ID."
      );
      return;
    }

    if (
      typeof withdrawal.amount !== "number" ||
      !Number.isFinite(withdrawal.amount) ||
      withdrawal.amount < 500
    ) {
      setError(
        "This withdrawal amount is invalid."
      );
      return;
    }

    if (
      withdrawal.status?.toUpperCase() !==
      "PENDING"
    ) {
      setError(
        "Only pending withdrawals can be processed."
      );
      return;
    }

    const paymentReference =
      window.prompt(
        "Enter the payment reference or transaction reference used to send the money:"
      );

    if (
      paymentReference === null
    ) {
      return;
    }

    const cleanedReference =
      paymentReference.trim();

    if (!cleanedReference) {
      setError(
        "A payment reference is required before marking the withdrawal as paid."
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm that ${formatMoney(
        withdrawal.amount
      )} has been sent to ${
        withdrawal.accountHolderName ||
        withdrawal.userFullName ||
        "this user"
      }?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(
        withdrawal.id
      );
      setError("");
      setMessage("");

      const withdrawalRef = doc(
        db,
        "withdrawals",
        withdrawal.id
      );

      await updateDoc(
        withdrawalRef,
        {
          status: "PAID",

          reviewedAt:
            serverTimestamp(),

          reviewedBy:
            "admin",

          paidAt:
            serverTimestamp(),

          paidBy:
            "admin",

          paymentReference:
            cleanedReference,
        }
      );

      setMessage(
        "Withdrawal marked as paid successfully."
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Withdrawal processing error:",
        err
      );

      setError(
        "The withdrawal could not be marked as paid."
      );
    } finally {
      setProcessingId("");
    }
  }

  // --------------------------------------------------
  // REJECT WITHDRAWAL
  // --------------------------------------------------

  async function rejectWithdrawal(
    withdrawal: Withdrawal
  ) {
    if (
      withdrawal.status?.toUpperCase() !==
      "PENDING"
    ) {
      setError(
        "Only pending withdrawals can be rejected."
      );
      return;
    }

    const rejectionReason =
      window.prompt(
        "Enter the reason for rejecting this withdrawal:"
      );

    if (
      rejectionReason === null
    ) {
      return;
    }

    const cleanedReason =
      rejectionReason.trim();

    if (!cleanedReason) {
      setError(
        "Please enter a rejection reason."
      );
      return;
    }

    const confirmed = window.confirm(
      `Reject the withdrawal of ${formatMoney(
        withdrawal.amount || 0
      )}?`
    );

    if (!confirmed) return;

    try {
      setProcessingId(
        withdrawal.id
      );
      setError("");
      setMessage("");

      const withdrawalRef = doc(
        db,
        "withdrawals",
        withdrawal.id
      );

      await updateDoc(
        withdrawalRef,
        {
          status: "REJECTED",

          reviewedAt:
            serverTimestamp(),

          reviewedBy:
            "admin",

          rejectionReason:
            cleanedReason,
        }
      );

      setMessage(
        "Withdrawal request rejected."
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Withdrawal rejection error:",
        err
      );

      setError(
        "The withdrawal could not be rejected."
      );
    } finally {
      setProcessingId("");
    }
  }

  // --------------------------------------------------
  // ADMIN LOGOUT
  // --------------------------------------------------

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

  // --------------------------------------------------
  // FORMAT MONEY
  // --------------------------------------------------

  function formatMoney(amount: number) {
    return `₦${amount.toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  // --------------------------------------------------
  // FORMAT DATE
  // --------------------------------------------------

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

  // --------------------------------------------------
  // ADMIN PASSWORD SCREEN
  // --------------------------------------------------

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
                  setPassword(
                    event.target.value
                  )
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

  // --------------------------------------------------
  // FILTER DEPOSITS
  // --------------------------------------------------

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

  // --------------------------------------------------
  // FILTER WITHDRAWALS
  // --------------------------------------------------

  const pendingWithdrawals =
    withdrawals.filter(
      (withdrawal) =>
        withdrawal.status?.toUpperCase() ===
        "PENDING"
    );

  const paidWithdrawals =
    withdrawals.filter(
      (withdrawal) =>
        withdrawal.status?.toUpperCase() ===
        "PAID"
    );

  const rejectedWithdrawals =
    withdrawals.filter(
      (withdrawal) =>
        withdrawal.status?.toUpperCase() ===
        "REJECTED"
    );

  // --------------------------------------------------
  // ADMIN DASHBOARD
  // --------------------------------------------------

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
            Manage deposits, withdrawals and
            portal availability.
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
              Pending withdrawals
            </span>

            <strong>
              {pendingWithdrawals.length}
            </strong>
          </div>

          <div className="admin-stat-card">
            <span>
              Paid withdrawals
            </span>

            <strong>
              {paidWithdrawals.length}
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

        {/* WITHDRAWAL PORTAL CONTROL */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="dashboard-eyebrow">
                WITHDRAWALS
              </p>

              <h2>
                Withdrawal portal
              </h2>

              <p>
                Control whether users can submit
                new withdrawal requests.
              </p>

            </div>

          </div>

          <div className="admin-portal-control">

            <div>

              <span>
                Current status
              </span>

              <strong>
                {withdrawalPortalLocked
                  ? "🔒 Withdrawal portal locked"
                  : "🟢 Withdrawal portal open"}
              </strong>

              <p>
                {withdrawalPortalLocked
                  ? "Users will see that withdrawals are currently unavailable."
                  : "Users can currently access and submit withdrawal requests."}
              </p>

            </div>

            <button
              type="button"
              className={
                withdrawalPortalLocked
                  ? "admin-approve-button"
                  : "admin-reject-button"
              }
              onClick={
                toggleWithdrawalPortal
              }
              disabled={
                withdrawalPortalLoading
              }
            >
              {withdrawalPortalLoading
                ? "Updating..."
                : withdrawalPortalLocked
                ? "Unlock withdrawal portal"
                : "Lock withdrawal portal"}
            </button>

          </div>

        </section>

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
              onClick={loadAdminData}
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

        {/* PENDING WITHDRAWALS */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="dashboard-eyebrow">
                WITHDRAWALS
              </p>

              <h2>
                Pending withdrawal requests
              </h2>

            </div>

            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={loadAdminData}
              disabled={loading}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>

          </div>

          {loading ? (

            <div className="admin-empty-card">
              Loading withdrawal requests...
            </div>

          ) : pendingWithdrawals.length === 0 ? (

            <div className="admin-empty-card">

              <strong>
                No pending withdrawals
              </strong>

              <p>
                New withdrawal requests will
                appear here when users submit them.
              </p>

            </div>

          ) : (

            <div className="admin-deposit-list">

              {pendingWithdrawals.map(
                (withdrawal) => (

                  <article
                    key={withdrawal.id}
                    className="admin-deposit-card"
                  >

                    <div className="admin-deposit-header">

                      <div>

                        <span>
                          User
                        </span>

                        <strong>
                          {withdrawal.userFullName ||
                            "Unknown user"}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Amount
                        </span>

                        <strong>
                          {formatMoney(
                            withdrawal.amount || 0
                          )}
                        </strong>

                      </div>

                    </div>

                    <div className="admin-deposit-details">

                      <div>

                        <span>
                          Email
                        </span>

                        <p>
                          {withdrawal.userEmail ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Bank
                        </span>

                        <p>
                          {withdrawal.bankName ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Account number
                        </span>

                        <p>
                          {withdrawal.accountNumber ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Account holder
                        </span>

                        <p>
                          {withdrawal.accountHolderName ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Reference
                        </span>

                        <p>
                          {withdrawal.reference ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Submitted
                        </span>

                        <p>
                          {formatDate(
                            withdrawal.createdAt
                          )}
                        </p>

                      </div>

                    </div>

                    <div className="admin-deposit-actions">

                      <button
                        type="button"
                        className="admin-approve-button"
                        onClick={() =>
                          processWithdrawal(
                            withdrawal
                          )
                        }
                        disabled={
                          processingId ===
                          withdrawal.id
                        }
                      >
                        {processingId ===
                        withdrawal.id
                          ? "Processing..."
                          : "Mark as paid"}
                      </button>

                      <button
                        type="button"
                        className="admin-reject-button"
                        onClick={() =>
                          rejectWithdrawal(
                            withdrawal
                          )
                        }
                        disabled={
                          processingId ===
                          withdrawal.id
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
                No approved deposits
              </strong>

            </div>

          ) : (

            <div className="admin-deposit-list">

              {approvedDeposits.map(
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
                          Approved
                        </span>

                        <p>
                          {formatDate(
                            deposit.approvedAt
                          )}
                        </p>

                      </div>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>

        {/* PAID WITHDRAWALS */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="dashboard-eyebrow">
                PAID
              </p>

              <h2>
                Paid withdrawals
              </h2>

            </div>

          </div>

          {paidWithdrawals.length === 0 ? (

            <div className="admin-empty-card">

              <strong>
                No paid withdrawals
              </strong>

            </div>

          ) : (

            <div className="admin-deposit-list">

              {paidWithdrawals.map(
                (withdrawal) => (

                  <article
                    key={withdrawal.id}
                    className="admin-deposit-card"
                  >

                    <div className="admin-deposit-header">

                      <div>

                        <span>
                          User
                        </span>

                        <strong>
                          {withdrawal.userFullName ||
                            "Unknown user"}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Amount paid
                        </span>

                        <strong>
                          {formatMoney(
                            withdrawal.amount || 0
                          )}
                        </strong>

                      </div>

                    </div>

                    <div className="admin-deposit-details">

                      <div>

                        <span>
                          Bank
                        </span>

                        <p>
                          {withdrawal.bankName ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Account number
                        </span>

                        <p>
                          {withdrawal.accountNumber ||
                            "—"}
                        </p>

                      </div>

                         <div>

                        <span>
                          Account holder
                        </span>

                        <p>
                          {withdrawal.accountHolderName ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Payment reference
                        </span>

                        <p>
                          {withdrawal.paymentReference ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Paid
                        </span>

                        <p>
                          {formatDate(
                            withdrawal.paidAt
                          )}
                        </p>

                      </div>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>

        {/* REJECTED WITHDRAWALS */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>

              <p className="dashboard-eyebrow">
                REJECTED
              </p>

              <h2>
                Rejected withdrawals
              </h2>

            </div>

          </div>

          {rejectedWithdrawals.length === 0 ? (

            <div className="admin-empty-card">

              <strong>
                No rejected withdrawals
              </strong>

            </div>

          ) : (

            <div className="admin-deposit-list">

              {rejectedWithdrawals.map(
                (withdrawal) => (

                  <article
                    key={withdrawal.id}
                    className="admin-deposit-card"
                  >

                    <div className="admin-deposit-header">

                      <div>

                        <span>
                          User
                        </span>

                        <strong>
                          {withdrawal.userFullName ||
                            "Unknown user"}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Amount requested
                        </span>

                        <strong>
                          {formatMoney(
                            withdrawal.amount || 0
                          )}
                        </strong>

                      </div>

                    </div>

                    <div className="admin-deposit-details">

                      <div>

                        <span>
                          Bank
                        </span>

                        <p>
                          {withdrawal.bankName ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Account number
                        </span>

                        <p>
                          {withdrawal.accountNumber ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Account holder
                        </span>

                        <p>
                          {withdrawal.accountHolderName ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Reference
                        </span>

                        <p>
                          {withdrawal.reference ||
                            "—"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Rejection reason
                        </span>

                        <p>
                          {withdrawal.rejectionReason ||
                            "No reason provided"}
                        </p>

                      </div>

                      <div>

                        <span>
                          Reviewed
                        </span>

                        <p>
                          {formatDate(
                            withdrawal.reviewedAt
                          )}
                        </p>

                      </div>

                    </div>

                  </article>

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

            <div className="admin-deposit-list">

              {rejectedDeposits.map(
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
                          Rejected
                        </span>

                        <p>
                          {formatDate(
                            deposit.rejectedAt
                          )}
                        </p>

                      </div>

                      <div>

                        <span>
                          Status
                        </span>

                        <p>
                          <strong>
                            Rejected
                          </strong>
                        </p>

                      </div>

                    </div>

                  </article>

                )
              )}

            </div>

          )}

        </section>

        {/* ADMIN FOOTER */}

        <footer className="admin-footer">

          <p>
            XS Company Limited — Administration
          </p>

          <p>
            Deposit and withdrawal requests are
            reviewed manually.
          </p>

        </footer>

      </div>

    </main>
  );
  }
