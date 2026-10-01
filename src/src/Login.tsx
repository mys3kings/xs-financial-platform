import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "./firebase";

function getLoginErrorMessage(code: string) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/user-disabled":
      return "This account has been disabled. Please contact XS support.";

    case "auth/too-many-requests":
      return "Too many unsuccessful login attempts. Please try again later.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";

    default:
      return "Unable to sign in right now. Please try again.";
  }
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState("");

  // If the user is already signed in, send them to the dashboard.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/dashboard", { replace: true });
      } else {
        setCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("LOGIN ERROR:", err);

      const code = err?.code || "";

      setError(getLoginErrorMessage(code));
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-x">X</span>
            <span className="brand-s">S</span>
          </div>

          <div className="auth-heading">
            <p className="eyebrow">XS Company Limited</p>
            <h1>Checking account...</h1>
            <p>Please wait.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          <span className="brand-x">X</span>
          <span className="brand-s">S</span>
        </Link>

        <div className="auth-heading">
          <p className="eyebrow">XS COMPANY LIMITED</p>

          <h1>Welcome back</h1>

          <p>
            Sign in to access your XS account and manage your
            investment activity.
          </p>
        </div>

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">
              Email Address
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <div className="password-label-row">
              <label htmlFor="password">
                Password
              </label>

              <button
                type="button"
                className="forgot-password"
                onClick={() =>
                  setError(
                    "Password reset will be connected next."
                  )
                }
              >
                Forgot password?
              </button>
            </div>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{" "}
          <Link to="/register">
            Create an account
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
