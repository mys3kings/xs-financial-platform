import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from "firebase/firestore";

import { registerUser } from "./auth";
import { saveUserConsents } from "./consents";
import { createUserProfile } from "./users";
import { db } from "./firebase";

const consentItems = [
  {
    key: "terms",
    title: "Terms & Conditions",
    text: "I have read and agree to the Terms & Conditions.",
  },
  {
    key: "privacy",
    title: "Privacy Policy & Data Usage",
    text: "I have read and agree to the Privacy Policy & Data Usage.",
  },
  {
    key: "investment",
    title: "Investment Terms / Risk Disclosure",
    text: "I have read and understand the Investment Terms and Risk Disclosure.",
  },
  {
    key: "referral",
    title: "Referral Program Terms",
    text: "I have read and agree to the Referral Program Terms.",
  },
  {
    key: "platform",
    title: "Platform Structure & How XS Works",
    text: "I have read and understand how the XS platform works.",
  },
];

type ConsentState = {
  terms: boolean;
  privacy: boolean;
  investment: boolean;
  referral: boolean;
  platform: boolean;
};

type ReferrerInfo = {
  userId: string;
  referralCode: string;
  fullName?: string;
};

function generateReferralCode() {
  const randomNumber = Math.floor(100000 + Math.random() * 900000);
  return `XS${randomNumber}`;
}

function getRegisterErrorMessage(code: string) {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please login instead.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/weak-password":
      return "Your password is too weak. Please use a stronger password.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";

    case "auth/operation-not-allowed":
      return "Email and password registration is currently unavailable.";

    default:
      return "Unable to create your account right now. Please try again.";
  }
}

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const referralFromUrl =
    searchParams.get("ref")?.trim().toUpperCase() || "";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [referralCode, setReferralCode] =
    useState(referralFromUrl);

  const [consents, setConsents] = useState<ConsentState>({
    terms: false,
    privacy: false,
    investment: false,
    referral: false,
    platform: false,
  });

  const [loading, setLoading] = useState(false);
  const [validatingReferral, setValidatingReferral] =
    useState(false);
  const [referrerInfo, setReferrerInfo] =
    useState<ReferrerInfo | null>(null);

  const [error, setError] = useState("");
  const [referralError, setReferralError] = useState("");

  useEffect(() => {
    if (referralFromUrl) {
      setReferralCode(referralFromUrl);
    }
  }, [referralFromUrl]);

  const allConsentsAccepted =
    consents.terms &&
    consents.privacy &&
    consents.investment &&
    consents.referral &&
    consents.platform;

  function handleConsentChange(
    key: keyof ConsentState
  ) {
    setConsents((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }

  async function findReferrer(
    code: string
  ): Promise<ReferrerInfo | null> {
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      return null;
    }

    const usersQuery = query(
      collection(db, "users"),
      where("referralCode", "==", cleanCode)
    );

    const snapshot = await getDocs(usersQuery);

    if (snapshot.empty) {
      return null;
    }

    const referrerDocument = snapshot.docs[0];

    const data = referrerDocument.data();

    return {
      userId: referrerDocument.id,
      referralCode: cleanCode,
      fullName: data.fullName || "",
    };
  }

  async function validateReferralCode() {
    const cleanCode = referralCode.trim().toUpperCase();

    setReferralError("");
    setReferrerInfo(null);

    if (!cleanCode) {
      return true;
    }

    try {
      setValidatingReferral(true);

      const referrer = await findReferrer(cleanCode);

      if (!referrer) {
        setReferralError(
          "That referral code could not be found. Please check the code and try again."
        );

        return false;
      }

      setReferrerInfo(referrer);

      return true;
    } catch (err) {
      console.error("REFERRAL VALIDATION ERROR:", err);

      setReferralError(
        "We could not verify the referral code right now. Please try again."
      );

      return false;
    } finally {
      setValidatingReferral(false);
    }
  }

  async function generateUniqueReferralCode() {
    for (let attempt = 0; attempt < 10; attempt++) {
      const newCode = generateReferralCode();

      const codeQuery = query(
        collection(db, "users"),
        where("referralCode", "==", newCode)
      );

      const snapshot = await getDocs(codeQuery);

      if (snapshot.empty) {
        return newCode;
      }
    }

    throw new Error(
      "Unable to generate a unique referral code."
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setReferralError("");

    const cleanFullName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanReferralCode =
      referralCode.trim().toUpperCase();

    if (!allConsentsAccepted) {
      setError(
        "Please review and accept all required documents before continuing."
      );
      return;
    }

    if (!cleanFullName) {
      setError("Please enter your full name.");
      return;
    }

    if (!cleanPhone) {
      setError("Please enter your phone number.");
      return;
    }

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Your password must contain at least 6 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      /*
       * Validate the referral BEFORE creating the account.
       * This prevents an invalid referral code from being
       * attached to the new account.
       */
      let validatedReferrer: ReferrerInfo | null = null;

      if (cleanReferralCode) {
        validatedReferrer = await findReferrer(
          cleanReferralCode
        );

        if (!validatedReferrer) {
          setReferralError(
            "That referral code could not be found. Please check the code and try again."
          );

          setLoading(false);
          return;
        }
      }

      /*
       * Generate the new user's own referral code.
       */
      const ownReferralCode =
        await generateUniqueReferralCode();

      /*
       * Create Firebase Authentication account.
       */
      const user = await registerUser(
        cleanEmail,
        password,
        cleanFullName
      );

      /*
       * Create the user's Firestore profile.
       *
       * referralCode = THIS USER'S OWN referral code.
       */
      await createUserProfile({
        userId: user.uid,
        fullName: cleanFullName,
        phone: cleanPhone,
        email: cleanEmail,
        referralCode: ownReferralCode,
      });

      /*
       * If the user registered through another user's
       * referral link, save the relationship.
       */
      if (validatedReferrer) {
        const newReferralRef = await addDoc(
          collection(db, "referrals"),
          {
            referrerUserId: validatedReferrer.userId,
            referredUserId: user.uid,

            referralCode:
              validatedReferrer.referralCode,

            referredName: cleanFullName,

            status: "REGISTERED",

            registeredAt: serverTimestamp(),

            depositApprovedAt: null,
            qualifiedAt: null,

            commissionAmount: 50,
          }
        );

        console.log(
          "Referral relationship created:",
          newReferralRef.id
        );
      }

      /*
       * Save the five required consent records.
       */
      await saveUserConsents(user.uid);

      /*
       * Registration completed.
       */
      navigate("/dashboard", {
        replace: true,
      });
    } catch (err: any) {
      console.error("REGISTRATION ERROR:", err);

      /*
       * If Firebase Auth has already created the account but
       * another operation failed, don't expose internal
       * Firebase errors to the user.
       */
      setError(
        getRegisterErrorMessage(err?.code || "")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link
          to="/"
          className="auth-brand"
          aria-label="XS Company Limited"
        >
          <span className="brand-x">X</span>
          <span className="brand-s">S</span>
        </Link>

        <div className="auth-heading">
          <p className="eyebrow">
            XS COMPANY LIMITED
          </p>

          <h1>Create your account</h1>

          <p>
            Create an XS account to access your dashboard,
            investment information and referral programme.
          </p>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          <div className="form-group">
            <label htmlFor="fullName">
              Full Name
            </label>

            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              placeholder="Enter your full name"
              autoComplete="name"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">
              Phone Number
            </label>

            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              placeholder="Enter your phone number"
              autoComplete="tel"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email address"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Create a password"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="referralCode">
              Referral Code
              <span
                style={{
                  fontWeight: 400,
                  marginLeft: "6px",
                  opacity: 0.7,
                }}
              >
                (optional)
              </span>
            </label>

            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(event) => {
                setReferralCode(
                  event.target.value.toUpperCase()
                );

                setReferralError("");
                setReferrerInfo(null);
              }}
              onBlur={() => {
                if (referralCode.trim()) {
                  validateReferralCode();
                }
              }}
              placeholder="e.g. XS123456"
              autoComplete="off"
              disabled={loading}
            />

            {validatingReferral && (
              <small>
                Checking referral code...
              </small>
            )}

            {referrerInfo && (
              <small
                style={{
                  color: "#20A464",
                  display: "block",
                  marginTop: "6px",
                }}
              >
                Referral code verified.
                {referrerInfo.fullName
                  ? ` Referred by ${referrerInfo.fullName}.`
                  : ""}
              </small>
            )}

            {referralError && (
              <small
                style={{
                  color: "#D64545",
                  display: "block",
                  marginTop: "6px",
                }}
              >
                {referralError}
              </small>
            )}
          </div>

          <div className="form-group">
            <div
              style={{
                marginBottom: "10px",
              }}
            >
              <strong>
                Before You Join XS
              </strong>

              <p
                style={{
                  marginTop: "5px",
                  fontSize: "0.9rem",
                  opacity: 0.75,
                }}
              >
                Please review and accept all five
                required documents before creating your
                account.
              </p>
            </div>

            {consentItems.map((item) => (
              <label
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginBottom: "12px",
                  cursor: loading
                    ? "not-allowed"
                    : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    consents[
                      item.key as keyof ConsentState
                    ]
                  }
                  onChange={() =>
                    handleConsentChange(
                      item.key as keyof ConsentState
                    )
                  }
                  disabled={loading}
                />

                <span>
                  <strong>
                    {item.title}
                  </strong>

                  <small
                    style={{
                      display: "block",
                      marginTop: "3px",
                      opacity: 0.75,
                    }}
                  >
                    {item.text}
                  </small>
                </span>
              </label>
            ))}
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={
              loading ||
              !allConsentsAccepted ||
              validatingReferral
            }
          >
            {loading
              ? "Creating account..."
              : "Continue to Registration"}
          </button>

          {!allConsentsAccepted && (
            <p
              style={{
                fontSize: "0.85rem",
                textAlign: "center",
                opacity: 0.7,
              }}
            >
              Please review and accept all required
              documents to continue.
            </p>
          )}
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login">
            Login
          </Link>
        </p>

        <p className="auth-footer">
          <Link to="/">
            Return to homepage
          </Link>
        </p>
      </div>
    </main>
  );
    }
