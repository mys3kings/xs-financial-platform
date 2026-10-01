import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "./firebase";

const REFERRAL_COMMISSION = 50;
const MINIMUM_QUALIFYING_DEPOSIT = 500;

type UserProfile = {
  fullName?: string;
  phone?: string;
  email?: string;

  referralCode?: string;

  referredBy?: string;
  referredByCode?: string;

  qualifiedReferrals?: number;
  referralEarnings?: number;
  totalReferralEarnings?: number;
};

type ReferralRecord = {
  id: string;

  referrerUserId?: string;
  referredUserId?: string;

  referralCode?: string;
  referredName?: string;

  status?: string;

  registeredAt?: any;
  depositApprovedAt?: any;
  qualifiedAt?: any;

  commissionAmount?: number;
  commissionPaid?: boolean;
  commissionPaidAt?: any;
};

function generateReferralCode() {
  const randomNumber = Math.floor(
    100000 + Math.random() * 900000
  );

  return `XS${randomNumber}`;
}

async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const newCode = generateReferralCode();

    const existingCodeQuery = query(
      collection(db, "users"),
      where("referralCode", "==", newCode)
    );

    const snapshot = await getDocs(existingCodeQuery);

    if (snapshot.empty) {
      return newCode;
    }
  }

  throw new Error(
    "Unable to generate a unique referral code."
  );
}

function formatDate(value: any) {
  if (!value) {
    return "—";
  }

  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toLocaleDateString("en-NG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    return new Date(value).toLocaleDateString("en-NG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "QUALIFIED":
      return "Qualified";

    case "DEPOSIT_PENDING":
      return "Deposit pending";

    case "REGISTERED":
      return "Registered";

    case "REJECTED":
      return "Rejected";

    default:
      return "Pending";
  }
}

function getCommissionAmount(
  referral: ReferralRecord
) {
  if (referral.status !== "QUALIFIED") {
    return 0;
  }

  const amount = Number(
    referral.commissionAmount
  );

  if (
    Number.isFinite(amount) &&
    amount > 0
  ) {
    return amount;
  }

  return REFERRAL_COMMISSION;
}

export default function Referral() {
  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [referrals, setReferrals] = useState<
    ReferralRecord[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [generatingCode, setGeneratingCode] =
    useState(false);

  const [error, setError] = useState("");

  const [copied, setCopied] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setProfile(null);
          setReferrals([]);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          const userRef = doc(
            db,
            "users",
            user.uid
          );

          const userSnapshot =
            await getDoc(userRef);

          let currentProfile: UserProfile;

          if (userSnapshot.exists()) {
            currentProfile =
              userSnapshot.data() as UserProfile;
          } else {
            currentProfile = {
              fullName:
                user.displayName ||
                "XS User",
              email: user.email || "",
            };
          }

          /*
           * Older accounts may not have a referral
           * code. Create one automatically.
           */
          if (!currentProfile.referralCode) {
            setGeneratingCode(true);

            try {
              const newReferralCode =
                await generateUniqueReferralCode();

              await updateDoc(userRef, {
                referralCode:
                  newReferralCode,
              });

              currentProfile = {
                ...currentProfile,
                referralCode:
                  newReferralCode,
              };
            } finally {
              setGeneratingCode(false);
            }
          }

          setProfile(currentProfile);

          /*
           * Get every referral belonging to
           * the currently logged-in user.
           */
          const referralsQuery = query(
            collection(db, "referrals"),
            where(
              "referrerUserId",
              "==",
              user.uid
            )
          );

          const referralsSnapshot =
            await getDocs(referralsQuery);

          const referralData: ReferralRecord[] =
            referralsSnapshot.docs.map(
              (item) => ({
                id: item.id,
                ...(item.data() as Omit<
                  ReferralRecord,
                  "id"
                >),
              })
            );

          /*
           * Newest referrals first.
           */
          referralData.sort((a, b) => {
            const aTime =
              typeof a.registeredAt?.toMillis ===
              "function"
                ? a.registeredAt.toMillis()
                : 0;

            const bTime =
              typeof b.registeredAt?.toMillis ===
              "function"
                ? b.registeredAt.toMillis()
                : 0;

            return bTime - aTime;
          });

          setReferrals(referralData);
        } catch (err) {
          console.error(
            "REFERRAL PAGE ERROR:",
            err
          );

          setError(
            "We couldn't load your referral information right now. Please try again."
          );
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const referralCode =
    profile?.referralCode || "";

  const referralLink = useMemo(() => {
    if (!referralCode) {
      return "";
    }

    return `${window.location.origin}/register?ref=${encodeURIComponent(
      referralCode
    )}`;
  }, [referralCode]);

  const totalReferrals =
    referrals.length;

  const qualifiedReferrals =
    referrals.filter(
      (referral) =>
        referral.status === "QUALIFIED"
    ).length;

  const pendingReferrals =
    referrals.filter(
      (referral) =>
        referral.status === "REGISTERED" ||
        referral.status ===
          "DEPOSIT_PENDING"
    ).length;

  const rejectedReferrals =
    referrals.filter(
      (referral) =>
        referral.status === "REJECTED"
    ).length;

  /*
   * Display-only calculation.
   *
   * Referral.tsx NEVER creates or pays commissions.
   * The trusted/admin deposit approval process is
   * responsible for qualifying the referral.
   */
  const referralEarnings =
    referrals.reduce(
      (total, referral) =>
        total +
        getCommissionAmount(referral),
      0
    );

  async function copyText(
    text: string,
    type: string
  ) {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(type);

      window.setTimeout(() => {
        setCopied("");
      }, 2000);
    } catch (err) {
      console.error(
        "COPY ERROR:",
        err
      );
    }
  }

  async function shareReferralLink() {
    if (!referralLink) {
      return;
    }

    try {
      if (
        navigator.share &&
        typeof navigator.share ===
          "function"
      ) {
        await navigator.share({
          title:
            "Join XS Company Limited",
          text:
            "Join XS Company Limited using my referral link.",
          url: referralLink,
        });

        return;
      }

      await copyText(
        referralLink,
        "link"
      );
    } catch (err) {
      /*
       * Closing/cancelling the native share
       * window is not an error that needs
       * to be shown to the user.
       */
      console.log(
        "Share cancelled or unavailable.",
        err
      );
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loader"></div>

          <p>
            {generatingCode
              ? "Creating your referral code..."
              : "Loading your referral programme..."}
          </p>
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
          className="dashboard-logout"
        >
          Dashboard
        </Link>
      </header>

      <div className="dashboard-container">
        <section className="dashboard-welcome">
          <div>
            <p className="dashboard-eyebrow">
              XS COMPANY LIMITED
            </p>

            <h1>
              Referral programme
            </h1>

            <p>
              Invite people to XS using your
              unique referral link and track
              your referral progress.
            </p>
          </div>
        </section>

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <section className="dashboard-summary">
          <div className="dashboard-card">
            <div className="dashboard-card-top">
              <span>
                Total referrals
              </span>

              <span className="dashboard-card-icon">
                ↗
              </span>
            </div>

            <strong>
              {totalReferrals}
            </strong>

            <p>
              People registered through
              your referral
            </p>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-top">
              <span>
                Qualified referrals
              </span>

              <span className="dashboard-card-icon">
                ✓
              </span>
            </div>

            <strong>
              {qualifiedReferrals}
            </strong>

            <p>
              ₦{REFERRAL_COMMISSION} per
              qualified referral
            </p>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-top">
              <span>
                Referral earnings
              </span>

              <span className="dashboard-card-icon">
                ₦
              </span>
            </div>

            <strong>
              ₦
              {referralEarnings.toLocaleString(
                "en-NG"
              )}
            </strong>

            <p>
              Based on qualified referrals
            </p>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                YOUR REFERRAL CODE
              </p>

              <h2>
                Invite people to XS
              </h2>
            </div>
          </div>

          <div className="referral-dashboard-card">
            <div>
              <span>
                Your referral code
              </span>

              <strong>
                {referralCode ||
                  "Generating..."}
              </strong>
            </div>

            <button
              type="button"
              className="dashboard-small-button"
              onClick={() =>
                copyText(
                  referralCode,
                  "code"
                )
              }
              disabled={!referralCode}
            >
              {copied === "code"
                ? "Copied!"
                : "Copy code"}
            </button>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                REFERRAL LINK
              </p>

              <h2>
                Share your link
              </h2>
            </div>
          </div>

          <div className="account-info-card">
            <div className="account-info-row">
              <span>
                Your referral link
              </span>

              <strong
                style={{
                  wordBreak:
                    "break-all",
                }}
              >
                {referralLink ||
                  "Generating your referral link..."}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "18px",
              }}
            >
              <button
                type="button"
                className="dashboard-small-button"
                onClick={() =>
                  copyText(
                    referralLink,
                    "link"
                  )
                }
                disabled={!referralLink}
              >
                {copied === "link"
                  ? "Copied!"
                  : "Copy referral link"}
              </button>

              <button
                type="button"
                className="dashboard-small-button"
                onClick={
                  shareReferralLink
                }
                disabled={!referralLink}
              >
                Share link
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                HOW IT WORKS
              </p>

              <h2>
                How a referral qualifies
              </h2>
            </div>
          </div>

          <div className="investment-empty-card">
            <div className="investment-clock">
              ₦
            </div>

            <div>
              <h3>
                Earn ₦
                {REFERRAL_COMMISSION} per
                qualified referral
              </h3>

              <p>
                A person first needs to
                register through your
                referral link or code.
              </p>

              <p
                style={{
                  marginTop: "8px",
                }}
              >
                After the referred user makes
                a qualifying deposit of at
                least ₦
                {MINIMUM_QUALIFYING_DEPOSIT.toLocaleString(
                  "en-NG"
                )}{" "}
                and the XS administrator
                approves that deposit, the
                referral becomes qualified.
              </p>

              <p
                style={{
                  marginTop: "8px",
                }}
              >
                The referral commission is
                handled separately from this
                page so refreshing or opening
                this page cannot create a
                duplicate commission.
              </p>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                REFERRAL HISTORY
              </p>

              <h2>
                Your referrals
              </h2>
            </div>
          </div>

          {referrals.length === 0 ? (
            <div className="investment-empty-card">
              <div className="investment-clock">
                ↗
              </div>

              <div>
                <h3>
                  No referrals yet
                </h3>

                <p>
                  You haven't referred anyone
                  yet. Share your referral link
                  to get started.
                </p>

                <button
                  type="button"
                  className="dashboard-small-button"
                  onClick={
                    shareReferralLink
                  }
                  disabled={!referralLink}
                >
                  Share referral link
                </button>
              </div>
            </div>
          ) : (
            <div className="account-info-card">
              {referrals.map(
                (referral) => {
                  const commission =
                    getCommissionAmount(
                      referral
                    );

                  return (
                    <div
                      className="account-info-row"
                      key={referral.id}
                    >
                      <div>
                        <span>
                          {referral.referredName ||
                            "Referred user"}
                        </span>

                        <strong>
                          {getStatusLabel(
                            referral.status
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          {formatDate(
                            referral.registeredAt
                          )}
                        </span>

                        <strong>
                          ₦
                          {commission.toLocaleString(
                            "en-NG"
                          )}
                        </strong>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                REFERRAL STATUS
              </p>

              <h2>
                Your progress
              </h2>
            </div>
          </div>

          <div className="account-info-card">
            <div className="account-info-row">
              <span>
                Total referrals
              </span>

              <strong>
                {totalReferrals}
              </strong>
            </div>

            <div className="account-info-row">
              <span>
                Pending referrals
              </span>

              <strong>
                {pendingReferrals}
              </strong>
            </div>

            <div className="account-info-row">
              <span>
                Qualified referrals
              </span>

              <strong>
                {qualifiedReferrals}
              </strong>
            </div>

            <div className="account-info-row">
              <span>
                Rejected referrals
              </span>

              <strong>
                {rejectedReferrals}
              </strong>
            </div>

            <div className="account-info-row">
              <span>
                Referral earnings
              </span>

              <strong>
                ₦
                {referralEarnings.toLocaleString(
                  "en-NG"
                )}
              </strong>
            </div>
          </div>
        </section>

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
