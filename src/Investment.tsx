import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

type InvestmentData = {
  status?: string;
  principalAmount?: number;
  investmentAmount?: number;
  dailyReturn?: number;
  totalReturns?: number;
  startedAt?: unknown;
  nextReturnAt?: unknown;
};

type Countdown = {
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
};

const DAILY_RETURN = 200;
const INVESTMENT_AMOUNT = 500;
const CYCLE_DAYS = 3;
const CYCLE_TOTAL_RETURN = DAILY_RETURN * CYCLE_DAYS;

function getNigeriaNow(): Date {
  /*
   * Nigeria uses West Africa Time (WAT), UTC+1.
   *
   * We use Intl to calculate the current Nigerian calendar/time values
   * instead of relying on the user's device timezone.
   */
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(new Date());

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  /*
   * Construct a UTC representation of the Nigerian clock.
   * Nigeria is UTC+1, so subtract one hour to obtain the
   * corresponding UTC timestamp.
   */
  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    ) - 60 * 60 * 1000
  );
}

function getNextNigeriaMidnight(): Date {
  const nigeriaNow = getNigeriaNow();

  const nextMidnight = new Date(nigeriaNow);

  nextMidnight.setUTCHours(23, 0, 0, 0);

  if (nextMidnight.getTime() <= nigeriaNow.getTime()) {
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  }

  return nextMidnight;
}

function calculateCountdown(target: Date): Countdown {
  const nigeriaNow = getNigeriaNow();

  const difference = Math.max(
    0,
    target.getTime() - nigeriaNow.getTime()
  );

  const totalSeconds = Math.floor(difference / 1000);

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    totalMilliseconds: difference,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(value: unknown): string {
  if (!value) return "—";

  try {
    let date: Date | null = null;

    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      date = (value as { toDate: () => Date }).toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === "string") {
      date = new Date(value);
    } else if (typeof value === "number") {
      date = new Date(value);
    }

    if (!date || Number.isNaN(date.getTime())) {
      return "—";
    }

    return new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return "—";
  }
}

export default function Investment() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [investment, setInvestment] =
    useState<InvestmentData | null>(null);

  const [countdown, setCountdown] = useState<Countdown>(() =>
    calculateCountdown(getNextNigeriaMidnight())
  );

  const [currentNigeriaTime, setCurrentNigeriaTime] = useState("");

  const [returnProcessedMessage, setReturnProcessedMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        /*
         * The investment record belongs to the authenticated UID.
         *
         * This page READS the investment information.
         * It does not allow the browser to change the investment.
         */
        const investmentRef = doc(
          db,
          "investments",
          user.uid
        );

        const snapshot = await getDoc(investmentRef);

        if (snapshot.exists()) {
          setInvestment(snapshot.data() as InvestmentData);
        } else {
          setInvestment(null);
        }
      } catch (error) {
        console.error("Investment loading error:", error);
        setInvestment(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    function updateClock() {
      const nigeriaNow = getNigeriaNow();

      setCurrentNigeriaTime(
        new Intl.DateTimeFormat("en-NG", {
          timeZone: "Africa/Lagos",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(nigeriaNow)
      );

      const nextMidnight = getNextNigeriaMidnight();

      const nextCountdown =
        calculateCountdown(nextMidnight);

      setCountdown(nextCountdown);

      /*
       * When the Nigerian clock reaches midnight, the display
       * resets for the next day.
       *
       * IMPORTANT:
       * This does NOT directly credit money.
       *
       * The actual ₦200 balance credit must be performed by
       * the trusted financial-processing logic.
       */
      if (nextCountdown.totalMilliseconds === 0) {
        setReturnProcessedMessage(
          "The new Nigerian day has started. Your daily return is now due for processing."
        );

        setTimeout(() => {
          setReturnProcessedMessage("");
        }, 5000);
      }
    }

    updateClock();

    const interval = window.setInterval(updateClock, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const investmentAmount = useMemo(() => {
    return (
      investment?.investmentAmount ??
      investment?.principalAmount ??
      INVESTMENT_AMOUNT
    );
  }, [investment]);

  const dailyReturn =
    investment?.dailyReturn ?? DAILY_RETURN;

  const totalReturns =
    investment?.totalReturns ?? CYCLE_TOTAL_RETURN;

  const isActive =
    investment?.status?.toUpperCase() === "ACTIVE";

  if (loading) {
    return (
      <main className="investment-page">
        <div className="investment-loading">
          <div className="investment-loader" />

          <p>Loading your investment...</p>
        </div>
      </main>
    );
  }

  if (!investment || !isActive) {
    return (
      <main className="investment-page">
        <div className="investment-container">
          <header className="investment-header">
            <Link
              to="/dashboard"
              className="investment-brand"
            >
              <span className="investment-brand-x">
                X
              </span>

              <span className="investment-brand-s">
                S
              </span>

              <span className="investment-brand-name">
                Company Limited
              </span>
            </Link>
          </header>

          <section className="investment-empty">
            <div className="investment-empty-icon">
              ◷
            </div>

            <p className="investment-eyebrow">
              XS COMPANY LIMITED
            </p>

            <h1>No Active Investment</h1>

            <p>
              Your investment has not been activated yet.
              Make a minimum deposit of ₦500 and wait for
              administrator approval.
            </p>

            <Link
              to="/deposit"
              className="investment-primary-button"
            >
              Deposit to invest
            </Link>

            <Link
              to="/dashboard"
              className="investment-back-link"
            >
              Return to dashboard
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="investment-page">
      <div className="investment-background" />

      <div className="investment-overlay" />

      <div className="investment-container">
        {/* HEADER */}
        <header className="investment-header">
          <Link
            to="/dashboard"
            className="investment-brand"
            aria-label="Return to XS dashboard"
          >
            <span className="investment-brand-x">
              X
            </span>

            <span className="investment-brand-s">
              S
            </span>

            <span className="investment-brand-name">
              Company Limited
            </span>
          </Link>

          <Link
            to="/dashboard"
            className="investment-dashboard-link"
          >
            Dashboard
          </Link>
        </header>

        {/* MAIN INVESTMENT PANEL */}
        <section className="investment-panel">
          <div className="investment-panel-heading">
            <div>
              <p className="investment-eyebrow">
                XS COMPANY LIMITED
              </p>

              <h1>Active Investment</h1>

              <p className="investment-subtitle">
                Your investment is currently active.
              </p>
            </div>

            <span className="investment-status">
              <span className="investment-status-dot" />
              ACTIVE
            </span>
          </div>

          {/* LARGE COUNTDOWN */}
          <section className="investment-countdown-section">
            <p className="countdown-label">
              NEXT DAILY RETURN
            </p>

            <div
              className="countdown-clock"
              aria-label={`Time remaining until the next Nigerian midnight: ${countdown.hours} hours, ${countdown.minutes} minutes, and ${countdown.seconds} seconds`}
            >
              <div className="countdown-ring">
                <div className="countdown-inner">
                  <span className="countdown-time">
                    {pad(countdown.hours)}:
                    {pad(countdown.minutes)}:
                    {pad(countdown.seconds)}
                  </span>

                  <span className="countdown-caption">
                    HOURS : MINUTES : SECONDS
                  </span>
                </div>
              </div>
            </div>

            <div className="nigeria-time">
              <span>🇳🇬 Nigeria time</span>

              <strong>{currentNigeriaTime}</strong>
            </div>

            <p className="midnight-message">
              Daily return is scheduled for
              <strong> 12:00 AM WAT</strong>.
            </p>
          </section>

          {/* RETURN */}
          <section className="daily-return-card">
            <div>
              <span className="daily-return-label">
                DAILY RETURN
              </span>

              <strong>₦{dailyReturn.toLocaleString()}</strong>

              <p>
                Next scheduled return
              </p>
            </div>

            <div className="daily-return-icon">
              ₦
            </div>
          </section>

          {/* INVESTMENT DETAILS */}
          <section className="investment-details">
            <div className="investment-detail">
              <span>Investment amount</span>

              <strong>
                ₦{Number(investmentAmount).toLocaleString()}
              </strong>
            </div>

            <div className="investment-detail">
              <span>Daily return</span>

              <strong>
                ₦{Number(dailyReturn).toLocaleString()}
              </strong>
            </div>

            <div className="investment-detail">
              <span>3-day cycle return</span>

              <strong>
                ₦{Number(totalReturns).toLocaleString()}
              </strong>
            </div>

            <div className="investment-detail">
              <span>Cycle duration</span>

              <strong>{CYCLE_DAYS} Days</strong>
            </div>
          </section>

          {/* START DATE */}
          <section className="investment-start">
            <span>Investment started</span>

            <strong>
              {formatDate(investment.startedAt)}
            </strong>
          </section>

          {/* INFORMATION */}
          <section className="investment-notice">
            <strong>
              Your investment is currently active.
            </strong>

            <p>
              The countdown follows Nigeria's West Africa
              Time (WAT). The next daily return is scheduled
              for 12:00 AM Nigerian time.
            </p>
          </section>

          {returnProcessedMessage && (
            <div
              className="investment-success-message"
              role="status"
            >
              {returnProcessedMessage}
            </div>
          )}

          <Link
            to="/dashboard"
            className="investment-dashboard-button"
          >
            Back to Dashboard
          </Link>
        </section>
      </div>
    </main>
  );
}
