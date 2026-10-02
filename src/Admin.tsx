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
    normalized === "active"
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

  /*
   * ============================================================
   * ADMIN AUTHENTICATION
   * ============================================================
   */

  const [authenticated, setAuthenticated] =
    useState(false);

  const [password, setPassword] = useState("");

  const [passwordError, setPasswordError] =
    useState("");

  /*
   * ============================================================
   * ADMIN DATA
   * ============================================================
   */

  const [deposits, setDeposits] =
    useState<Deposit[]>([]);

  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [users, setUsers] =
    useState<UserRecord[]>([]);

  const [investments, setInvestments] =
    useState<Investment[]>([]);

  /*
   * ============================================================
   * UI STATE
   * ============================================================
   */

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

  /*
   * ============================================================
   * WITHDRAWAL PORTAL CONTROL
   * ============================================================
   *
   * settings/withdrawalPortal
   *
   * {
   *   locked: true/false,
   *   updatedAt: timestamp,
   *   updatedBy: "admin"
   * }
   *
   * When locked, Withdraw.tsx will prevent users from
   * creating new withdrawal requests.
   */

  const [
    withdrawalPortalLocked,
    setWithdrawalPortalLocked,
  ] = useState(false);

  const [
    withdrawalPortalLoading,
    setWithdrawalPortalLoading,
  ] = useState(false);

  /*
   * ============================================================
   * ADMIN LOGIN SESSION
   * ============================================================
   */

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

  /*
   * ============================================================
   * LOAD USERS
   * ============================================================
   */

  async function loadUsers() {
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

    setUsers(userList);
  }

  /*
   * ============================================================
   * LOAD INVESTMENTS
   * ============================================================
   */

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

  /*
   * ============================================================
   * LOAD DEPOSITS
   * ============================================================
   */

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

  /*
   * ============================================================
   * LOAD WITHDRAWALS
   * ============================================================
   */

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

  /*
   * ============================================================
   * LOAD WITHDRAWAL PORTAL STATUS
   * ============================================================
   */

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

  /*
   * ============================================================
   * LOAD ALL ADMIN DATA
   * ============================================================
   */

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

  /*
   * ============================================================
   * REFRESH
   * ============================================================
   */

  async function handleRefresh() {
    setMessage("");
    setError("");

    await loadAdminData();

    setMessage(
      "Admin data refreshed successfully."
    );
  }

  /*
   * ============================================================
   * WITHDRAWAL PORTAL LOCK / UNLOCK
   * ============================================================
   */

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

      if (newLockedState) {
        setMessage(
          "Withdrawal portal has been LOCKED. Users cannot submit new withdrawal requests."
        );
      } else {
        setMessage(
          "Withdrawal portal has been UNLOCKED. Users can submit withdrawal requests again."
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
      setWithdrawalPortalLoading(
        false
      );
    }
  }

  /*
   * ============================================================
   * APPROVE DEPOSIT
   * ============================================================
   *
   * Approval:
   *
   * deposits/{depositId}
   *        status = approved
   *
   * investments/{userId}
   *        status = ACTIVE
   *        investmentAmount = deposit amount
   *        principalAmount = deposit amount
   *        dailyReturn = 200
   *        cycleDays = 3
   *        totalReturns = 0
   *        returnsProcessed = 0
   *        nextReturnAt = next Nigerian midnight
   *
   * The actual daily return is handled by returnLogic.ts
   * when the user opens the Investment page.
   */

  async function approveDeposit(
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

      /*
       * Keep the user's investmentStatus
       * synchronized if that field exists
       * in the rest of the application.
       */

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

  /*
   * ============================================================
   * REJECT DEPOSIT
   * ============================================================
   */

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
}  /*
   * ============================================================
   * PROCESS / PAY WITHDRAWAL
   * ============================================================
   *
   * IMPORTANT:
   * This function marks the withdrawal as PAID after the
   * administrator confirms that the money has actually been sent.
   *
   * It does NOT deduct the user's balance here.
   *
   * The withdrawal request flow should already handle the
   * user's available balance when the request is created.
   *
   * This prevents the same withdrawal from being deducted twice.
   */

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
      String(
        withdrawal.status || ""
      ).toUpperCase();

    if (status !== "PENDING") {
      setError(
        "This withdrawal has already been processed."
      );
      return;
    }

    /*
     * The admin must provide the actual payment
     * reference before marking the withdrawal paid.
     */

    const paymentReference =
      window.prompt(
        "Enter the payment reference used for this withdrawal:"
      );

    if (
      !paymentReference ||
      !paymentReference.trim()
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Confirm that ${formatMoney(
          amount
        )} has actually been sent to ${
          withdrawal.accountHolderName ||
          withdrawal.userFullName ||
          "the user"
        }?`
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
            "PAID",

          reviewedAt:
            serverTimestamp(),

          reviewedBy:
            "admin",

          paidAt:
            serverTimestamp(),

          paidBy:
            "admin",

          paymentReference:
            paymentReference.trim(),
        }
      );

      setMessage(
        `Withdrawal marked as PAID. Payment reference: ${paymentReference.trim()}`
      );

      await loadAdminData();
    } catch (err) {
      console.error(
        "Process withdrawal error:",
        err
      );

      setError(
        "The withdrawal could not be marked as paid. Check your Firestore permissions."
      );
    } finally {
      setProcessingId("");
    }
  }

  /*
   * ============================================================
   * REJECT WITHDRAWAL
   * ============================================================
   */

  async function rejectWithdrawal(
    withdrawal: Withdrawal
  ) {
    const status =
      String(
        withdrawal.status || ""
      ).toUpperCase();

    if (status !== "PENDING") {
      setError(
        "This withdrawal has already been processed."
      );
      return;
    }

    const reason =
      window.prompt(
        "Enter the reason for rejecting this withdrawal:"
      );

    if (
      !reason ||
      !reason.trim()
    ) {
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
            "REJECTED",

          reviewedAt:
            serverTimestamp(),

          reviewedBy:
            "admin",

          rejectionReason:
            reason.trim(),
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

  /*
   * ============================================================
   * USER / INVESTMENT HELPERS
   * ============================================================
   */

  function getUserInvestment(
    userId: string
  ) {
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
      );
  }

  function getUserDepositCount(
    userId: string
  ) {
    return deposits.filter(
      (deposit) =>
        deposit.userId === userId &&
        normalizeStatus(
          deposit.status
        ) === "approved"
    ).length;
  }

  function getUserWithdrawalTotal(
    userId: string
  ) {
    return withdrawals
      .filter(
        (withdrawal) =>
          withdrawal.userId === userId &&
          String(
            withdrawal.status || ""
          ).toUpperCase() === "PAID"
      )
      .reduce(
        (total, withdrawal) =>
          total +
          Number(
            withdrawal.amount || 0
          ),
        0
      );
  }

  function getUserPendingWithdrawals(
    userId: string
  ) {
    return withdrawals
      .filter(
        (withdrawal) =>
          withdrawal.userId === userId &&
          String(
            withdrawal.status || ""
          ).toUpperCase() === "PENDING"
      )
      .reduce(
        (total, withdrawal) =>
          total +
          Number(
            withdrawal.amount || 0
          ),
        0
      );
  }

  function getUserTotalReturns(
    userId: string
  ) {
    const investment =
      getUserInvestment(userId);

    return Number(
      investment?.totalReturns || 0
    );
  }

  /*
   * ============================================================
   * USER SEARCH
   * ============================================================
   */

  const filteredUsers = useMemo(() => {
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

  /*
   * ============================================================
   * DASHBOARD STATISTICS
   * ============================================================
   */

  const totalUsers =
    users.length;

  const totalDeposits =
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
      );

  const totalWithdrawals =
    withdrawals
      .filter(
        (withdrawal) =>
          String(
            withdrawal.status || ""
          ).toUpperCase() === "PAID"
      )
      .reduce(
        (total, withdrawal) =>
          total +
          Number(
            withdrawal.amount || 0
          ),
        0
      );

  const pendingDeposits =
    deposits.filter(
      (deposit) =>
        normalizeStatus(
          deposit.status
        ) === "pending"
    );

  const pendingWithdrawals =
    withdrawals.filter(
      (withdrawal) =>
        String(
          withdrawal.status || ""
        ).toUpperCase() ===
        "PENDING"
    );

  const activeInvestments =
    investments.filter(
      (investment) =>
        normalizeStatus(
          investment.status
        ) === "active"
    );

  const totalReferralEarnings =
    users.reduce(
      (total, user) =>
        total +
        Number(
          user.referralEarnings || 0
        ),
      0
    );

  /*
   * ============================================================
   * SELECT USER
   * ============================================================
   */

  function openUser(
    user: UserRecord
  ) {
    setSelectedUser(user);
  }

  function closeUser() {
    setSelectedUser(null);
  }

  /*
   * ============================================================
   * LOGOUT
   * ============================================================
   */

  async function handleLogout() {
    sessionStorage.removeItem(
      "xs_admin_authenticated"
    );

    try {
      await signOut(auth);
    } catch {
      /*
       * The admin password session is independent
       * of Firebase authentication, so even if Firebase
       * sign-out fails, the admin session is still cleared.
       */
    }

    setAuthenticated(false);

    navigate("/");
  }

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   */

  function changeSection(
    section: AdminSection
  ) {
    setActiveSection(section);
    setSelectedUser(null);
    setMessage("");
    setError("");
  }

  /*
   * ============================================================
   * ADMIN LOGIN SCREEN
   * ============================================================
   */

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

            <h1>
              Admin Panel
            </h1>

            <p>
              Enter the administrator
              password to continue.
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
                    event.key ===
                    "Enter"
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
              onClick={
                handleAdminLogin
              }
            >
              Enter Admin Panel
            </button>

            <Link
              to="/"
              className="admin-back-link"
            >
              Back to XS
            </Link>
          </section>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * USER DETAIL VIEW
   * ============================================================
   */

  if (
    activeSection === "users" &&
    selectedUser
  ) {
    const investment =
      getUserInvestment(
        selectedUser.id
      );

    const userDeposits =
      deposits.filter(
        (deposit) =>
          deposit.userId ===
          selectedUser.id
      );

    const userWithdrawals =
      withdrawals.filter(
        (withdrawal) =>
          withdrawal.userId ===
          selectedUser.id
      );

    return (
      <main className="admin-page">
        <div className="admin-layout">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-brand">
              <span className="brand-x">
                X
              </span>

              <span className="brand-s">
                S
              </span>

              <span>
                Admin
              </span>
            </div>

            <nav className="admin-nav">
              <button
                type="button"
                onClick={() =>
                  changeSection(
                    "overview"
                  )
                }
              >
                Dashboard
              </button>

              <button
                type="button"
                className="active"
                onClick={() =>
                  changeSection(
                    "users"
                  )
                }
              >
                Users
              </button>

              <button
                type="button"
                onClick={() =>
                  changeSection(
                    "deposits"
                  )
                }
              >
                Deposits
              </button>

              <button
                type="button"
                onClick={() =>
                  changeSection(
                    "withdrawals"
                  )
                }
              >
                Withdrawals
              </button>

              <button
                type="button"
                onClick={() =>
                  changeSection(
                    "investments"
                  )
                }
              >
                Investments
              </button>

              <button
                type="button"
                onClick={() =>
                  changeSection(
                    "referrals"
                  )
                }
              >
                Referrals
              </button>
            </nav>

            <div className="admin-sidebar-bottom">
              <button
                type="button"
                onClick={
                  handleLogout
                }
              >
                Logout
              </button>
            </div>
          </aside>

          <section className="admin-content">
            <header className="admin-header">
              <div>
                <button
                  type="button"
                  className="admin-back-button"
                  onClick={
                    closeUser
                  }
                >
                  ← Back to Users
                </button>

                <p className="dashboard-eyebrow">
                  XS COMPANY LIMITED
                </p>

                <h1>
                  User Details
                </h1>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  handleRefresh
                }
              >
                Refresh
              </button>
            </header>

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

            <section className="admin-user-profile-card">
              <div>
                <div className="admin-avatar">
                  {(
                    selectedUser.fullName ||
                    "U"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </div>
              </div>

              <div className="admin-user-main-info">
                <h2>
                  {selectedUser.fullName ||
                    "Unnamed User"}
                </h2>

                <p>
                  {selectedUser.email ||
                    "No email"}
                </p>

                <p>
                  {selectedUser.phone ||
                    "No phone number"}
                </p>

                <span
                  className={`status-badge ${getStatusClass(
                    selectedUser.investmentStatus
                  )}`}
                >
                  {selectedUser.investmentStatus ||
                    "ACTIVE"}
                </span>
              </div>
            </section>

            <section className="admin-stats-grid">
              <div className="admin-stat-card">
                <span>
                  Available Balance
                </span>

                <strong>
                  {formatMoney(
                    selectedUser.availableBalance ??
                      selectedUser.balance
                  )}
                </strong>
              </div>

              <div className="admin-stat-card">
                <span>
                  Total Deposited
                </span>

                <strong>
                  {formatMoney(
                    getUserTotalDeposited(
                      selectedUser.id
                    )
                  )}
                </strong>
              </div>

              <div className="admin-stat-card">
                <span>
                  Total Returns
                </span>

                <strong>
                  {formatMoney(
                    getUserTotalReturns(
                      selectedUser.id
                    )
                  )}
                </strong>
              </div>

              <div className="admin-stat-card">
                <span>
                  Total Withdrawn
                </span>

                <strong>
                  {formatMoney(
                    getUserWithdrawalTotal(
                      selectedUser.id
                    )
                  )}
                </strong>
              </div>

              <div className="admin-stat-card">
                <span>
                  Pending Withdrawals
                </span>

                <strong>
                  {formatMoney(
                    getUserPendingWithdrawals(
                      selectedUser.id
                    )
                  )}
                </strong>
              </div>

              <div className="admin-stat-card">
                <span>
                  Referral Earnings
                </span>

                <strong>
                  {formatMoney(
                    selectedUser.referralEarnings
                  )}
                </strong>
              </div>
            </section>

            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <h2>
                    Investment
                  </h2>

                  <p>
                    Current investment
                    information for this
                    user.
                  </p>
                </div>
              </div>

              {investment ? (
    /*
   * ============================================================
   * MAIN ADMIN DASHBOARD
   * ============================================================
   */

  return (
    <main className="admin-page">
      <div className="admin-layout">
        {/* ======================================================
            SIDEBAR
        ====================================================== */}

        <aside className="admin-sidebar">
          <div className="admin-sidebar-brand">
            <div className="admin-logo">
              <span className="brand-x">
                X
              </span>

              <span className="brand-s">
                S
              </span>
            </div>

            <div>
              <strong>
                XS
              </strong>

              <span>
                Admin
              </span>
            </div>
          </div>

          <nav className="admin-nav">
            <button
              type="button"
              className={
                activeSection === "overview"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeSection(
                  "overview"
                )
              }
            >
              <span>
                Dashboard
              </span>
            </button>

            <button
              type="button"
              className={
                activeSection === "users"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeSection(
                  "users"
                )
              }
            >
              <span>
                Users
              </span>

              <small>
                {totalUsers}
              </small>
            </button>

            <button
              type="button"
              className={
                activeSection === "deposits"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeSection(
                  "deposits"
                )
              }
            >
              <span>
                Deposits
              </span>

              {pendingDeposits.length >
                0 && (
                <small>
                  {pendingDeposits.length}
                </small>
              )}
            </button>

            <button
              type="button"
              className={
                activeSection ===
                "withdrawals"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeSection(
                  "withdrawals"
                )
              }
            >
              <span>
                Withdrawals
              </span>

              {pendingWithdrawals.length >
                0 && (
                <small>
                  {pendingWithdrawals.length}
                </small>
              )}
            </button>

            <button
              type="button"
              className={
                activeSection ===
                "investments"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeSection(
                  "investments"
                )
              }
            >
              <span>
                Investments
              </span>
            </button>

            <button
              type="button"
              className={
                activeSection ===
                "referrals"
                  ? "active"
                  : ""
              }
              onClick={() =>
                changeSection(
                  "referrals"
                )
              }
            >
              <span>
                Referrals
              </span>
            </button>
          </nav>

          <div className="admin-sidebar-bottom">
            <Link
              to="/dashboard"
              className="admin-sidebar-link"
            >
              User Dashboard
            </Link>

            <button
              type="button"
              onClick={
                handleLogout
              }
            >
              Logout
            </button>
          </div>
        </aside>

        {/* ======================================================
            MAIN CONTENT
        ====================================================== */}

        <section className="admin-content">
          {/* ====================================================
              HEADER
          ==================================================== */}

          <header className="admin-header">
            <div>
              <p className="dashboard-eyebrow">
                XS COMPANY LIMITED
              </p>

              <h1>
                Admin Dashboard
              </h1>

              <p className="admin-header-subtitle">
                Manage users, investments,
                deposits, withdrawals and
                referrals.
              </p>
            </div>

            <div className="admin-header-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={
                  handleRefresh
                }
                disabled={loading}
              >
                {loading
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>
          </header>

          {/* ====================================================
              GLOBAL MESSAGES
          ==================================================== */}

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

          {/* ====================================================
              WITHDRAWAL PORTAL CONTROL
          ==================================================== */}

          <section className="admin-withdrawal-control">
            <div>
              <p className="dashboard-eyebrow">
                WITHDRAWAL CONTROL
              </p>

              <h2>
                Withdrawal Portal
              </h2>

              <p>
                Control whether users are
                currently allowed to submit
                new withdrawal requests.
              </p>
            </div>

            <div className="admin-withdrawal-control-right">
              <div
                className={
                  withdrawalPortalLocked
                    ? "portal-status locked"
                    : "portal-status open"
                }
              >
                <span
                  className="portal-status-dot"
                />

                <strong>
                  {withdrawalPortalLocked
                    ? "LOCKED"
                    : "OPEN"}
                </strong>
              </div>

              <button
                type="button"
                className={
                  withdrawalPortalLocked
                    ? "primary-button"
                    : "danger-button"
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
                  ? "Unlock Withdrawals"
                  : "Lock Withdrawals"}
              </button>
            </div>
          </section>

          {/* ====================================================
              OVERVIEW
          ==================================================== */}

          {activeSection ===
            "overview" && (
            <>
              <section className="admin-stats-grid">
                <div className="admin-stat-card">
                  <span>
                    Total Users
                  </span>

                  <strong>
                    {totalUsers}
                  </strong>

                  <small>
                    Registered accounts
                  </small>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Total Deposited
                  </span>

                  <strong>
                    {formatMoney(
                      totalDeposits
                    )}
                  </strong>

                  <small>
                    Approved deposits
                  </small>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Total Withdrawn
                  </span>

                  <strong>
                    {formatMoney(
                      totalWithdrawals
                    )}
                  </strong>

                  <small>
                    Completed payments
                  </small>
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

                  <small>
                    Currently active
                  </small>
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

                  <small>
                    Awaiting approval
                  </small>
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

                  <small>
                    Awaiting payment
                  </small>
                </div>
              </section>

              {/* ================================================
                  QUICK ACTIONS
              ================================================= */}

              <section className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <p className="dashboard-eyebrow">
                      QUICK ACTIONS
                    </p>

                    <h2>
                      Manage XS
                    </h2>
                  </div>
                </div>

                <div className="admin-quick-actions">
                  <button
                    type="button"
                    onClick={() =>
                      changeSection(
                        "deposits"
                      )
                    }
                  >
                    <strong>
                      Review Deposits
                    </strong>

                    <span>
                      {
                        pendingDeposits.length
                      }{" "}
                      pending
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changeSection(
                        "withdrawals"
                      )
                    }
                  >
                    <strong>
                      Review Withdrawals
                    </strong>

                    <span>
                      {
                        pendingWithdrawals.length
                      }{" "}
                      pending
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changeSection(
                        "users"
                      )
                    }
                  >
                    <strong>
                      View Users
                    </strong>

                    <span>
                      {totalUsers} users
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changeSection(
                        "investments"
                      )
                    }
                  >
                    <strong>
                      View Investments
                    </strong>

                    <span>
                      {
                        activeInvestments.length
                      }{" "}
                      active
                    </span>
                  </button>
                </div>
              </section>

              {/* ================================================
                  PENDING DEPOSITS PREVIEW
              ================================================= */}

              <section className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <h2>
                      Pending Deposits
                    </h2>

                    <p>
                      Deposits waiting for
                      administrator approval.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      changeSection(
                        "deposits"
                      )
                    }
                  >
                    View All
                  </button>
                </div>

                {pendingDeposits.length ===
                0 ? (
                  <div className="admin-empty-state">
                    There are no pending
                    deposits.
                  </div>
                ) : (
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
                            Date
                          </th>

                          <th>
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {pendingDeposits
                          .slice(0, 5)
                          .map(
                            (
                              deposit
                            ) => (
                              <tr
                                key={
                                  deposit.id
                                }
                              >
                                <td>
                                  {deposit.userId ||
                                    "—"}
                                </td>

                                <td>
                                  {deposit.senderName ||
                                    "—"}
                                </td>

                                <td>
                                  <strong>
                                    {formatMoney(
                                      deposit.amount
                                    )}
                                  </strong>
                                </td>

                                <td>
                                  {formatDate(
                                    deposit.createdAt
                                  )}
                                </td>

                                <td>
                                  <div className="admin-action-group">
                                    <button
                                      type="button"
                                      className="success-button"
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
                                        : "Approve"}
                                    </button>

                                    <button
                                      type="button"
                                      className="danger-button"
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
                                </td>
                              </tr>
                            )
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ================================================
                  PENDING WITHDRAWALS PREVIEW
              ================================================= */}

              <section className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <h2>
                      Pending Withdrawals
                    </h2>

                    <p>
                      Withdrawal requests
                      awaiting payment.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      changeSection(
                        "withdrawals"
                      )
                    }
                  >
                    View All
                  </button>
                </div>

                {pendingWithdrawals.length ===
                0 ? (
                  <div className="admin-empty-state">
                    There are no pending
                    withdrawals.
                  </div>
                ) : (
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
                                      <th>
                            Bank
                          </th>

                          <th>
                            Account
                          </th>

                          <th>
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {pendingWithdrawals
                          .slice(0, 5)
                          .map(
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
                                      "Unknown User"}
                                  </strong>

                                  <small>
                                    {withdrawal.userEmail ||
                                      "—"}
                                  </small>
                                </td>

                                <td>
                                  <strong>
                                    {formatMoney(
                                      withdrawal.amount
                                    )}
                                  </strong>
                                </td>

                                <td>
                                  {withdrawal.bankName ||
                                    "—"}
                                </td>

                                <td>
                                  <strong>
                                    {withdrawal.accountNumber ||
                                      "—"}
                                  </strong>

                                  <small>
                                    {withdrawal.accountHolderName ||
                                      "—"}
                                  </small>
                                </td>

                                <td>
                                  <div className="admin-action-group">
                                    <button
                                      type="button"
                                      className="success-button"
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
                                        : "Mark Paid"}
                                    </button>

                                    <button
                                      type="button"
                                      className="danger-button"
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
                                </td>
                              </tr>
                            )
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {/* ====================================================
              USERS
          ==================================================== */}

          {activeSection ===
            "users" && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="dashboard-eyebrow">
                    USER MANAGEMENT
                  </p>

                  <h2>
                    All Users
                  </h2>

                  <p>
                    View user accounts,
                    balances, investments and
                    referral information.
                  </p>
                </div>

                <div className="admin-search">
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(event) =>
                      setUserSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search name, email, phone or referral code..."
                  />
                </div>
              </div>

              {filteredUsers.length ===
              0 ? (
                <div className="admin-empty-state">
                  No users match your
                  search.
                </div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>
                          User
                        </th>

                        <th>
                          Balance
                        </th>

                        <th>
                          Deposited
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
                        (user) => {
                          const investment =
                            getUserInvestment(
                              user.id
                            );

                          return (
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
                                    "No email"}
                                </small>
                              </td>

                              <td>
                                {formatMoney(
                                  user.availableBalance ??
                                    user.balance
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  getUserTotalDeposited(
                                    user.id
                                  )
                                )}
                              </td>

                              <td>
                                {user.referralCount ??
                                  user.referredUsersCount ??
                                  0}
                              </td>

                              <td>
                                <span
                                  className={`status-badge ${getStatusClass(
                                    investment?.status
                                  )}`}
                                >
                                  {investment?.status ||
                                    "None"}
                                </span>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                    openUser(
                                      user
                                    )
                                  }
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ====================================================
              DEPOSITS
          ==================================================== */}

          {activeSection ===
            "deposits" && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="dashboard-eyebrow">
                    DEPOSIT MANAGEMENT
                  </p>

                  <h2>
                    Deposits
                  </h2>

                  <p>
                    Review and process user
                    investment deposits.
                  </p>
                </div>
              </div>

              {deposits.length ===
              0 ? (
                <div className="admin-empty-state">
                  No deposits found.
                </div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>
                          Date
                        </th>

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
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {deposits.map(
                        (deposit) => {
                          const status =
                            normalizeStatus(
                              deposit.status
                            );

                          const isPending =
                            status ===
                            "pending";

                          return (
                            <tr
                              key={
                                deposit.id
                              }
                            >
                              <td>
                                {formatDate(
                                  deposit.createdAt
                                )}
                              </td>

                              <td>
                                <strong>
                                  {deposit.userId ||
                                    "—"}
                                </strong>
                              </td>

                              <td>
                                {deposit.senderName ||
                                  "—"}
                              </td>

                              <td>
                                <strong>
                                  {formatMoney(
                                    deposit.amount
                                  )}
                                </strong>
                              </td>

                              <td>
                                {deposit.type ||
                                  "investment"}
                              </td>

                              <td>
                                <span
                                  className={`status-badge ${getStatusClass(
                                    deposit.status
                                  )}`}
                                >
                                  {deposit.status ||
                                    "—"}
                                </span>
                              </td>

                              <td>
                                {isPending ? (
                                  <div className="admin-action-group">
                                    <button
                                      type="button"
                                      className="success-button"
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
                                        : "Approve"}
                                    </button>

                                    <button
                                      type="button"
                                      className="danger-button"
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
                                ) : (
                                  <span>
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ====================================================
              WITHDRAWALS
          ==================================================== */}

          {activeSection ===
            "withdrawals" && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="dashboard-eyebrow">
                    WITHDRAWAL MANAGEMENT
                  </p>

                  <h2>
                    Withdrawals
                  </h2>

                  <p>
                    Review, pay or reject
                    withdrawal requests.
                  </p>
                </div>

                <div
                  className={
                    withdrawalPortalLocked
                      ? "portal-status locked"
                      : "portal-status open"
                  }
                >
                  <span className="portal-status-dot" />

                  <strong>
                    Portal{" "}
                    {withdrawalPortalLocked
                      ? "Locked"
                      : "Open"}
                  </strong>
                </div>
              </div>

              {withdrawals.length ===
              0 ? (
                <div className="admin-empty-state">
                  No withdrawal requests
                  found.
                </div>
              ) : (
                <div className="admin-table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>
                          Date
                        </th>

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
                          Status
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
                        ) => {
                          const isPending =
                            String(
                              withdrawal.status ||
                                ""
                            ).toUpperCase() ===
                            "PENDING";

                          return (
                            <tr
                              key={
                                withdrawal.id
                              }
                            >
                              <td>
                                {formatDate(
                                  withdrawal.createdAt
                                )}
                              </td>

                              <td>
                                <strong>
                                  {withdrawal.userFullName ||
                                    "Unknown User"}
                                </strong>

                                <small>
                                  {withdrawal.userEmail ||
                                    "—"}
                                </small>
                              </td>

                              <td>
                                <strong>
                                  {formatMoney(
                                    withdrawal.amount
                                  )}
                                </strong>
                              </td>

                              <td>
                                {withdrawal.bankName ||
                                  "—"}
                              </td>

                              <td>
                                <strong>
                                  {withdrawal.accountNumber ||
                                    "—"}
                                </strong>

                                <small>
                                  {withdrawal.accountHolderName ||
                                                                      "—"}
                                </small>
                              </td>

                              <td>
                                <span
                                  className={`status-badge ${getStatusClass(
                                    withdrawal.status
                                  )}`}
                                >
                                  {withdrawal.status ||
                                    "—"}
                                </span>
                              </td>

                              <td>
                                {isPending ? (
                                  <div className="admin-action-group">
                                    <button
                                      type="button"
                                      className="success-button"
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
                                        : "Mark Paid"}
                                    </button>

                                    <button
                                      type="button"
                                      className="danger-button"
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
                                ) : (
                                  <div>
                                    {withdrawal.paymentReference && (
                                      <small>
                                        Ref:{" "}
                                        {
                                          withdrawal.paymentReference
                                        }
                                      </small>
                                    )}

                                    {withdrawal.rejectionReason && (
                                      <small>
                                        Reason:{" "}
                                        {
                                          withdrawal.rejectionReason
                                        }
                                      </small>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ====================================================
              INVESTMENTS
          ==================================================== */}

          {activeSection ===
            "investments" && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="dashboard-eyebrow">
                    INVESTMENT MANAGEMENT
                  </p>

                  <h2>
                    Investments
                  </h2>

                  <p>
                    View all user investment
                    records and return
                    information.
                  </p>
                </div>
              </div>

              {investments.length ===
              0 ? (
                <div className="admin-empty-state">
                  No investment records
                  found.
                </div>
              ) : (
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
                          Total Returns
                        </th>

                        <th>
                          Processed
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          Next Return
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {investments.map(
                        (
                          investment
                        ) => {
                          const user =
                            users.find(
                              (item) =>
                                item.id ===
                                (
                                  investment.userId ||
                                  investment.id
                                )
                            );

                          return (
                            <tr
                              key={
                                investment.id
                              }
                            >
                              <td>
                                <strong>
                                  {user?.fullName ||
                                    investment.userId ||
                                    investment.id}
                                </strong>

                                <small>
                                  {user?.email ||
                                    investment.userId ||
                                    investment.id}
                                </small>
                              </td>

                              <td>
                                {formatMoney(
                                  investment.principalAmount ??
                                    investment.investmentAmount
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  investment.dailyReturn ??
                                    DAILY_RETURN
                                )}
                              </td>

                              <td>
                                {formatMoney(
                                  investment.totalReturns
                                )}
                              </td>

                              <td>
                                {investment.returnsProcessed ??
                                  0}
                              </td>

                              <td>
                                <span
                                  className={`status-badge ${getStatusClass(
                                    investment.status
                                  )}`}
                                >
                                  {investment.status ||
                                    "—"}
                                </span>
                              </td>

                              <td>
                                {formatDate(
                                  investment.nextReturnAt
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ====================================================
              REFERRALS
          ==================================================== */}

          {activeSection ===
            "referrals" && (
            <section className="admin-panel">
              <div className="admin-panel-header">
                <div>
                  <p className="dashboard-eyebrow">
                    REFERRAL MANAGEMENT
                  </p>

                  <h2>
                    Referrals
                  </h2>

                  <p>
                    View referral codes,
                    referral counts and
                    referral earnings.
                  </p>
                </div>
              </div>

              <section className="admin-stats-grid">
                <div className="admin-stat-card">
                  <span>
                    Total Referral Earnings
                  </span>

                  <strong>
                    {formatMoney(
                      totalReferralEarnings
                    )}
                  </strong>
                </div>

                <div className="admin-stat-card">
                  <span>
                    Users With Referrals
                  </span>

                  <strong>
                    {
                      users.filter(
                        (user) =>
                          Number(
                            user.referralCount ??
                              user.referredUsersCount ??
                              0
                          ) > 0
                      ).length
                    }
                  </strong>
                </div>
              </section>

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
                        Referral Earnings
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
                                "—"}
                            </small>
                          </td>

                          <td>
                            <strong>
                              {user.referralCode ||
                                "—"}
                            </strong>
                          </td>

                          <td>
                            {user.referredBy ||
                              "—"}
                          </td>

                          <td>
                            {user.referralCount ??
                              user.referredUsersCount ??
                              0}
                          </td>

                          <td>
                            {user.qualifiedReferrals ??
                              0}
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
              </div>
            </section>
          )}

          {/* ====================================================
              ADMIN FOOTER
          ==================================================== */}

          <footer className="admin-footer">
            <div>
              <strong>
                XS Company Limited
              </strong>

              <span>
                Admin Dashboard
              </span>
            </div>

            <span>
              Daily return:{" "}
              {formatMoney(
                DAILY_RETURN
              )}
            </span>

            <span>
              Minimum investment:{" "}
              {formatMoney(
                MINIMUM_DEPOSIT
              )}
            </span>

            <span>
              Minimum withdrawal:{" "}
              {formatMoney(
                MINIMUM_WITHDRAWAL
              )}
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
                                }
