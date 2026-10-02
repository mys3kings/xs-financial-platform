import { useEffect, useMemo, useState } from "react";
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
import { getInitialNextReturnAt } from "./returnLogic";

const ADMIN_PASSWORD = "2007";

const MINIMUM_DEPOSIT = 500;
const MINIMUM_WITHDRAWAL = 500;

const DAILY_RETURN = 200;

const CYCLE_DAYS = 3;
const CYCLE_TOTAL_RETURN = DAILY_RETURN * CYCLE_DAYS;

type AdminSection =
  | "overview"
  | "users"
  | "deposits"
  | "withdrawals"
  | "investments"
  | "referrals";

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
  qualifiedReferrals?: number;
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
  returnsProcessed?: number;
  lastReturnDate?: string;
  startedAt?: any;
  nextReturnAt?: any;
  depositId?: string;
  currency?: string;
};

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

function normalizeStatus(status?: string) {
  return String(status || "").trim().toLowerCase();
}

function getStatusClass(status?: string) {
  const normalized = normalizeStatus(status);

  if (
    normalized === "approved" ||
    normalized === "paid" ||
    normalized === "active" ||
    normalized === "successful"
  ) {
    return "status-success";
  }

  if (
    normalized === "rejected" ||
    normalized === "failed"
  ) {
    return "status-danger";
  }

  if (
    normalized === "pending" ||
    normalized === "inactive"
  ) {
    return "status-warning";
  }

  return "status-neutral";
}

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

  const [users, setUsers] =
    useState<UserRecord[]>([]);

  const [investments, setInvestments] =
    useState<Investment[]>([]);

  const [activeSection, setActiveSection] =
    useState<AdminSection>("overview");

  const [loading, setLoading] =
    useState(false);

  const [processingId, setProcessingId] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [selectedUser, setSelectedUser] =
    useState<UserRecord | null>(null);

  const [userSearch, setUserSearch] =
    useState("");

  const [
    withdrawalPortalLocked,
    setWithdrawalPortalLocked,
  ] = useState(false);

  const [
    withdrawalPortalLoading,
    setWithdrawalPortalLoading,
  ] = useState(false);

  useEffect(() => {
    const savedAuth = sessionStorage.getItem(
      "xs_admin_authenticated"
    );

    if (savedAuth === "true") {
      setAuthenticated(true);
    }
  }, []);

  async function handleAdminLogin() {
    setPasswordError("");

    if (password !== ADMIN_PASSWORD) {
      setPasswordError(
        "Incorrect admin password."
      );
      return;
    }

    sessionStorage.setItem(
      "xs_admin_authenticated",
      "true"
    );

    setAuthenticated(true);
    setPassword("");
  }

  function handleAdminLogout() {
    sessionStorage.removeItem(
      "xs_admin_authenticated"
    );

    setAuthenticated(false);
    setPassword("");
    setActiveSection("overview");
}  async function loadUsers() {
    const snapshot = await getDocs(
      collection(db, "users")
    );

    const userList: UserRecord[] = [];

    snapshot.forEach((userDoc) => {
      const data = userDoc.data();

      userList.push({
        id: userDoc.id,

        fullName:
          data.fullName || "",

        email:
          data.email || "",

        phone:
          data.phone || "",

        balance: Number(
          data.balance || 0
        ),

        availableBalance: Number(
          data.availableBalance ??
            data.balance ??
            0
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
          data.referralCount ??
            data.referredUsersCount ??
            0
        ),

        qualifiedReferrals: Number(
          data.qualifiedReferrals || 0
        ),

        referralCode:
          data.referralCode || "",

        referredBy:
          data.referredBy || "",

        createdAt:
          data.createdAt,

        investmentStatus:
          data.investmentStatus || "",
      });
    });

    userList.sort((a, b) =>
      String(a.fullName || "").localeCompare(
        String(b.fullName || "")
      )
    );

    setUsers(userList);
  }

  async function loadInvestments() {
    const snapshot = await getDocs(
      collection(db, "investments")
    );

    const investmentList: Investment[] =
      [];

    snapshot.forEach((investmentDoc) => {
      const data = investmentDoc.data();

      investmentList.push({
        id: investmentDoc.id,

        userId:
          data.userId ||
          investmentDoc.id,

        status:
          data.status || "",

        investmentAmount: Number(
          data.investmentAmount || 0
        ),

        principalAmount: Number(
          data.principalAmount ??
            data.investmentAmount ??
            0
        ),

        dailyReturn: Number(
          data.dailyReturn ??
            DAILY_RETURN
        ),

        totalReturns: Number(
          data.totalReturns || 0
        ),

        cycleDays: Number(
          data.cycleDays ??
            CYCLE_DAYS
        ),

        returnsProcessed: Number(
          data.returnsProcessed || 0
        ),

        lastReturnDate:
          data.lastReturnDate || "",

        startedAt:
          data.startedAt,

        nextReturnAt:
          data.nextReturnAt,

        depositId:
          data.depositId || "",

        currency:
          data.currency || "NGN",
      });
    });

    setInvestments(investmentList);
  }

  async function loadDeposits() {
    const depositsQuery = query(
      collection(db, "deposits"),
      orderBy("createdAt", "desc")
    );

    const snapshot =
      await getDocs(depositsQuery);

    const depositList: Deposit[] = [];

    snapshot.forEach((depositDoc) => {
      const data = depositDoc.data();

      depositList.push({
        id: depositDoc.id,

        userId:
          data.userId,

        senderName:
          data.senderName,

        amount: Number(
          data.amount || 0
        ),

        currency:
          data.currency || "NGN",

        status:
          data.status || "pending",

        type:
          data.type || "investment",

        createdAt:
          data.createdAt,

        approvedAt:
          data.approvedAt,

        rejectedAt:
          data.rejectedAt,
      });
    });

    setDeposits(depositList);
  }

  async function loadWithdrawals() {
    const withdrawalsQuery = query(
      collection(db, "withdrawals"),
      orderBy("createdAt", "desc")
    );

    const snapshot =
      await getDocs(withdrawalsQuery);

    const withdrawalList: Withdrawal[] =
      [];

    snapshot.forEach((withdrawalDoc) => {
      const data =
        withdrawalDoc.data();

      withdrawalList.push({
        id: withdrawalDoc.id,

        userId:
          data.userId,

        userFullName:
          data.userFullName,

        userEmail:
          data.userEmail,

        amount: Number(
          data.amount || 0
        ),

        currency:
          data.currency || "NGN",

        bankName:
          data.bankName,

        accountNumber:
          data.accountNumber,

        accountHolderName:
          data.accountHolderName,

        reference:
          data.reference,

        status:
          data.status || "PENDING",

        createdAt:
          data.createdAt,

        reviewedAt:
          data.reviewedAt,

        reviewedBy:
          data.reviewedBy,

        paidAt:
          data.paidAt,

        paidBy:
          data.paidBy,

        paymentReference:
          data.paymentReference,

        rejectionReason:
          data.rejectionReason,
      });
    });

    setWithdrawals(
      withdrawalList
    );
  }

  async function loadWithdrawalPortalStatus() {
    const settingsRef = doc(
      db,
      "settings",
      "withdrawalPortal"
    );

    const snapshot =
      await getDoc(settingsRef);

    if (snapshot.exists()) {
      const data =
        snapshot.data();

      setWithdrawalPortalLocked(
        data.locked === true
      );
    } else {
      setWithdrawalPortalLocked(
        false
      );
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
      console.error(
        "Admin data loading error:",
        err
      );

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

  async function handleRefresh() {
    setMessage("");
    setError("");

    await loadAdminData();

    setMessage(
      "Admin data refreshed successfully."
    );
  }

  async function toggleWithdrawalPortal() {
    const newLockedState =
      !withdrawalPortalLocked;

    const actionText =
      newLockedState
        ? "lock"
        : "unlock";

    const confirmed =
      window.confirm(
        `Are you sure you want to ${actionText} the withdrawal portal?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setWithdrawalPortalLoading(
        true
      );

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
          locked:
            newLockedState,

          updatedAt:
            serverTimestamp(),

          updatedBy:
            "admin",
        },
        {
          merge: true,
        }
      );

      setWithdrawalPortalLocked(
        newLockedState
      );

      setMessage(
        newLockedState
          ? "Withdrawal portal has been LOCKED. Users cannot submit new withdrawal requests."
          : "Withdrawal portal has been UNLOCKED. Users can submit withdrawal requests again."
      );
    } catch (err) {
      console.error(
        "Withdrawal portal update error:",
        err
      );

      setError(
        "The withdrawal portal status could not be changed. Check your Firestore permissions."
      );
    } finally {
      setWithdrawalPortalLoading(
        false
      );
    }
            }  async function approveDeposit(
    deposit: Deposit
  ) {
    if (!deposit.userId) {
      setError(
        "This deposit does not have a valid user ID."
      );
      return;
    }

    const amount = Number(
      deposit.amount || 0
    );

    if (
      amount <
      MINIMUM_DEPOSIT
    ) {
      setError(
        `The minimum investment deposit is ${formatMoney(
          MINIMUM_DEPOSIT
        )}.`
      );
      return;
    }

    const status =
      normalizeStatus(
        deposit.status
      );

    if (
      status === "approved" ||
      status === "rejected"
    ) {
      setError(
        "This deposit has already been processed."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Approve this ${formatMoney(
          amount
        )} investment deposit?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        deposit.id
      );

      setError("");
      setMessage("");

      const investmentRef =
        doc(
          db,
          "investments",
          deposit.userId
        );

      const nextReturnAt =
        getInitialNextReturnAt();

      await setDoc(
        investmentRef,
        {
          status: "ACTIVE",

          investmentAmount:
            amount,

          principalAmount:
            amount,

          dailyReturn:
            DAILY_RETURN,

          totalReturns:
            0,

          cycleDays:
            CYCLE_DAYS,

          returnsProcessed:
            0,

          lastReturnDate:
            "",

          startedAt:
            serverTimestamp(),

          nextReturnAt:
            nextReturnAt,

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

      const depositRef =
        doc(
          db,
          "deposits",
          deposit.id
        );

      await updateDoc(
        depositRef,
        {
          status:
            "approved",

          approvedAt:
            serverTimestamp(),
        }
      );

      const userRef =
        doc(
          db,
          "users",
          deposit.userId
        );

      await setDoc(
        userRef,
        {
          investmentStatus:
            "ACTIVE",

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

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

  async function rejectDeposit(
    deposit: Deposit
  ) {
    const status =
      normalizeStatus(
        deposit.status
      );

    if (
      status === "approved" ||
      status === "rejected"
    ) {
      setError(
        "This deposit has already been processed."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to reject this deposit?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        deposit.id
      );

      setError("");
      setMessage("");

      const depositRef =
        doc(
          db,
          "deposits",
          deposit.id
        );

      await updateDoc(
        depositRef,
        {
          status:
            "rejected",

          rejectedAt:
            serverTimestamp(),
        }
      );

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

  async function approveWithdrawal(
    withdrawal: Withdrawal
  ) {
    const amount = Number(
      withdrawal.amount || 0
    );

    if (
      !withdrawal.userId
    ) {
      setError(
        "This withdrawal does not have a valid user ID."
      );
      return;
    }

    if (
      amount <
      MINIMUM_WITHDRAWAL
    ) {
      setError(
        `The minimum withdrawal is ${formatMoney(
          MINIMUM_WITHDRAWAL
        )}.`
      );
      return;
    }

    const status =
      normalizeStatus(
        withdrawal.status
      );

    if (
      status === "paid" ||
      status === "successful" ||
      status === "rejected"
    ) {
      setError(
        "This withdrawal has already been processed."
      );
      return;
    }

    const paymentReference =
      window.prompt(
        "Enter the payment reference (optional):",
        withdrawal.reference || ""
      );

    if (
      paymentReference === null
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Mark ${formatMoney(
          amount
        )} as paid and sent to ${withdrawal.accountHolderName || "the user"}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        withdrawal.id
      );

      setError("");
      setMessage("");

      const withdrawalRef =
        doc(
          db,
          "withdrawals",
          withdrawal.id
        );

      await updateDoc(
        withdrawalRef,
        {
          status:
            "paid",

          reviewedAt:
            serverTimestamp(),

          reviewedBy:
            "admin",

          paidAt:
            serverTimestamp(),

          paidBy:
            "admin",

          paymentReference:
            paymentReference.trim() ||
            null,
        }
      );

      setMessage(
        `Withdrawal of ${formatMoney(
          amount
        )} marked as paid successfully.`
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Approve withdrawal error:",
        err
      );

      setError(
        "The withdrawal could not be marked as paid. Check your Firestore permissions."
      );
    } finally {
      setProcessingId("");
    }
  }  async function rejectWithdrawal(
    withdrawal: Withdrawal
  ) {
    const status =
      normalizeStatus(
        withdrawal.status
      );

    if (
      status === "paid" ||
      status === "successful" ||
      status === "rejected"
    ) {
      setError(
        "This withdrawal has already been processed."
      );
      return;
    }

    const reason =
      window.prompt(
        "Enter a rejection reason (optional):",
        ""
      );

    if (reason === null) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to reject this withdrawal?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        withdrawal.id
      );

      setError("");
      setMessage("");

      const withdrawalRef =
        doc(
          db,
          "withdrawals",
          withdrawal.id
        );

      await updateDoc(
        withdrawalRef,
        {
          status:
            "rejected",

          reviewedAt:
            serverTimestamp(),

          reviewedBy:
            "admin",

          rejectionReason:
            reason.trim() ||
            null,
        }
      );

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

  async function updateInvestmentStatus(
    investment: Investment,
    status: "ACTIVE" | "INACTIVE"
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to mark this investment as ${status}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        investment.id
      );

      setError("");
      setMessage("");

      const investmentRef =
        doc(
          db,
          "investments",
          investment.id
        );

      await updateDoc(
        investmentRef,
        {
          status,

          updatedAt:
            serverTimestamp(),
        }
      );

      if (investment.userId) {
        const userRef =
          doc(
            db,
            "users",
            investment.userId
          );

        await setDoc(
          userRef,
          {
            investmentStatus:
              status,

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      }

      setMessage(
        `Investment status changed to ${status}.`
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Investment status update error:",
        err
      );

      setError(
        "Investment status could not be updated."
      );
    } finally {
      setProcessingId("");
    }
  }

  const pendingDeposits =
    useMemo(
      () =>
        deposits.filter(
          (deposit) =>
            normalizeStatus(
              deposit.status
            ) === "pending"
        ),
      [deposits]
    );

  const pendingWithdrawals =
    useMemo(
      () =>
        withdrawals.filter(
          (withdrawal) =>
            normalizeStatus(
              withdrawal.status
            ) === "pending"
        ),
      [withdrawals]
    );

  const activeInvestments =
    useMemo(
      () =>
        investments.filter(
          (investment) =>
            normalizeStatus(
              investment.status
            ) === "active"
        ),
      [investments]
    );

  const totalDeposited =
    useMemo(
      () =>
        deposits
          .filter(
            (deposit) =>
              normalizeStatus(
                deposit.status
              ) === "approved"
          )
          .reduce(
            (total, deposit) =>
              total +
              Number(
                deposit.amount || 0
              ),
            0
          ),
      [deposits]
    );

  const totalPaidWithdrawals =
    useMemo(
      () =>
        withdrawals
          .filter(
            (withdrawal) =>
              normalizeStatus(
                withdrawal.status
              ) === "paid"
          )
          .reduce(
            (total, withdrawal) =>
              total +
              Number(
                withdrawal.amount || 0
              ),
            0
          ),
      [withdrawals]
    );

  const totalInvestmentReturns =
    useMemo(
      () =>
        investments.reduce(
          (total, investment) =>
            total +
            Number(
              investment.totalReturns || 0
            ),
          0
        ),
      [investments]
    );

  const filteredUsers =
    useMemo(() => {
      const search =
        userSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return users;
      }

      return users.filter(
        (user) =>
          String(
            user.fullName || ""
          )
            .toLowerCase()
            .includes(search) ||
          String(
            user.email || ""
          )
            .toLowerCase()
            .includes(search) ||
          String(
            user.phone || ""
          )
            .toLowerCase()
            .includes(search) ||
          String(
            user.referralCode || ""
          )
            .toLowerCase()
            .includes(search) ||
          user.id
            .toLowerCase()
            .includes(search)
      );
    }, [users, userSearch]);

  function getUserById(
    userId?: string
  ) {
    if (!userId) {
      return undefined;
    }

    return users.find(
      (user) =>
        user.id === userId
    );
  }

  function getInvestmentByUserId(
    userId?: string
  ) {
    if (!userId) {
      return undefined;
    }

    return investments.find(
      (investment) =>
        investment.userId === userId ||
        investment.id === userId
    );
          }  if (!authenticated) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <div className="admin-logo">
            XS
          </div>

          <h1>
            XS Company Limited
          </h1>

          <p>
            Admin Dashboard
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleAdminLogin();
            }}
          >
            <label>
              Admin Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              placeholder="Enter admin password"
              autoComplete="current-password"
            />

            {passwordError && (
              <div className="admin-error">
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              className="admin-primary-button"
            >
              Access Admin Panel
            </button>
          </form>

          <Link
            to="/"
            className="admin-back-link"
          >
            Back to website
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <div className="admin-brand">
            XS
          </div>

          <div>
            <h1>
              XS Company Limited
            </h1>

            <span>
              Administration Panel
            </span>
          </div>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="admin-secondary-button"
          >
            {loading
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="admin-danger-button"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <button
            className={
              activeSection === "overview"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveSection(
                "overview"
              )
            }
          >
            Overview
          </button>

          <button
            className={
              activeSection === "users"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveSection(
                "users"
              )
            }
          >
            Users
          </button>

          <button
            className={
              activeSection === "deposits"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveSection(
                "deposits"
              )
            }
          >
            Deposits
            {pendingDeposits.length >
              0 && (
              <span className="admin-count">
                {pendingDeposits.length}
              </span>
            )}
          </button>

          <button
            className={
              activeSection ===
              "withdrawals"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveSection(
                "withdrawals"
              )
            }
          >
            Withdrawals
            {pendingWithdrawals.length >
              0 && (
              <span className="admin-count">
                {
                  pendingWithdrawals.length
                }
              </span>
            )}
          </button>

          <button
            className={
              activeSection ===
              "investments"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveSection(
                "investments"
              )
            }
          >
            Investments
          </button>

          <button
            className={
              activeSection ===
              "referrals"
                ? "admin-nav-button active"
                : "admin-nav-button"
            }
            onClick={() =>
              setActiveSection(
                "referrals"
              )
            }
          >
            Referrals
          </button>

          <div className="admin-sidebar-divider" />

          <Link
            to="/"
            className="admin-nav-link"
          >
            Main Website
          </Link>
        </aside>

        <main className="admin-main">
          {message && (
            <div className="admin-success-message">
              {message}
            </div>
          )}

          {error && (
            <div className="admin-error-message">
              {error}
            </div>
          )}

          {activeSection ===
            "overview" && (
            <section>
              <div className="admin-section-heading">
                <div>
                  <h2>
                    Dashboard Overview
                  </h2>

                  <p>
                    Monitor the XS platform.
                  </p>
                </div>
              </div>

              <div className="admin-stat-grid">
                <div className="admin-stat-card">
                  <span>
                    Total Users
                  </span>

                  <strong>
                    {users.length}
                  </strong>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Active Investments
                  </span>

                  <strong>
                    {
                      activeInvestments.length
                    }
                  </strong>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Approved Deposits
                  </span>

                  <strong>
                    {formatMoney(
                      totalDeposited
                    )}
                  </strong>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Paid Withdrawals
                  </span>

                  <strong>
                    {formatMoney(
                      totalPaidWithdrawals
                    )}
                  </strong>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Pending Deposits
                  </span>

                  <strong>
                    {
                      pendingDeposits.length
                    }
                  </strong>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Pending Withdrawals
                  </span>

                  <strong>
                    {
                      pendingWithdrawals.length
                    }
                  </strong>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <h3>
                      Withdrawal Portal
                    </h3>

                    <p>
                      Control whether users
                      can submit new
                      withdrawal requests.
                    </p>
                  </div>

                  <span
                    className={getStatusClass(
                      withdrawalPortalLocked
                        ? "inactive"
                        : "active"
                    )}
                  >
                    {withdrawalPortalLocked
                      ? "LOCKED"
                      : "OPEN"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={
                    toggleWithdrawalPortal
                  }
                  disabled={
                    withdrawalPortalLoading
                  }
                  className={
                    withdrawalPortalLocked
                      ? "admin-primary-button"
                      : "admin-danger-button"
                  }
                >
                  {withdrawalPortalLoading
                    ? "Updating..."
                    : withdrawalPortalLocked
                    ? "Unlock Withdrawal Portal"
                    : "Lock Withdrawal Portal"}
                </button>
              </div>

              <div className="admin-card">
                <h3>
                  Current Investment
                  Settings
                </h3>

                <div className="admin-info-grid">
                  <div>
                    <span>
                      Minimum Deposit
                    </span>

                    <strong>
                      {formatMoney(
                        MINIMUM_DEPOSIT
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Minimum Withdrawal
                    </span>

                    <strong>
                      {formatMoney(
                        MINIMUM_WITHDRAWAL
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Daily Return
                    </span>

                    <strong>
                      {formatMoney(
                        DAILY_RETURN
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Cycle
                    </span>

                    <strong>
                      {CYCLE_DAYS} days
                    </strong>
                  </div>

                  <div>
                    <span>
                      Cycle Return
                    </span>

                    <strong>
                      {formatMoney(
                        CYCLE_TOTAL_RETURN
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Recorded Returns
                    </span>

                    <strong>
                      {formatMoney(
                        totalInvestmentReturns
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </section>
          )}          {activeSection ===
            "users" && (
            <section>
              <div className="admin-section-heading">
                <div>
                  <h2>
                    Users
                  </h2>

                  <p>
                    View registered XS
                    users and their account
                    information.
                  </p>
                </div>
              </div>

              <div className="admin-search-box">
                <input
                  value={userSearch}
                  onChange={(event) =>
                    setUserSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search name, email, phone, referral code or user ID..."
                />
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        User
                      </th>

                      <th>
                        Email
                      </th>

                      <th>
                        Balance
                      </th>

                      <th>
                        Referrals
                      </th>

                      <th>
                        Investment
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map(
                      (user) => (
                        <tr
                          key={
                            user.id
                          }
                        >
                          <td>
                            <strong>
                              {user.fullName ||
                                "Unnamed User"}
                            </strong>

                            <small>
                              {user.id}
                            </small>
                          </td>

                          <td>
                            {user.email ||
                              "—"}
                          </td>

                          <td>
                            {formatMoney(
                              user.balance
                            )}
                          </td>

                          <td>
                            {Number(
                              user.referralCount ||
                                user.referredUsersCount ||
                                0
                            )}
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                user.investmentStatus
                              )}
                            >
                              {user.investmentStatus ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="admin-small-button"
                              onClick={() =>
                                setSelectedUser(
                                  user
                                )
                              }
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                {filteredUsers.length ===
                  0 && (
                  <div className="admin-empty">
                    No users found.
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="admin-modal-overlay">
                  <div className="admin-modal">
                    <div className="admin-modal-header">
                      <div>
                        <h3>
                          User Details
                        </h3>

                        <p>
                          {
                            selectedUser.fullName
                          }
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedUser(
                            null
                          )
                        }
                      >
                        ×
                      </button>
                    </div>

                    <div className="admin-detail-list">
                      <div>
                        <span>
                          User ID
                        </span>

                        <strong>
                          {
                            selectedUser.id
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Full Name
                        </span>

                        <strong>
                          {selectedUser.fullName ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Email
                        </span>

                        <strong>
                          {selectedUser.email ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Phone
                        </span>

                        <strong>
                          {selectedUser.phone ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Balance
                        </span>

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
                        <span>
                          Referral Code
                        </span>

                        <strong>
                          {selectedUser.referralCode ||
                            "—"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Referred By
                        </span>

                        <strong>
                          {selectedUser.referredBy ||
                            "—"}
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
                          Qualified Referrals
                        </span>

                        <strong>
                          {Number(
                            selectedUser.qualifiedReferrals ||
                              0
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Registration Date
                        </span>

                        <strong>
                          {formatDate(
                            selectedUser.createdAt
                          )}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={() =>
                        setSelectedUser(
                          null
                        )
                      }
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeSection ===
            "deposits" && (
            <section>
              <div className="admin-section-heading">
                <div>
                  <h2>
                    Deposit Requests
                  </h2>

                  <p>
                    Review and approve or
                    reject investment
                    deposits.
                  </p>
                </div>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        User
                      </th>

                      <th>
                        Sender Name
                      </th>

                      <th>
                        Amount
                      </th>

                      <th>
                        Type
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Created
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {deposits.map(
                      (deposit) => (
                        <tr
                          key={
                            deposit.id
                          }
                        >
                          <td>
                            {getUserById(
                              deposit.userId
                            )?.fullName ||
                              deposit.userId ||
                              "—"}
                          </td>

                          <td>
                            {deposit.senderName ||
                              "—"}
                          </td>

                          <td>
                            {formatMoney(
                              deposit.amount
                            )}
                          </td>

                          <td>
                            {deposit.type ||
                              "investment"}
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                deposit.status
                              )}
                            >
                              {deposit.status ||
                                "pending"}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              deposit.createdAt
                            )}
                          </td>

                          <td>
                            {normalizeStatus(
                              deposit.status
                            ) ===
                              "pending" && (
                              <div className="admin-action-group">
                                <button
                                  type="button"
                                  className="admin-small-button success"
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
                                    ? "..."
                                    : "Approve"}
                                </button>

                                <button
                                  type="button"
                                  className="admin-small-button danger"
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
                            )}

                            {normalizeStatus(
                              deposit.status
                            ) !==
                              "pending" && (
                              <span>
                                Processed
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                {deposits.length ===
                  0 && (
                  <div className="admin-empty">
                    No deposit requests
                    found.
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection ===
            "withdrawals" && (
            <section>
              <div className="admin-section-heading">
                <div>
                  <h2>
                    Withdrawal Requests
                  </h2>

                  <p>
                    Review withdrawal
                    requests and mark
                    completed payments.
                  </p>
                </div>

                <span
                  className={getStatusClass(
                    withdrawalPortalLocked
                      ? "inactive"
                      : "active"
                  )}
                >
                  Portal:{" "}
                  {withdrawalPortalLocked
                    ? "LOCKED"
                    : "OPEN"}
                </span>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        User
                      </th>

                      <th>
                        Amount
                      </th>

                      <th>
                        Bank
                      </th>

                      <th>
                        Account
                      </th>

                      <th>
                        Holder
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Created
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {withdrawals.map(
                      (
                        withdrawal
                      ) => (
                        <tr
                          key={
                            withdrawal.id
                          }
                        >
                          <td>
                            <strong>
                              {withdrawal.userFullName ||
                                getUserById(
                                  withdrawal.userId
                                )?.fullName ||
                                "—"}
                            </strong>

                            <small>
                              {withdrawal.userEmail ||
                                ""}
                            </small>
                          </td>

                          <td>
                            {formatMoney(
                              withdrawal.amount
                            )}
                          </td>

                          <td>
                            {withdrawal.bankName ||
                              "—"}
                          </td>

                          <td>
                            {withdrawal.accountNumber ||
                              "—"}
                          </td>

                          <td>
                            {withdrawal.accountHolderName ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={getStatusClass(
                                withdrawal.status
                              )}
                            >
                              {withdrawal.status ||
                                "PENDING"}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              withdrawal.createdAt
                            )}
                          </td>

                          <td>
                            {normalizeStatus(
                              withdrawal.status
                            ) ===
                              "pending" && (
                              <div className="admin-action-group">
                                <button
                                  type="button"
                                  className="admin-small-button success"
                                  disabled={
                                    processingId ===
                                    withdrawal.id
                                  }
                                  onClick={() =>
                                    approveWithdrawal(
                                      withdrawal
                                    )
                                  }
                                >
                                  {processingId ===
                                  withdrawal.id
                                    ? "..."
                                    : "Mark Paid"}
                                </button>

                                <button
                                  type="button"
                                  className="admin-small-button danger"
                                  disabled={
                                    processingId ===
                                    withdrawal.id
                                  }
                                  onClick={() =>
                                    rejectWithdrawal(
                                      withdrawal
                                  )
                                  }
                                >
                                  Reject
                                </button>
                              </div>
                            )}

                            {normalizeStatus(
                              withdrawal.status
                            ) ===
                              "paid" && (
                              <span>
                                Payment Sent
                              </span>
                            )}

                            {normalizeStatus(
                              withdrawal.status
                            ) ===
                              "rejected" && (
                              <span>
                                Rejected
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                {withdrawals.length ===
                  0 && (
                  <div className="admin-empty">
                    No withdrawal requests
                    found.
                  </div>
                )}
              </div>
            </section>
          )}          {activeSection ===
            "investments" && (
            <section>
              <div className="admin-section-heading">
                <div>
                  <h2>
                    Investments
                  </h2>

                  <p>
                    Monitor active
                    investments and
                    processed returns.
                  </p>
                </div>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        User
                      </th>

                      <th>
                        Principal
                      </th>

                      <th>
                        Daily Return
                      </th>

                      <th>
                        Returns
                      </th>

                      <th>
                        Processed
                      </th>

                      <th>
                        Next Return
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {investments.map(
                      (
                        investment
                      ) => {
                        const user =
                          getUserById(
                            investment.userId
                          );

                        return (
                          <tr
                            key={
                              investment.id
                            }
                          >
                            <td>
                              {user?.fullName ||
                                investment.userId ||
                                investment.id}
                            </td>

                            <td>
                              {formatMoney(
                                investment.principalAmount ??
                                  investment.investmentAmount
                              )}
                            </td>

                            <td>
                              {formatMoney(
                                investment.dailyReturn
                              )}
                            </td>

                            <td>
                              {formatMoney(
                                investment.totalReturns
                              )}
                            </td>

                            <td>
                              {Number(
                                investment.returnsProcessed ||
                                  0
                              )}
                            </td>

                            <td>
                              {formatDate(
                                investment.nextReturnAt
                              )}
                            </td>

                            <td>
                              <span
                                className={getStatusClass(
                                  investment.status
                                )}
                              >
                                {investment.status ||
                                  "—"}
                              </span>
                            </td>

                            <td>
                              {normalizeStatus(
                                investment.status
                              ) ===
                                "active" ? (
                                <button
                                  type="button"
                                  className="admin-small-button danger"
                                  disabled={
                                    processingId ===
                                    investment.id
                                  }
                                  onClick={() =>
                                    updateInvestmentStatus(
                                      investment,
                                      "INACTIVE"
                                    )
                                  }
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="admin-small-button success"
                                  disabled={
                                    processingId ===
                                    investment.id
                                  }
                                  onClick={() =>
                                    updateInvestmentStatus(
                                      investment,
                                      "ACTIVE"
                                    )
                                  }
                                >
                                  Activate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>

                {investments.length ===
                  0 && (
                  <div className="admin-empty">
                    No investment records
                    found.
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection ===
            "referrals" && (
            <section>
              <div className="admin-section-heading">
                <div>
                  <h2>
                    Referral System
                  </h2>

                  <p>
                    View referral codes,
                    referral counts and
                    referral earnings.
                  </p>
                </div>
              </div>

              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        User
                      </th>

                      <th>
                        Referral Code
                      </th>

                      <th>
                        Referred By
                      </th>

                      <th>
                        Referrals
                      </th>

                      <th>
                        Qualified
                      </th>

                      <th>
                        Earnings
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {users.map(
                      (user) => (
                        <tr
                          key={
                            user.id
                          }
                        >
                          <td>
                            <strong>
                              {user.fullName ||
                                "Unnamed User"}
                            </strong>

                            <small>
                              {user.email ||
                                ""}
                            </small>
                          </td>

                          <td>
                            {user.referralCode ||
                              "—"}
                          </td>

                          <td>
                            {user.referredBy ||
                              "—"}
                          </td>

                          <td>
                            {Number(
                              user.referralCount ??
                                user.referredUsersCount ??
                                0
                            )}
                          </td>

                          <td>
                            {Number(
                              user.qualifiedReferrals ||
                                0
                            )}
                          </td>

                          <td>
                            {formatMoney(
                              user.referralEarnings
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                {users.length ===
                  0 && (
                  <div className="admin-empty">
                    No referral data
                    found.
                  </div>
                )}
              </div>
            </section>
          )}

          {loading && (
            <div className="admin-loading-overlay">
              <div className="admin-loading-box">
                Loading admin data...
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
                              }
