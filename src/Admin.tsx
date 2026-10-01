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

type UserRecord = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  balance?: number;
  availableBalance?: number;
  referralEarnings?: number;
  referredUsersCount?: number;
  referralCount?: number;
  referralCode?: string;
  referredBy?: string;
  createdAt?: any;
  investmentStatus?: string;
};

type Investment = {
  id: string;
  userId?: string;
  status?: string;
  investmentAmount?: number;
  principalAmount?: number;
  dailyReturn?: number;
  totalReturns?: number;
  cycleDays?: number;
  startedAt?: any;
  nextReturnAt?: any;
};

function getNigeriaNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getNextNigeriaMidnight() {
  const now = getNigeriaNow();

  const nextDay = new Date(
    Date.UTC(
      now.year,
      now.month - 1,
      now.day + 1,
      0,
      0,
      0
    )
  );

  return nextDay;
}

function formatMoney(value: number | undefined) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value: any) {
  if (!value) {
    return "—";
  }

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Lagos",
    }).format(date);
  } catch {
    return "—";
  }
}

export default function Admin() {
  const navigate = useNavigate();

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [withdrawalPortalLocked, setWithdrawalPortalLocked] =
    useState(false);

  const [withdrawalPortalLoading, setWithdrawalPortalLoading] =
    useState(false);

  const [selectedUser, setSelectedUser] =
    useState<UserRecord | null>(null);

  useEffect(() => {
    const savedAuth = sessionStorage.getItem("xs_admin_authenticated");

    if (savedAuth === "true") {
      setAuthenticated(true);
    }
  }, []);

  async function handleAdminLogin() {
    setPasswordError("");

    if (password !== ADMIN_PASSWORD) {
      setPasswordError("Incorrect admin password.");
      return;
    }

    sessionStorage.setItem("xs_admin_authenticated", "true");
    setAuthenticated(true);
    setPassword("");
  }

  async function loadUsers() {
    const usersSnapshot = await getDocs(
      collection(db, "users")
    );

    const userList: UserRecord[] = [];

    usersSnapshot.forEach((userDoc) => {
      const data = userDoc.data();

      userList.push({
        id: userDoc.id,
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        balance: Number(data.balance || 0),
        availableBalance: Number(
          data.availableBalance ?? data.balance ?? 0
        ),
        referralEarnings: Number(
          data.referralEarnings || 0
        ),
        referredUsersCount: Number(
          data.referredUsersCount ??
            data.referralCount ??
            0
        ),
        referralCount: Number(
          data.referralCount ||
            data.referredUsersCount ||
            0
        ),
        referralCode: data.referralCode || "",
        referredBy: data.referredBy || "",
        createdAt: data.createdAt,
        investmentStatus: data.investmentStatus || "",
      });
    });

    setUsers(userList);
  }

  async function loadInvestments() {
    const investmentsSnapshot = await getDocs(
      collection(db, "investments")
    );

    const investmentList: Investment[] = [];

    investmentsSnapshot.forEach((investmentDoc) => {
      const data = investmentDoc.data();

      investmentList.push({
        id: investmentDoc.id,
        userId: data.userId || investmentDoc.id,
        status: data.status || "",
        investmentAmount: Number(
          data.investmentAmount || 0
        ),
        principalAmount: Number(
          data.principalAmount ||
            data.investmentAmount ||
            0
        ),
        dailyReturn: Number(
          data.dailyReturn || DAILY_RETURN
        ),
        totalReturns: Number(
          data.totalReturns || CYCLE_TOTAL_RETURN
        ),
        cycleDays: Number(
          data.cycleDays || CYCLE_DAYS
        ),
        startedAt: data.startedAt,
        nextReturnAt: data.nextReturnAt,
      });
    });

    setInvestments(investmentList);
  }

  async function loadDeposits() {
    const depositsQuery = query(
      collection(db, "deposits"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(depositsQuery);

    const depositList: Deposit[] = [];

    snapshot.forEach((depositDoc) => {
      const data = depositDoc.data();

      depositList.push({
        id: depositDoc.id,
        userId: data.userId,
        senderName: data.senderName,
        amount: Number(data.amount || 0),
        currency: data.currency || "NGN",
        status: data.status || "pending",
        type: data.type || "investment",
        createdAt: data.createdAt,
        approvedAt: data.approvedAt,
        rejectedAt: data.rejectedAt,
      });
    });

    setDeposits(depositList);
  }

  async function loadWithdrawals() {
    const withdrawalsQuery = query(
      collection(db, "withdrawals"),
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(withdrawalsQuery);

    const withdrawalList: Withdrawal[] = [];

    snapshot.forEach((withdrawalDoc) => {
      const data = withdrawalDoc.data();

      withdrawalList.push({
        id: withdrawalDoc.id,
        userId: data.userId,
        userFullName: data.userFullName,
        userEmail: data.userEmail,
        amount: Number(data.amount || 0),
        currency: data.currency || "NGN",
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountHolderName: data.accountHolderName,
        reference: data.reference,
        status: data.status || "PENDING",
        createdAt: data.createdAt,
        reviewedAt: data.reviewedAt,
        reviewedBy: data.reviewedBy,
        paidAt: data.paidAt,
        paidBy: data.paidBy,
        paymentReference: data.paymentReference,
        rejectionReason: data.rejectionReason,
      });
    });

    setWithdrawals(withdrawalList);
  }

  async function loadWithdrawalPortalStatus() {
    const settingsRef = doc(
      db,
      "settings",
      "withdrawalPortal"
    );

    const snapshot = await getDoc(settingsRef);

    if (snapshot.exists()) {
      const data = snapshot.data();

      setWithdrawalPortalLocked(
        data.locked === true
      );
    } else {
      setWithdrawalPortalLocked(false);
    }
  }

  async function loadAdminData() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadUsers(),
        loadInvestments(),
        loadDeposits(),
        loadWithdrawals(),
        loadWithdrawalPortalStatus(),
      ]);
    } catch (err) {
      console.error("Admin data loading error:", err);

      setError(
        "Some admin data could not be loaded. Check your Firestore permissions."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authenticated) {
      loadAdminData();
    }
  }, [authenticated]);

  async function toggleWithdrawalPortal() {
    const newLockedState = !withdrawalPortalLocked;

    const actionText = newLockedState
      ? "lock"
      : "unlock";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} the withdrawal portal?`
    );

    if (!confirmed) {
      return;
    }

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
        { merge: true }
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

  async function approveDeposit(deposit: Deposit) {
    if (!deposit.userId) {
      setError(
        "This deposit does not have a valid user ID."
      );
      return;
    }

    const amount = Number(deposit.amount || 0);

    if (amount < MINIMUM_DEPOSIT) {
      setError(
        `The minimum investment deposit is ${formatMoney(
          MINIMUM_DEPOSIT
        )}.`
      );
      return;
    }

    if (
      deposit.status?.toLowerCase() ===
        "approved" ||
      deposit.status?.toLowerCase() ===
        "rejected"
    ) {
      setError(
        "This deposit has already been processed."
      );
      return;
    }

    const confirmed = window.confirm(
      `Approve this ${formatMoney(
        amount
      )} investment deposit?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(deposit.id);
      setError("");
      setMessage("");

      const investmentRef = doc(
        db,
        "investments",
        deposit.userId
      );

      const nextNigeriaMidnight =
        getNextNigeriaMidnight();

      await setDoc(
        investmentRef,
        {
          status: "ACTIVE",
          investmentAmount: amount,
          principalAmount: amount,
          dailyReturn: DAILY_RETURN,
          totalReturns: CYCLE_TOTAL_RETURN,
          cycleDays: CYCLE_DAYS,
          startedAt: serverTimestamp(),
          nextReturnAt:
            nextNigeriaMidnight,
          depositId: deposit.id,
          userId: deposit.userId,
          currency: "NGN",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const depositRef = doc(
        db,
        "deposits",
        deposit.id
      );

      await updateDoc(depositRef, {
        status: "approved",
        approvedAt: serverTimestamp(),
      });

      setMessage(
        `Deposit approved. ${formatMoney(
          amount
        )} investment activated for the user.`
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Approve deposit error:",
        err
      );

      setError(
        "The deposit could not be approved. Check your Firestore permissions."
      );
    } finally {
      setProcessingId("");
    }
  }

  async function rejectDeposit(deposit: Deposit) {
    const confirmed = window.confirm(
      "Are you sure you want to reject this deposit?"
    );

    if (!confirmed) {
      return;
    }

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
      });

      setMessage(
        "Deposit rejected successfully."
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Reject deposit error:",
        err
      );

      setError(
        "The deposit could not be rejected."
      );
    } finally {
      setProcessingId("");
    }
  }

  async function processWithdrawal(
    withdrawal: Withdrawal
  ) {
    if (!withdrawal.userId) {
      setError(
        "This withdrawal does not have a valid user ID."
      );
      return;
    }

    const amount = Number(
      withdrawal.amount || 0
    );

    if (amount < MINIMUM_DEPOSIT) {
      setError(
        `The minimum withdrawal is ${formatMoney(
          MINIMUM_DEPOSIT
        )}.`
      );
      return;
    }

    if (
      withdrawal.status?.toUpperCase() !==
      "PENDING"
    ) {
      setError(
        "This withdrawal has already been processed."
      );
      return;
    }

    const paymentReference =
      window.prompt(
        "Enter the payment reference used for this withdrawal:"
      );

    if (!paymentReference?.trim()) {
      return;
    }

    const confirmed = window.confirm(
      `Confirm that ${formatMoney(
        amount
      )} has actually been sent to ${withdrawal.accountHolderName || "the user"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(withdrawal.id);
      setError("");
      setMessage("");

      const withdrawalRef = doc(
        db,
        "withdrawals",
        withdrawal.id
      );

      await updateDoc(withdrawalRef, {
        status: "PAID",
        reviewedAt: serverTimestamp(),
        reviewedBy: "admin",
        paidAt: serverTimestamp(),
        paidBy: "admin",
        paymentReference:
          paymentReference.trim(),
      });

      setMessage(
        `Withdrawal marked PAID. Payment reference: ${paymentReference.trim()}`
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Process withdrawal error:",
        err
      );

      setError(
        "The withdrawal could not be marked as paid."
      );
    } finally {
      setProcessingId("");
    }
  }

  async function rejectWithdrawal(
    withdrawal: Withdrawal
  ) {
    const reason = window.prompt(
      "Enter the reason for rejecting this withdrawal:"
    );

    if (!reason?.trim()) {
      return;
    }

    try {
      setProcessingId(withdrawal.id);
      setError("");
      setMessage("");

      const withdrawalRef = doc(
        db,
        "withdrawals",
        withdrawal.id
      );

      await updateDoc(withdrawalRef, {
        status: "REJECTED",
        reviewedAt: serverTimestamp(),
        reviewedBy: "admin",
        rejectionReason:
          reason.trim(),
      });

      setMessage(
        "Withdrawal rejected successfully."
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Reject withdrawal error:",
        err
      );

      setError(
        "The withdrawal could not be rejected."
      );
    } finally {
      setProcessingId("");
    }
  }

  async function handleLogout() {
    sessionStorage.removeItem(
      "xs_admin_authenticated"
    );

    try {
      await signOut(auth);
    } catch {
      // Admin password session can still be cleared
      // even if Firebase sign-out is unnecessary.
    }

    setAuthenticated(false);
    navigate("/");
  }

  function getUserInvestment(userId: string) {
    return investments.find(
      (investment) =>
        investment.userId === userId ||
        investment.id === userId
    );
  }

  function getUserTotalDeposited(
    userId: string
  ) {
    return deposits
      .filter(
        (deposit) =>
          deposit.userId === userId &&
          deposit.status?.toLowerCase() ===
            "approved"
      )
      .reduce(
        (total, deposit) =>
          total + Number(deposit.amount || 0),
        0
      );
  }

  function getUserDepositCount(
    userId: string
  ) {
    return deposits.filter(
      (deposit) =>
        deposit.userId === userId &&
        deposit.status?.toLowerCase() ===
          "approved"
    ).length;
  }

  function getUserWithdrawalTotal(
    userId: string
  ) {
    return withdrawals
      .filter(
        (withdrawal) =>
          withdrawal.userId === userId &&
          withdrawal.status?.toUpperCase() ===
            "PAID"
      )
      .reduce(
        (total, withdrawal) =>
          total +
          Number(withdrawal.amount || 0),
        0
      );
  }

  if (!authenticated) {
    return (
      <main className="admin-page">
        <div className="admin-login-container">
          <section className="admin-login-card">
            <div className="admin-logo">
              <span className="brand-x">
                X
              </span>
              <span className="brand-s">
                S
              </span>
            </div>

            <p className="dashboard-eyebrow">
              XS COMPANY LIMITED
            </p>

            <h1>Admin Panel</h1>

            <p>
              Enter the administrator password
              to continue.
            </p>

            {passwordError && (
              <div className="admin-error">
                {passwordError}
              </div>
            )}

            <div className="admin-form-group">
              <label htmlFor="adminPassword">
                Admin Password
              </label>

              <input
                id="adminPassword"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(
                    event.target.value
                  );
                  setPasswordError("");
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter"
                  ) {
                    handleAdminLogin();
                  }
                }}
                placeholder="Enter admin password"
              />
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={handleAdminLogin}
            >
              Enter Admin Panel
                  </button>

            <Link
              to="/dashboard"
              className="admin-back-link"
            >
              ← Back to Dashboard
            </Link>
          </section>
        </div>
      </main>
    );
  }

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

  const totalApprovedDeposits =
    approvedDeposits.reduce(
      (total, deposit) =>
        total + Number(deposit.amount || 0),
      0
    );

  const totalPaidWithdrawals =
    paidWithdrawals.reduce(
      (total, withdrawal) =>
        total +
        Number(withdrawal.amount || 0),
      0
    );

  const totalUserBalances =
    users.reduce(
      (total, user) =>
        total + Number(user.balance || 0),
      0
    );

  const totalReferralEarnings =
    users.reduce(
      (total, user) =>
        total +
        Number(user.referralEarnings || 0),
      0
    );

  return (
    <main className="admin-page">
      <header className="admin-navbar">
        <Link
          to="/dashboard"
          className="dashboard-brand"
        >
          <span className="brand-x">X</span>
          <span className="brand-s">S</span>
          <span className="brand-name">
            Company Limited
          </span>
        </Link>

        <div className="admin-navbar-actions">
          <Link
            to="/dashboard"
            className="admin-back-link"
          >
            Dashboard
          </Link>

          <button
            type="button"
            className="admin-logout-button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="admin-container">
        <section className="admin-welcome">
          <p className="dashboard-eyebrow">
            ADMINISTRATION
          </p>

          <h1>Welcome to XS Admin</h1>

          <p>
            Manage deposits, withdrawals,
            users, investments and the
            withdrawal portal.
          </p>
        </section>

        {message && (
          <div className="admin-success">
            {message}
          </div>
        )}

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        {/* SUMMARY */}
        <section className="admin-summary-grid">
          <article className="admin-summary-card">
            <span>Total Users</span>
            <strong>{users.length}</strong>
          </article>

          <article className="admin-summary-card">
            <span>Total Balances</span>
            <strong>
              {formatMoney(totalUserBalances)}
            </strong>
          </article>

          <article className="admin-summary-card">
            <span>Total Deposited</span>
            <strong>
              {formatMoney(
                totalApprovedDeposits
              )}
            </strong>
          </article>

          <article className="admin-summary-card">
            <span>Paid Withdrawals</span>
            <strong>
              {formatMoney(
                totalPaidWithdrawals
              )}
            </strong>
          </article>

          <article className="admin-summary-card">
            <span>Referral Earnings</span>
            <strong>
              {formatMoney(
                totalReferralEarnings
              )}
            </strong>
          </article>

          <article className="admin-summary-card">
            <span>Pending Deposits</span>
            <strong>
              {pendingDeposits.length}
            </strong>
          </article>

          <article className="admin-summary-card">
            <span>Pending Withdrawals</span>
            <strong>
              {pendingWithdrawals.length}
            </strong>
          </article>

          <article className="admin-summary-card">
            <span>Active Investments</span>
            <strong>
              {
                investments.filter(
                  (investment) =>
                    investment.status?.toUpperCase() ===
                    "ACTIVE"
                ).length
              }
            </strong>
          </article>
        </section>

        {/* WITHDRAWAL PORTAL CONTROL */}
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                USER ACCESS
              </p>

              <h2>
                Withdrawal Portal
              </h2>
            </div>

            <div
              className={
                withdrawalPortalLocked
                  ? "admin-status locked"
                  : "admin-status open"
              }
            >
              {withdrawalPortalLocked
                ? "LOCKED"
                : "OPEN"}
            </div>
          </div>

          <div className="admin-portal-control">
            <div>
              <strong>
                {withdrawalPortalLocked
                  ? "Withdrawals are currently locked"
                  : "Withdrawals are currently available"}
              </strong>

              <p>
                {withdrawalPortalLocked
                  ? "Users cannot submit new withdrawal requests."
                  : "Users can currently submit withdrawal requests."}
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
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
                ? "Unlock Withdrawals"
                : "Lock Withdrawals"}
            </button>
          </div>
        </section>

        {/* USERS */}
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                USERS
              </p>

              <h2>User Accounts</h2>
            </div>

            <span>
              {users.length} user
              {users.length === 1
                ? ""
                : "s"}
            </span>
          </div>

          {loading ? (
            <p>Loading users...</p>
          ) : users.length === 0 ? (
            <div className="admin-empty-state">
              No registered users found.
            </div>
          ) : (
            <div className="admin-user-list">
              {users.map((user) => {
                const investment =
                  getUserInvestment(user.id);

                const totalDeposited =
                  getUserTotalDeposited(
                    user.id
                  );

                const depositCount =
                  getUserDepositCount(
                    user.id
                  );

                const withdrawalTotal =
                  getUserWithdrawalTotal(
                    user.id
                  );

                return (
                  <article
                    key={user.id}
                    className="admin-user-card"
                  >
                    <div className="admin-user-card-header">
                      <div>
                        <p className="dashboard-eyebrow">
                          USER
                        </p>

                        <h3>
                          {user.fullName ||
                            "Unnamed User"}
                        </h3>

                        <p>
                          {user.email ||
                            "No email"}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setSelectedUser(
                            user
                          )
                        }
                      >
                        View Details
                      </button>
                    </div>

                    <div className="admin-user-grid">
                      <div>
                        <span>Balance</span>

                        <strong>
                          {formatMoney(
                            user.balance
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Available Balance
                        </span>

                        <strong>
                          {formatMoney(
                            user.availableBalance
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Total Deposited
                        </span>

                        <strong>
                          {formatMoney(
                            totalDeposited
                          )}
                        </strong>

                        <small>
                          {depositCount} approved
                          deposit
                          {depositCount === 1
                            ? ""
                            : "s"}
                        </small>
                      </div>

                      <div>
                        <span>
                          Referral Earnings
                        </span>

                        <strong>
                          {formatMoney(
                            user.referralEarnings
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Referred Users
                        </span>

                        <strong>
                          {user.referredUsersCount ??
                            user.referralCount ??
                            0}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Paid Withdrawals
                        </span>

                        <strong>
                          {formatMoney(
                            withdrawalTotal
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Investment
                        </span>

                        <strong>
                          {investment
                            ? investment.status ||
                              "—"
                            : "None"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Investment Amount
                        </span>

                        <strong>
                          {formatMoney(
                            investment?.investmentAmount
                          )}
                        </strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* PENDING DEPOSITS */}
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                DEPOSITS
              </p>

              <h2>Pending Deposits</h2>
            </div>

            <span>
              {pendingDeposits.length}
            </span>
          </div>

          {pendingDeposits.length === 0 ? (
            <div className="admin-empty-state">
              No pending deposits.
            </div>
          ) : (
            <div className="admin-list">
              {pendingDeposits.map(
                (deposit) => (
                  <article
                    key={deposit.id}
                    className="admin-item-card"
                  >
                    <div className="admin-item-header">
                      <div>
                        <h3>
                          {formatMoney(
                            deposit.amount
                          )}
                        </h3>

                        <p>
                          {deposit.senderName ||
                            "Sender name not provided"}
                        </p>
                      </div>

                      <span className="admin-status pending">
                        PENDING
                      </span>
                    </div>

                    <div className="admin-item-grid">
                      <div>
                        <span>User ID</span>

                        <p>
                          {deposit.userId ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Type</span>

                        <p>
                          {deposit.type ||
                            "investment"}
                        </p>
                      </div>

                      <div>
                        <span>Submitted</span>

                        <p>
                          {formatDate(
                            deposit.createdAt
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="admin-actions">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          processingId ===
                          deposit.id
                        }
                        onClick={() =>
                          approveDeposit(
                            deposit
                          )
                        }
                      >
                        {processingId ===
                        deposit.id
                          ? "Processing..."
                          : "Approve Deposit"}
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        disabled={
                          processingId ===
                          deposit.id
                        }
                        onClick={() =>
                          rejectDeposit(
                            deposit
                          )
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
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                WITHDRAWALS
              </p>

              <h2>
                Pending Withdrawals
              </h2>
            </div>

            <span>
              {pendingWithdrawals.length}
            </span>
          </div>

          {pendingWithdrawals.length ===
          0 ? (
            <div className="admin-empty-state">
              No pending withdrawals.
            </div>
          ) : (
            <div className="admin-list">
              {pendingWithdrawals.map(
                (withdrawal) => (
                  <article
                    key={withdrawal.id}
                    className="admin-item-card"
                  >
                    <div className="admin-item-header">
                      <div>
                        <h3>
                          {formatMoney(
                            withdrawal.amount
                          )}
                        </h3>

                        <p>
                          {withdrawal.userFullName ||
                            "XS User"}
                        </p>
                      </div>

                      <span className="admin-status pending">
                        PENDING
                      </span>
                    </div>

                    <div className="admin-item-grid">
                      <div>
                        <span>Email</span>

                        <p>
                          {withdrawal.userEmail ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Bank</span>

                        <p>
                          {withdrawal.bankName ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>
                          Account Number
                        </span>

                        <p>
                          {withdrawal.accountNumber ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>
                          Account Holder
                        </span>

                        <p>
                          {withdrawal.accountHolderName ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Reference</span>

                        <p>
                          {withdrawal.reference ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Requested</span>

                        <p>
                          {formatDate(
                            withdrawal.createdAt
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="admin-actions">
                      <button
                        type="button"
                        className="primary-button"
                        disabled={
                          processingId ===
                          withdrawal.id
                        }
                        onClick={() =>
                          processWithdrawal(
                            withdrawal
                          )
                        }
                      >
                        {processingId ===
                        withdrawal.id
                          ? "Processing..."
                          : "Mark as Paid"}
                      </button>

                      <button
                        type="button"
                        className="danger-button"
                        disabled={
                          processingId ===
                          withdrawal.id
                        }
                        onClick={() =>
                                   onClick={() =>
                            rejectWithdrawal(
                              withdrawal
                            )
                          }
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
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                DEPOSITS
              </p>

              <h2>Approved Deposits</h2>
            </div>

            <span>
              {approvedDeposits.length}
            </span>
          </div>

          {approvedDeposits.length === 0 ? (
            <div className="admin-empty-state">
              No approved deposits.
            </div>
          ) : (
            <div className="admin-list">
              {approvedDeposits.map(
                (deposit) => (
                  <article
                    key={deposit.id}
                    className="admin-item-card"
                  >
                    <div className="admin-item-header">
                      <div>
                        <h3>
                          {formatMoney(
                            deposit.amount
                          )}
                        </h3>

                        <p>
                          {deposit.senderName ||
                            "Sender name not provided"}
                        </p>
                      </div>

                      <span className="admin-status approved">
                        APPROVED
                      </span>
                    </div>

                    <div className="admin-item-grid">
                      <div>
                        <span>User ID</span>

                        <p>
                          {deposit.userId ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Type</span>

                        <p>
                          {deposit.type ||
                            "investment"}
                        </p>
                      </div>

                      <div>
                        <span>Approved</span>

                        <p>
                          {formatDate(
                            deposit.approvedAt ||
                              deposit.createdAt
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
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                WITHDRAWALS
              </p>

              <h2>Paid Withdrawals</h2>
            </div>

            <span>
              {paidWithdrawals.length}
            </span>
          </div>

          {paidWithdrawals.length === 0 ? (
            <div className="admin-empty-state">
              No paid withdrawals.
            </div>
          ) : (
            <div className="admin-list">
              {paidWithdrawals.map(
                (withdrawal) => (
                  <article
                    key={withdrawal.id}
                    className="admin-item-card"
                  >
                    <div className="admin-item-header">
                      <div>
                        <h3>
                          {formatMoney(
                            withdrawal.amount
                          )}
                        </h3>

                        <p>
                          {withdrawal.userFullName ||
                            "XS User"}
                        </p>
                      </div>

                      <span className="admin-status paid">
                        PAID
                      </span>
                    </div>

                    <div className="admin-item-grid">
                      <div>
                        <span>Email</span>

                        <p>
                          {withdrawal.userEmail ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Bank</span>

                        <p>
                          {withdrawal.bankName ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>
                          Account Number
                        </span>

                        <p>
                          {withdrawal.accountNumber ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>
                          Account Holder
                        </span>

                        <p>
                          {withdrawal.accountHolderName ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>
                          Payment Reference
                        </span>

                        <p>
                          {withdrawal.paymentReference ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Paid</span>

                        <p>
                          {formatDate(
                            withdrawal.paidAt ||
                              withdrawal.reviewedAt ||
                              withdrawal.createdAt
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
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                WITHDRAWALS
              </p>

              <h2>Rejected Withdrawals</h2>
            </div>

            <span>
              {rejectedWithdrawals.length}
            </span>
          </div>

          {rejectedWithdrawals.length === 0 ? (
            <div className="admin-empty-state">
              No rejected withdrawals.
            </div>
          ) : (
            <div className="admin-list">
              {rejectedWithdrawals.map(
                (withdrawal) => (
                  <article
                    key={withdrawal.id}
                    className="admin-item-card"
                  >
                    <div className="admin-item-header">
                      <div>
                        <h3>
                          {formatMoney(
                            withdrawal.amount
                          )}
                        </h3>

                        <p>
                          {withdrawal.userFullName ||
                            "XS User"}
                        </p>
                      </div>

                      <span className="admin-status rejected">
                        REJECTED
                      </span>
                    </div>

                    <div className="admin-item-grid">
                      <div>
                        <span>Email</span>

                        <p>
                          {withdrawal.userEmail ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Bank</span>

                        <p>
                          {withdrawal.bankName ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Account Number</span>

                        <p>
                          {withdrawal.accountNumber ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Account Holder</span>

                        <p>
                          {withdrawal.accountHolderName ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Reason</span>

                        <p>
                          {withdrawal.rejectionReason ||
                            "No reason provided"}
                        </p>
                      </div>

                      <div>
                        <span>Reviewed</span>

                        <p>
                          {formatDate(
                            withdrawal.reviewedAt ||
                              withdrawal.createdAt
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
          <div className="admin-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                DEPOSITS
              </p>

              <h2>Rejected Deposits</h2>
            </div>

            <span>
              {rejectedDeposits.length}
            </span>
          </div>

          {rejectedDeposits.length === 0 ? (
            <div className="admin-empty-state">
              No rejected deposits.
            </div>
          ) : (
            <div className="admin-list">
              {rejectedDeposits.map(
                (deposit) => (
                  <article
                    key={deposit.id}
                    className="admin-item-card"
                  >
                    <div className="admin-item-header">
                      <div>
                        <h3>
                          {formatMoney(
                            deposit.amount
                          )}
                        </h3>

                        <p>
                          {deposit.senderName ||
                            "Sender name not provided"}
                        </p>
                      </div>

                      <span className="admin-status rejected">
                        REJECTED
                      </span>
                    </div>

                    <div className="admin-item-grid">
                      <div>
                        <span>User ID</span>

                        <p>
                          {deposit.userId ||
                            "—"}
                        </p>
                      </div>

                      <div>
                        <span>Type</span>

                        <p>
                          {deposit.type ||
                            "investment"}
                        </p>
                      </div>

                      <div>
                        <span>Rejected</span>

                        <p>
                          {formatDate(
                            deposit.rejectedAt ||
                              deposit.createdAt
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

        {/* USER DETAILS MODAL */}
        {selectedUser && (
          <div
            className="admin-modal-overlay"
            onClick={() =>
              setSelectedUser(null)
            }
          >
            <div
              className="admin-modal"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="admin-modal-header">
                <div>
                  <p className="dashboard-eyebrow">
                    USER DETAILS
                  </p>

                  <h2>
                    {selectedUser.fullName ||
                      "Unnamed User"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="admin-close-button"
                  onClick={() =>
                    setSelectedUser(null)
                  }
                >
                  ×
                </button>
              </div>

              {(() => {
                const investment =
                  getUserInvestment(
                    selectedUser.id
                  );

                const totalDeposited =
                  getUserTotalDeposited(
                    selectedUser.id
                  );

                const depositCount =
                  getUserDepositCount(
                    selectedUser.id
                  );

                const withdrawalTotal =
                  getUserWithdrawalTotal(
                    selectedUser.id
                  );

                return (
                  <div className="admin-detail-grid">
                    <div>
                      <span>Full Name</span>

                      <strong>
                        {selectedUser.fullName ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Email</span>

                      <strong>
                        {selectedUser.email ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Phone</span>

                      <strong>
                        {selectedUser.phone ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>UID</span>

                      <strong>
                        {selectedUser.id}
                      </strong>
                    </div>

                    <div>
                      <span>Balance</span>

                      <strong>
                        {formatMoney(
                          selectedUser.balance
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Available Balance
                      </span>

                      <strong>
                        {formatMoney(
                          selectedUser.availableBalance
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Total Deposited</span>

                      <strong>
                        {formatMoney(
                          totalDeposited
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Approved Deposits
                      </span>

                      <strong>
                        {depositCount}
                      </strong>
                    </div>

                    <div>
                      <span>Referral Code</span>

                      <strong>
                        {selectedUser.referralCode ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Referred Users
                      </span>

                      <strong>
                        {selectedUser.referredUsersCount ??
                          selectedUser.referralCount ??
                          0}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Referral Earnings
                      </span>

                      <strong>
                        {formatMoney(
                          selectedUser.referralEarnings
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Total Paid Withdrawals
                      </span>

                      <strong>
                        {formatMoney(
                          withdrawalTotal
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Investment Status
                      </span>

                      <strong>
                        {investment?.status ||
                          selectedUser.investmentStatus ||
                          "None"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Investment Amount
                      </span>

                      <strong>
                        {formatMoney(
                          investment?.investmentAmount
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Daily Return</span>

                      <strong>
                        {formatMoney(
                          investment?.dailyReturn
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Cycle Total Return
                      </span>

                      <strong>
                        {formatMoney(
                          investment?.totalReturns
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Referred By</span>

                      <strong>
                        {selectedUser.referredBy ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Registered</span>

                      <strong>
                        {formatDate(
                          selectedUser.createdAt
                        )}
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <footer className="dashboard-footer">
          <p>
            © {new Date().getFullYear()} XS
            Company Limited. Admin Panel.
          </p>
        </footer>
      </div>
    </main>
  );
                                     }
