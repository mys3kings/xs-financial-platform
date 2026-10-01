import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

type UserProfile = {
  fullName?: string;
  phone?: string;
  email?: string;
  referralCode?: string;

  balance?: number;
  referralEarnings?: number;
};

type InvestmentData = {
  status?: string;
  principalAmount?: number;
  investmentAmount?: number;
  dailyReturn?: number;
  totalReturns?: number;
  startedAt?: unknown;
  nextReturnAt?: unknown;
};

const DEFAULT_DAILY_RETURN = 200;
const MINIMUM_DEPOSIT = 500;

export default function Dashboard() {
  const navigate = useNavigate();

  // ---------------------------------
  // SECRET ADMIN ACCESS
  // ---------------------------------

  const tapTimesRef = useRef<number[]>([]);

  function handleSecretAdminTap() {
    const now = Date.now();

    tapTimesRef.current = [
      ...tapTimesRef.current.filter(
        (time) => now - time <= 2000
      ),
      now,
    ];

    // Four taps within 2 seconds
    if (tapTimesRef.current.length >= 4) {
      tapTimesRef.current = [];

      navigate("/admin");
    }
  }

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [investment, setInvestment] =
    useState<InvestmentData | null>(null);

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // ---------------------------------
  // LOAD USER DATA
  // ---------------------------------

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setProfile(null);
          setInvestment(null);
          setLoading(false);

          navigate("/login", {
            replace: true,
          });

          return;
        }

        try {
          const userRef = doc(
            db,
            "users",
            user.uid
          );

          const investmentRef = doc(
            db,
            "investments",
            user.uid
          );

          // Load both documents together.
          const [
            userSnapshot,
            investmentSnapshot,
          ] = await Promise.all([
            getDoc(userRef),
            getDoc(investmentRef),
          ]);

          // ---------------------------------
          // USER PROFILE
          // ---------------------------------

          if (userSnapshot.exists()) {
            setProfile(
              userSnapshot.data() as UserProfile
            );
          } else {
            setProfile({
              fullName:
                user.displayName || "XS User",

              email:
                user.email || "",
            });
          }

          // ---------------------------------
          // INVESTMENT
          // ---------------------------------

          if (investmentSnapshot.exists()) {
            setInvestment(
              investmentSnapshot.data() as InvestmentData
            );
          } else {
            setInvestment(null);
          }
        } catch (error) {
          console.error(
            "Dashboard data error:",
            error
          );

          setProfile({
            fullName:
              user.displayName || "XS User",

            email:
              user.email || "",
          });

          setInvestment(null);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [navigate]);

  // ---------------------------------
  // LOGOUT
  // ---------------------------------

  async function handleLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);

      await signOut(auth);

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      setLoggingOut(false);
    }
  }

  // ---------------------------------
  // LOADING
  // ---------------------------------

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading">

          <div className="dashboard-loader"></div>

          <p>
            Loading your XS dashboard...
          </p>

        </div>
      </main>
    );
  }

  const firstName =
    profile?.fullName
      ?.trim()
      .split(" ")[0] || "there";

  // ---------------------------------
  // ACCOUNT VALUES
  // ---------------------------------

  const availableBalance =
    typeof profile?.balance === "number"
      ? profile.balance
      : 0;

  const referralEarnings =
    typeof profile?.referralEarnings === "number"
      ? profile.referralEarnings
      : 0;

  // ---------------------------------
  // INVESTMENT VALUES
  // ---------------------------------

  const isInvestmentActive =
    investment?.status?.toUpperCase() ===
    "ACTIVE";

  const investmentAmount =
    investment?.investmentAmount ??
    investment?.principalAmount ??
    0;

  const dailyReturn =
    investment?.dailyReturn ??
    DEFAULT_DAILY_RETURN;

  // ---------------------------------
  // MONEY FORMATTER
  // ---------------------------------

  function formatMoney(amount: number) {
    return `₦${amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // ---------------------------------
  // DASHBOARD
  // ---------------------------------

  return (
    <main className="dashboard-page">

      {/* =================================
          TOP NAVIGATION
          ================================= */}

      <header className="dashboard-navbar">

        <Link
          to="/dashboard"
          className="dashboard-brand"
          onClick={(event) => {
            /*
             * Stop the Link from navigating away
             * when the user is performing the
             * four-tap admin gesture.
             *
             * The X itself handles the secret taps.
             */
            event.stopPropagation();
          }}
        >

          {/* SECRET FOUR-TAP X */}

          <span
            className="brand-x"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              handleSecretAdminTap();
            }}
            role="button"
            tabIndex={0}
            aria-label="XS"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();

                handleSecretAdminTap();
              }
            }}
          >
            X
          </span>

          <span className="brand-s">
            S
          </span>

          <span className="brand-name">
            Company Limited
          </span>

        </Link>


        <button
          type="button"
          className="dashboard-logout"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-busy={loggingOut}
        >
          {loggingOut
            ? "Logging out..."
            : "Logout"}
        </button>

      </header>


      <div className="dashboard-container">

        {/* =================================
            WELCOME
            ================================= */}

        <section className="dashboard-welcome">

          <div>

            <p className="dashboard-eyebrow">
              XS COMPANY LIMITED
            </p>

            <h1>
              Welcome back, {firstName}
            </h1>

            <p>
              Manage your account, investment and
              referrals from your dashboard.
            </p>

          </div>

        </section>


        {/* =================================
            ACCOUNT SUMMARY
            ================================= */}

        <section className="dashboard-summary">

          {/* AVAILABLE BALANCE */}

          <div className="dashboard-card balance-card">

            <div className="dashboard-card-top">

              <span>
                Available balance
              </span>

              <span className="dashboard-card-icon">
                ₦
              </span>

            </div>

            <strong>
              {formatMoney(
                availableBalance
              )}
            </strong>

            <p>
              Available for withdrawal
            </p>

          </div>


          {/* INVESTMENT BALANCE */}

          <div className="dashboard-card">

            <div className="dashboard-card-top">

              <span>
                Investment balance
              </span>

              <span className="dashboard-card-icon">
                ↗
              </span>

            </div>

            <strong>
              {isInvestmentActive
                ? formatMoney(
                    investmentAmount
                  )
                : "₦0.00"}
            </strong>

            <p>
              {isInvestmentActive
                ? "Your active investment"
                : "No active investment"}
            </p>

          </div>


          {/* REFERRAL EARNINGS */}

          <div className="dashboard-card">

            <div className="dashboard-card-top">

              <span>
                Referral earnings
              </span>

              <span className="dashboard-card-icon">
                ♧
              </span>

            </div>

            <strong>
              {formatMoney(
                referralEarnings
              )}
            </strong>

            <p>
              Earn ₦50 per qualified referral
            </p>

          </div>

        </section>


        {/* =================================
            QUICK ACTIONS
            ================================= */}

        <section className="dashboard-section">

          <div className="dashboard-section-heading">

            <div>

              <p className="dashboard-eyebrow">
                QUICK ACTIONS
              </p>

              <h2>
                Manage your account
              </h2>

            </div>

          </div>


          <div className="dashboard-actions">

            <Link
              to="/deposit"
              className="dashboard-action primary"
            >

              <span className="action-icon">
                +
              </span>

              <span>

                <strong>
                  Deposit to invest
                </strong>

                <small>
                  Start or renew your investment
                </small>

              </span>

              <span className="action-arrow">
                →
              </span>

            </Link>


            <Link
              to="/withdraw"
              className="dashboard-action"
            >

              <span className="action-icon">
                ₦
              </span>

              <span>

                <strong>
                  Withdraw
                </strong>

                <small>
                  Request a withdrawal
                </small>

              </span>

              <span className="action-arrow">
                →
              </span>

            </Link>


            <Link
              to="/referral"
              className="dashboard-action"
            >

              <span className="action-icon">
                ↗
              </span>

              <span>

                <strong>
                  Referral programme
                </strong>

                <small>
                  Invite people and earn rewards
                </small>

              </span>

              <span className="action-arrow">
                →
              </span>

            </Link>

          </div>

        </section>


        {/* =================================
            INVESTMENT STATUS
            ================================= */}

        <section className="dashboard-section">

          <div className="dashboard-section-heading">

            <div>

              <p className="dashboard-eyebrow">
                INVESTMENT
              </p>

              <h2>
                Your investment
              </h2>

            </div>

          </div>


          {isInvestmentActive ? (

            <div className="investment-empty-card">

              <div className="investment-clock">
                ◷
              </div>

              <div>

                <h3>
                  Active investment
                </h3>

                <p>
                  Investment amount:{" "}
                  <strong>
                    {formatMoney(
                      investmentAmount
                    )}
                  </strong>
                </p>

                <p>
                  Daily return:{" "}
                  <strong>
                    {formatMoney(
                      dailyReturn
                    )}
                  </strong>
                </p>

                <Link
                  to="/investment"
                  className="dashboard-small-button"
                >
                  View investment
                </Link>

              </div>

            </div>

          ) : (

            <div className="investment-empty-card">

              <div className="investment-clock">
                ◷
              </div>

              <div>

                <h3>
                  No active investment
                </h3>

                <p>
                  Make a minimum deposit of{" "}
                  {formatMoney(
                    MINIMUM_DEPOSIT
                  )}{" "}
                  to start your XS investment cycle.
                </p>

                <Link
                  to="/deposit"
                  className="dashboard-small-button"
                >
                  Deposit to invest
                </Link>

              </div>

            </div>

          )}

        </section>


        {/* =================================
            DAILY RETURN INFORMATION
            ================================= */}

        {isInvestmentActive && (

          <section className="dashboard-section">

            <div className="dashboard-section-heading">

              <div>

                <p className="dashboard-eyebrow">
                  DAILY RETURN
                </p>

                <h2>
                  Your return
                </h2>

              </div>

            </div>


            <div className="dashboard-card">

              <div className="dashboard-card-top">

                <span>
                  Daily return
                </span>

                <span className="dashboard-card-icon">
                  ₦
                </span>

              </div>

              <strong>
                {formatMoney(
                  dailyReturn
                )}
              </strong>

              <p>
                The daily return is processed by the
                trusted return system.
              </p>

            </div>

          </section>

        )}


        {/* =================================
            REFERRAL
            ================================= */}

        <section className="dashboard-section">

          <div className="dashboard-section-heading">

            <div>

              <p className="dashboard-eyebrow">
                REFERRALS
              </p>

              <h2>
                Your referral programme
              </h2>

            </div>

          </div>


          <div className="referral-dashboard-card">

            <div>

              <span>
                Your referral code
              </span>

              <strong>
                {profile?.referralCode ||
                  "Not assigned"}
              </strong>

            </div>


            <div className="referral-stat">

              <span>
                Referral earnings
              </span>

              <strong>
                {formatMoney(
                  referralEarnings
                )}
              </strong>

            </div>


            <Link
              to="/referral"
              className="dashboard-small-button"
            >
              View referrals
            </Link>

          </div>

        </section>


        {/* =================================
            ACCOUNT INFORMATION
            ================================= */}

        <section className="dashboard-section">

          <div className="dashboard-section-heading">

            <div>

              <p className="dashboard-eyebrow">
                ACCOUNT
              </p>

              <h2>
                Account information
              </h2>

            </div>

          </div>


          <div className="account-info-card">

            <div className="account-info-row">

              <span>
                Full name
              </span>

              <strong>
                {profile?.fullName || "—"}
              </strong>

            </div>


            <div className="account-info-row">

              <span>
                Email
              </span>

              <strong>
                {profile?.email || "—"}
              </strong>

            </div>


            <div className="account-info-row">

              <span>
                Phone number
              </span>

              <strong>
                {profile?.phone || "—"}
              </strong>

            </div>

          </div>

        </section>


        {/* =================================
            FOOTER
            ================================= */}

        <footer className="dashboard-footer">

          <strong>
            XS Company Limited
          </strong>

          <span>
            © {new Date().getFullYear()} All rights reserved.
          </span>

        </footer>

      </div>

    </main>
  );
}
