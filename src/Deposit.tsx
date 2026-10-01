import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  auth,
  db,
} from "./firebase";

const MINIMUM_DEPOSIT = 500;

type DepositAccountSettings = {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  instructions?: string;
  active?: boolean;
};

type UserProfile = {
  fullName?: string;
  phone?: string;
  email?: string;
  referralCode?: string;
};

type PendingDeposit = {
  id: string;
  amount?: number;
  senderName?: string;
  status?: string;
  createdAt?: any;
};

function formatMoney(
  value: number
) {
  return `₦${value.toLocaleString(
    "en-NG",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function generateDepositReference() {
  const timestamp =
    Date.now().toString(36).toUpperCase();

  const randomPart =
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

  return `XS-DEP-${timestamp}-${randomPart}`;
}

function formatDate(value: any) {
  if (!value) {
    return "—";
  }

  try {
    if (
      typeof value.toDate ===
      "function"
    ) {
      return value
        .toDate()
        .toLocaleDateString(
          "en-NG",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        );
    }

    return new Date(
      value
    ).toLocaleDateString(
      "en-NG",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "—";
  }
}

export default function Deposit() {
  const navigate = useNavigate();

  const [userId, setUserId] =
    useState("");

  const [profile, setProfile] =
    useState<UserProfile | null>(
      null
    );

  const [senderName, setSenderName] =
    useState("");

  const [amount, setAmount] =
    useState(
      String(MINIMUM_DEPOSIT)
    );

  const [
    depositAccount,
    setDepositAccount,
  ] =
    useState<DepositAccountSettings | null>(
      null
    );

  const [
    pendingDeposit,
    setPendingDeposit,
  ] =
    useState<PendingDeposit | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    copyingAccount,
    setCopyingAccount,
  ] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState(false);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            navigate(
              "/login",
              {
                replace: true,
              }
            );

            return;
          }

          try {
            setLoading(true);
            setError("");

            setUserId(
              user.uid
            );

            /*
             * Load the user's profile.
             */
            const userRef =
              doc(
                db,
                "users",
                user.uid
              );

            const userSnapshot =
              await getDoc(
                userRef
              );

            if (
              userSnapshot.exists()
            ) {
              setProfile(
                userSnapshot.data() as UserProfile
              );
            } else {
              setProfile({
                fullName:
                  user.displayName ||
                  "",
                email:
                  user.email ||
                  "",
              });
            }

            /*
             * Load the deposit account
             * configuration.
             *
             * This means the actual bank
             * details do not have to be
             * hardcoded into this file.
             */
            const accountRef =
              doc(
                db,
                "settings",
                "depositAccount"
              );

            const accountSnapshot =
              await getDoc(
                accountRef
              );

            if (
              accountSnapshot.exists()
            ) {
              setDepositAccount(
                accountSnapshot.data() as DepositAccountSettings
              );
            } else {
              setDepositAccount(
                null
              );
            }

            /*
             * Check whether the user already
             * has a pending deposit.
             *
             * This prevents the same user from
             * creating many pending requests.
             */
            const pendingQuery =
              query(
                collection(
                  db,
                  "deposits"
                ),
                where(
                  "userId",
                  "==",
                  user.uid
                ),
                where(
                  "status",
                  "==",
                  "pending"
                )
              );

            const pendingSnapshot =
              await getDocs(
                pendingQuery
              );

            if (
              !pendingSnapshot.empty
            ) {
              const pendingDoc =
                pendingSnapshot.docs[0];

              setPendingDeposit({
                id:
                  pendingDoc.id,
                ...(pendingDoc.data() as Omit<
                  PendingDeposit,
                  "id"
                >),
              });
            } else {
              setPendingDeposit(
                null
              );
            }
          } catch (err) {
            console.error(
              "DEPOSIT PAGE LOAD ERROR:",
              err
            );

            setError(
              "We couldn't load the deposit page. Please try again."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [navigate]);

  async function copyAccountNumber() {
    const accountNumber =
      depositAccount?.accountNumber?.trim();

    if (!accountNumber) {
      return;
    }

    try {
      setCopyingAccount(true);

      await navigator.clipboard.writeText(
        accountNumber
      );

      window.setTimeout(() => {
        setCopyingAccount(false);
      }, 2000);
    } catch (err) {
      console.error(
        "COPY ACCOUNT ERROR:",
        err
      );

      setCopyingAccount(false);

      setError(
        "We couldn't copy the account number. Please copy it manually."
      );
    }
  }

  async function refreshPendingDeposit() {
    if (!userId) {
      return;
    }

    try {
      const pendingQuery =
        query(
          collection(
            db,
            "deposits"
          ),
          where(
            "userId",
            "==",
            userId
          ),
          where(
            "status",
            "==",
            "pending"
          )
        );

      const snapshot =
        await getDocs(
          pendingQuery
        );

      if (snapshot.empty) {
        setPendingDeposit(
          null
        );
        return;
      }

      const item =
        snapshot.docs[0];

      setPendingDeposit({
        id: item.id,
        ...(item.data() as Omit<
          PendingDeposit,
          "id"
        >),
      });
    } catch (err) {
      console.error(
        "PENDING DEPOSIT CHECK ERROR:",
        err
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    /*
     * User must be authenticated.
     */
    if (!userId) {
      setError(
        "Your session has expired. Please sign in again."
      );

      return;
    }

    /*
     * Don't allow another request if one
     * is already pending.
     */
    if (pendingDeposit) {
      setError(
        "You already have a deposit request waiting for admin approval."
      );

      return;
    }

    const cleanedSenderName =
      senderName.trim();

    const numericAmount =
      Number(amount);

    /*
     * Validate sender name.
     */
    if (!cleanedSenderName) {
      setError(
        "Please enter the name on the account you used to make the deposit."
      );

      return;
    }

    if (
      cleanedSenderName.length < 2
    ) {
      setError(
        "Please enter the full name on the sending account."
      );

      return;
    }

    /*
     * Validate amount.
     */
    if (
      !Number.isFinite(
        numericAmount
      )
    ) {
      setError(
        "Please enter a valid deposit amount."
      );

      return;
    }

    if (
      numericAmount <
      MINIMUM_DEPOSIT
    ) {
      setError(
        `The minimum deposit is ${formatMoney(
          MINIMUM_DEPOSIT
        )}.`
      );

      return;
    }

    if (
      !Number.isInteger(
        numericAmount
      )
    ) {
      setError(
        "Please enter the deposit amount as a whole number."
      );

      return;
    }

    /*
     * Recheck pending deposits immediately
     * before creating the request.
     */
    try {
      setSubmitting(true);

      const latestPendingQuery =
        query(
          collection(
            db,
            "deposits"
          ),
          where(
            "userId",
            "==",
            userId
          ),
          where(
            "status",
            "==",
            "pending"
          )
        );

      const latestPendingSnapshot =
        await getDocs(
          latestPendingQuery
        );

      if (
        !latestPendingSnapshot.empty
      ) {
        const existing =
          latestPendingSnapshot
            .docs[0];

        setPendingDeposit({
          id: existing.id,
          ...(existing.data() as Omit<
            PendingDeposit,
            "id"
          >),
        });

        setError(
          "You already have a deposit request waiting for admin approval."
        );

        return;
      }

      /*
       * Generate a unique reference for the
       * admin to identify the request.
       */
      const reference =
        generateDepositReference();

      /*
       * Create the pending deposit.
       *
       * IMPORTANT:
       * This does NOT add money to the user's
       * balance and does NOT activate the
       * investment.
       *
       * Admin approval handles that later.
       */
      await addDoc(
        collection(
          db,
          "deposits"
        ),
        {
          userId,

          userFullName:
            profile?.fullName ||
            "",

          userEmail:
            profile?.email ||
            auth.currentUser
              ?.email ||
            "",

          senderName:
            cleanedSenderName,

          amount:
            numericAmount,

          currency: "NGN",

          status: "pending",

          type: "investment",

          reference,

          createdAt:
            serverTimestamp(),

          investmentRequested:
            true,

          minimumDeposit:
            MINIMUM_DEPOSIT,

          reviewedAt: null,

          reviewedBy: null,

          rejectionReason: null,

          approvedAt: null,

          approvedBy: null,
        }
      );

      setSuccess(true);

      setSenderName("");

      setAmount(
        String(
          MINIMUM_DEPOSIT
        )
      );

      setPendingDeposit(
        null
      );
    } catch (err: unknown) {
      console.error(
        "DEPOSIT REQUEST ERROR:",
        err
      );

      const firebaseError =
        err as {
          code?: string;
          message?: string;
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
    );  if (success) {
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
              submitted successfully and is
              now waiting for admin approval.
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
                  refreshPendingDeposit();
                }}
              >
                View deposit page
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

        {error && (
          <div
            className="form-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {pendingDeposit && (
          <section className="dashboard-section">
            <div className="deposit-pending-card">
              <div className="deposit-success-icon">
                !
              </div>

              <div>
                <p className="dashboard-eyebrow">
                  PENDING REQUEST
                </p>

                <h2>
                  You already have a deposit
                  request under review
                </h2>

                <p>
                  Please wait for the XS
                  administrator to review your
                  existing request before
                  submitting another one.
                </p>

                <div className="account-info-card">
                  <div className="account-info-row">
                    <span>
                      Amount
                    </span>

                    <strong>
                      {formatMoney(
                        Number(
                          pendingDeposit.amount ||
                            0
                        )
                      )}
                    </strong>
                  </div>

                  <div className="account-info-row">
                    <span>
                      Sender name
                    </span>

                    <strong>
                      {pendingDeposit.senderName ||
                        "—"}
                    </strong>
                  </div>

                  <div className="account-info-row">
                    <span>
                      Submitted
                    </span>

                    <strong>
                      {formatDate(
                        pendingDeposit.createdAt
                      )}
                    </strong>
                  </div>

                  <div className="account-info-row">
                    <span>
                      Status
                    </span>

                    <strong>
                      Pending approval
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="dashboard-small-button"
                  onClick={
                    refreshPendingDeposit
                  }
                  style={{
                    marginTop: "16px",
                  }}
                >
                  Refresh status
                </button>
              </div>
            </div>
          </section>
        )}

        {!pendingDeposit && (
          <section className="deposit-layout">
            <div className="deposit-main-card">
              <div className="deposit-amount-box">
                <span>
                  Minimum deposit
                </span>

                <strong>
                  ₦500
                </strong>
              </div>

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
                    Limited deposit account
                    displayed below.
                  </li>

                  <li>
                    Make sure the transfer is
                    made from an account
                    belonging to you.
                  </li>

                  <li>
                    Enter the name of the
                    account you used to make
                    the transfer.
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

              <div className="deposit-account-box">
                <div>
                  <span>
                    Bank
                  </span>

                  <strong>
                    {depositAccount?.bankName ||
                      "Account not configured"}
                  </strong>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                  }}
                >
                  <span>
                    Account name
                  </span>

                  <strong>
                    {depositAccount?.accountName ||
                      "Account not configured"}
                  </strong>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                  }}
                >
                  <span>
                    Account number
                  </span>

                  <strong
                    style={{
                      wordBreak:
                        "break-word",
                    }}
                  >
                    {depositAccount?.accountNumber ||
                      "Account not configured"}
                  </strong>
                </div>

                {depositAccount?.accountNumber && (
                  <button
                    type="button"
                    className="dashboard-small-button"
                    onClick={
                      copyAccountNumber
                    }
                    disabled={
                      copyingAccount
                    }
                    style={{
                      marginTop: "16px",
                    }}
                  >
                    {copyingAccount
                      ? "Copied!"
                      : "Copy account number"}
                  </button>
                )}

                {depositAccount?.instructions && (
                  <p
                    style={{
                      marginTop: "16px",
                    }}
                  >
                    {depositAccount.instructions}
                  </p>
                )}

                {!depositAccount?.accountNumber && (
                  <p
                    style={{
                      marginTop: "16px",
                    }}
                  >
                    The official deposit account
                    has not been configured yet.
                    Please contact XS support
                    before making a transfer.
                  </p>
                )}
              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="deposit-form"
              >
                <label>
                  Deposit amount

                  <input
                    type="number"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value
                      )
                    }
                    min={
                      MINIMUM_DEPOSIT
                    }
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

                <label>
                  Name on the sending account

                  <input
                    type="text"
                    value={senderName}
                    onChange={(event) =>
                      setSenderName(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Daniel Isaac"
                    autoComplete="name"
                    required
                  />
                </label>

                <p className="deposit-note">
                  Enter the name exactly as it
                  appears on the account you
                  used to make the transfer.
                </p>

                <div
                  className="deposit-note"
                  style={{
                    marginTop: "8px",
                  }}
                >
                  <strong>
                    Important:
                  </strong>{" "}
                  Submitting this form only
                  creates a pending deposit
                  request. Your account balance
                  and investment are not changed
                  until the deposit is approved.
                </div>

                <button
                  type="submit"
                  className="primary-button register-button"
                  disabled={
                    submitting ||
                    !depositAccount?.accountNumber
                  }
                  aria-busy={
                    submitting
                  }
                >
                  {submitting
                    ? "Submitting request..."
                    : "Submit deposit request"}
                </button>
              </form>
            </div>

            <aside className="deposit-side-card">
              <div className="deposit-side-icon">
                ₦
              </div>

              <h2>
                Pending approval
              </h2>

              <p>
                After you submit your request,
                the XS administrator will review
                the deposit before your
                investment is activated.
              </p>

              <div className="deposit-status">
                <span></span>

                Pending admin approval
              </div>
            </aside>
          </section>
        )}

        <footer className="dashboard-footer">
          <strong>
            XS Company Limited
          </strong>

          <span>
            © {new Date().getFullYear()} All
            rights reserved.
          </span>
        </footer>
      </div>
    </main>
  );
            }
  }
