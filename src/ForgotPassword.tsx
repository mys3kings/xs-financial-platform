import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";

import { auth } from "./firebase";

function getResetErrorMessage(code: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/too-many-requests":
      return "Too many requests. Please wait a while and try again.";

    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";

    default:
      return "We couldn't send the password reset email. Please try again.";
  }
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess(false);

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(
        auth,
        cleanEmail
      );

      setSuccess(true);
      setEmail("");
    } catch (err: any) {
      console.error(
        "PASSWORD RESET ERROR:",
        err
      );

      setError(
        getResetErrorMessage(
          err?.code || ""
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-brand">
          <span className="brand-x">X</span>
          <span className="brand-s">S</span>
        </Link>

        <div className="auth-heading">
          <p className="eyebrow">
            XS COMPANY LIMITED
          </p>

          <h1>Reset your password</h1>

          <p>
            Enter the email address connected to your
            XS account and we'll send you a password
            reset link.
          </p>
        </div>

        {success && (
          <div
            className="auth-success"
            role="status"
          >
            Password reset email sent. Check your
            email inbox and follow the instructions
            to create a new password.
          </div>
        )}

        {error && (
          <div
            className="auth-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >
          <div className="form-group">
            <label htmlFor="reset-email">
              Email Address
            </label>

            <input
              id="reset-email"
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

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : "Send Reset Link"}
          </button>
        </form>

        <p className="auth-footer">
          Remember your password?{" "}
          <Link to="/login">
            Back to Login
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
