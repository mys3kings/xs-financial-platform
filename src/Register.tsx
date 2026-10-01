import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "./auth";
import { saveUserConsents } from "./consents";
import { createUserProfile } from "./users";

const consentItems = [
  {
    key: "terms",
    title: "Terms & Conditions",
    text: "I have read and agree to the Terms & Conditions.",
  },
  {
    key: "privacy",
    title: "Privacy Policy & Data Usage",
    text: "I understand how XS collects and uses my information.",
  },
  {
    key: "investment",
    title: "Investment Terms & Risk Disclosure",
    text: "I have read the investment terms and understand that investment activities involve risk.",
  },
  {
    key: "referral",
    title: "Referral Program Terms",
    text: "I understand the requirements and conditions of the XS referral programme.",
  },
  {
    key: "platform",
    title: "Platform Structure & How XS Works",
    text: "I have read and understand how the XS platform operates.",
  },
] as const;

type ConsentKey = (typeof consentItems)[number]["key"];

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    referralCode: "",
  });

  const [consents, setConsents] = useState<Record<ConsentKey, boolean>>({
    terms: false,
    privacy: false,
    investment: false,
    referral: false,
    platform: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allConsentsAccepted = Object.values(consents).every(Boolean);

  function updateField(
    field: keyof typeof form,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleConsent(key: ConsentKey) {
    setConsents((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!allConsentsAccepted) {
      setError(
        "Please read and accept all five documents before creating your account."
      );
      return;
    }

    if (!form.fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (form.password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      console.log("XS REGISTER: Starting registration...");

      // =====================================================
      // STEP 1 — FIREBASE AUTHENTICATION
      // =====================================================

      let user;

      try {
        user = await registerUser(
          form.email.trim(),
          form.password,
          form.fullName.trim()
        );

        console.log(
          "XS REGISTER: Authentication successful.",
          user.uid
        );
      } catch (authError: unknown) {
        const authErr = authError as {
          code?: string;
          message?: string;
        };

        console.error("XS REGISTER: AUTHENTICATION FAILED", authErr);

        throw new Error(
          `AUTH ERROR: ${authErr.code || "unknown"} — ${
            authErr.message || "Unknown authentication error"
          }`
        );
      }

      // =====================================================
      // STEP 2 — CREATE USER PROFILE
      // =====================================================

      try {
        console.log("XS REGISTER: Creating user profile...");

        await createUserProfile({
          userId: user.uid,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          referralCode: form.referralCode.trim(),
        });

        console.log(
          "XS REGISTER: User profile created successfully."
        );
      } catch (profileError: unknown) {
        const profileErr = profileError as {
          code?: string;
          message?: string;
        };

        console.error(
          "XS REGISTER: USER PROFILE FAILED",
          profileErr
        );

        throw new Error(
          `PROFILE ERROR: ${profileErr.code || "unknown"} — ${
            profileErr.message || "Unknown Firestore profile error"
          }`
        );
      }

      // =====================================================
      // STEP 3 — SAVE CONSENTS
      // =====================================================

      try {
        console.log("XS REGISTER: Saving consents...");

        await saveUserConsents(user.uid);

        console.log(
          "XS REGISTER: Consents saved successfully."
        );
      } catch (consentError: unknown) {
        const consentErr = consentError as {
          code?: string;
          message?: string;
        };

        console.error(
          "XS REGISTER: CONSENT SAVE FAILED",
          consentErr
        );

        throw new Error(
          `CONSENT ERROR: ${consentErr.code || "unknown"} — ${
            consentErr.message || "Unknown Firestore consent error"
          }`
        );
      }

      // =====================================================
      // STEP 4 — SUCCESS
      // =====================================================

      console.log("XS REGISTER: REGISTRATION COMPLETED.");

      navigate("/dashboard");
    } catch (err: unknown) {
      console.error(
        "XS REGISTER: COMPLETE REGISTRATION ERROR",
        err
      );

      const errorObject = err as {
        code?: string;
        message?: string;
      };

      let message =
        errorObject.message ||
        "An unknown error occurred during registration.";

      // Firebase Authentication errors
      if (errorObject.code === "auth/email-already-in-use") {
        message = "An account with this email already exists.";
      } else if (errorObject.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (errorObject.code === "auth/weak-password") {
        message = "Please choose a stronger password.";
      } else if (
        errorObject.code === "auth/network-request-failed"
      ) {
        message =
          "Network error. Please check your internet connection and try again.";
      } else if (
        errorObject.code === "permission-denied"
      ) {
        message =
          "Firestore permission denied. Please check the Firestore Rules.";
      }

      setError(message);
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
          <p className="eyebrow">XS Company Limited</p>

          <h1>Create your account</h1>

          <p>
            Enter your details below to create an XS account. Please
            read the information provided before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-grid">
            <label>
              Full name
              <input
                type="text"
                value={form.fullName}
                onChange={(event) =>
                  updateField("fullName", event.target.value)
                }
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </label>

            <label>
              Phone number
              <input
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  updateField("phone", event.target.value)
                }
                placeholder="Enter your phone number"
                autoComplete="tel"
                required
              />
            </label>
          </div>

          <label>
            Email address
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                updateField("email", event.target.value)
              }
              placeholder="Enter your email address"
              autoComplete="email"
              required
            />
          </label>

          <div className="form-grid">
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  updateField("password", event.target.value)
                }
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              Confirm password
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) =>
                  updateField(
                    "confirmPassword",
                    event.target.value
                  )
                }
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
            </label>
          </div>

          <label>
            Referral code
            <input
              type="text"
              value={form.referralCode}
              onChange={(event) =>
                updateField("referralCode", event.target.value)
              }
              placeholder="Enter referral code if you have one"
            />
          </label>

          <section className="consent-section">
            <div className="consent-heading">
              <h2>Before you continue</h2>

              <p>
                Please read each document and confirm that you
                understand the information provided.
              </p>
            </div>

            <div className="consent-list">
              {consentItems.map((item) => (
                <label
                  className="consent-item"
                  key={item.key}
                >
                  <input
                    type="checkbox"
                    checked={consents[item.key]}
                    onChange={() =>
                      toggleConsent(item.key)
                    }
                  />

                  <span className="consent-copy">
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="primary-button register-button"
            disabled={!allConsentsAccepted || loading}
          >
            {loading
              ? "Creating account..."
              : "Create account"}
          </button>

          <p className="auth-footer">
            Already have an account?{" "}
            <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
    </main>
  );
      }
