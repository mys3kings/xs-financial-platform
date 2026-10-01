import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "./firebase";

type ReferralRecord = {
  id: string;
  referredUserId?: string;
  referredName?: string;
  status?: string;
  registeredAt?: any;
  depositApprovedAt?: any;
  qualifiedAt?: any;
};

type UserProfile = {
  referralCode?: string;
  fullName?: string;
  email?: string;
};

function formatDate(value: any) {
  if (!value) return "—";

  try {
    if (typeof value?.toDate === "function") {
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

export default function Referral() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null);
        setReferrals([]);
        setLoading(false);
        return;
      }

      setUserId(user.uid);
      setError("");

      try {
        const userRef = collection(db, "users");
        const userQuery = query(
          userRef,
          where("__name__", "==", user.uid)
        );

        const userSnapshot = await getDocs(userQuery);

        if (!userSnapshot.empty) {
          setProfile(userSnapshot.docs[0].data() as UserProfile);
        } else {
          setProfile({
            fullName: user.displayName || "XS User",
            email: user.email || "",
          });
        }

        const referralsRef = collection(db, "referrals");

        const referralsQuery = query(
          referralsRef,
          where("referrerUserId", "==", user.uid),
          orderBy("registeredAt", "desc")
        );

        const referralsSnapshot = await getDocs(referralsQuery);

        const referralData: ReferralRecord[] =
          referralsSnapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<ReferralRecord, "id">),
          }));

        setReferrals(referralData);
      } catch (err) {
        console.error("REFERRAL PAGE ERROR:", err);

        setError(
          "We couldn't load your referral information right now."
        );
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const referralCode = profile?.referralCode || "";

  const referralLink = useMemo(() => {
    if (!referralCode) return "";

    return `${window.location.origin}/register?ref=${encodeURIComponent(
      referralCode
    )}`;
  }, [referralCode]);

  const totalReferrals = referrals.length;

  const qualifiedReferrals = referrals.filter(
    (referral) => referral.status === "QUALIFIED"
  ).length;

  const pendingReferrals = referrals.filter(
    (referral) =>
      referral.status === "REGISTERED" ||
      referral.status === "DEPOSIT_PENDING"
  ).length;

  const referralEarnings = qualifiedReferrals * 50;

  async function copyText(text: string, type: string) {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);

      setCopied(type);

      window.setTimeout(() => {
        setCopied("");
      }, 2000);
    } catch (err) {
      console.error("Copy error:", err);
    }
  }

  async function shareReferralLink() {
    if (!referralLink) return;

    try {
      if (
        navigator.share &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({
          title: "Join XS Company Limited",
          text: "Join XS Company Limited using my referral link.",
          url: referralLink,
        });

        return;
      }

      await copyText(referralLink, "link");
    } catch (err) {
      console.error("Share error:", err);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-loading">
          <div className="dashboard-loader"></div>
          <p>Loading your referral programme...</p>
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

        <Link to="/dashboard" className="dashboard-logout">
          Dashboard
        </Link>
      </header>

      <div className="dashboard-container">
        <section className="dashboard-welcome">
          <div>
            <p className="dashboard-eyebrow">
              XS COMPANY LIMITED
            </p>

            <h1>Referral programme</h1>

            <p>
              Invite people to XS using your unique referral
              link and track your referral progress.
            </p>
          </div>
        </section>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <section className="dashboard-summary">
          <div className="dashboard-card">
            <div className="dashboard-card-top">
              <span>Total referrals</span>
              <span className="dashboard-card-icon">↗</span>
            </div>

            <strong>{totalReferrals}</strong>

            <p>People registered through your referral</p>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-top">
              <span>Qualified referrals</span>
              <span className="dashboard-card-icon">✓</span>
            </div>

            <strong>{qualifiedReferrals}</strong>

            <p>₦50 earned per qualified referral</p>
          </div>

          <div className="dashboard-card">
            <div className="dashboard-card-top">
              <span>Referral earnings</span>
              <span className="dashboard-card-icon">₦</span>
            </div>

            <strong>
              ₦{referralEarnings.toLocaleString("en-NG")}
            </strong>

            <p>Based on qualified referrals</p>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">YOUR REFERRAL CODE</p>
              <h2>Invite people to XS</h2>
            </div>
          </div>

          <div className="referral-dashboard-card">
            <div>
              <span>Your referral code</span>

              <strong>
                {referralCode || "Not assigned yet"}
              </strong>
            </div>

            <button
              type="button"
              className="dashboard-small-button"
              onClick={() =>
                copyText(referralCode, "code")
              }
              disabled={!referralCode}
            >
              {copied === "code" ? "Copied!" : "Copy code"}
            </button>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">REFERRAL LINK</p>
              <h2>Share your link</h2>
            </div>
          </div>

          <div className="account-info-card">
            <div className="account-info-row">
              <span>Your referral link</span>

              <strong>
                {referralLink || "Your referral link will appear here."}
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
                  copyText(referralLink, "link")
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
                onClick={shareReferralLink}
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
              <p className="dashboard-eyebrow">HOW IT WORKS</p>
              <h2>How you qualify for ₦50</h2>
            </div>
          </div>

          <div className="investment-empty-card">
            <div className="investment-clock">₦</div>

            <div>
              <h3>Qualified referral</h3>

              <p>
                A referral becomes qualified when the person
                registers through your referral code, deposits
                at least ₦500, and the deposit is approved by
                an XS administrator.
              </p>
            </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">REFERRAL HISTORY</p>
              <h2>Your referrals</h2>
            </div>
          </div>

          {referrals.length === 0 ? (
            <div className="investment-empty-card">
              <div className="investment-clock">↗</div>

              <div>
                <h3>No referrals yet</h3>

                <p>
                  You haven't referred anyone yet. Share your
                  referral link to get started.
                </p>

                <button
                  type="button"
                  className="dashboard-small-button"
                  onClick={shareReferralLink}
                  disabled={!referralLink}
                >
                  Share referral link
                </button>
              </div>
            </div>
          ) : (
            <div className="account-info-card">
              {referrals.map((referral) => (
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
                      {getStatusLabel(referral.status)}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {formatDate(referral.registeredAt)}
                    </span>

                    <strong>
                      {referral.status === "QUALIFIED"
                        ? "₦50"
                        : "₦0"}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                REFERRAL STATUS
              </p>

              <h2>Your progress</h2>
            </div>
          </div>

          <div className="account-info-card">
            <div className="account-info-row">
              <span>Total referrals</span>
              <strong>{totalReferrals}</strong>
            </div>

            <div className="account-info-row">
              <span>Pending referrals</span>
              <strong>{pendingReferrals}</strong>
            </div>

            <div className="account-info-row">
              <span>Qualified referrals</span>
              <strong>{qualifiedReferrals}</strong>
            </div>

            <div className="account-info-row">
              <span>Referral earnings</span>
              <strong>
                ₦{referralEarnings.toLocaleString("en-NG")}
              </strong>
            </div>
          </div>
        </section>

        <footer className="dashboard-footer">
          <strong>XS Company Limited</strong>

          <span>
            © {new Date().getFullYear()} All rights reserved.
          </span>
        </footer>
      </div>
    </main>
  );
    }
