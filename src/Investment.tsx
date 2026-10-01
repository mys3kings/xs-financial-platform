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
  cycleDays?: number;
  startedAt?: unknown;
  nextReturnAt?: unknown;
};

type Countdown = {
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
};

/*
 * XS INVESTMENT SETTINGS
 *
 * These are the default values for the current
 * XS investment plan.
 *
 * The actual approved investment record in
 * Firestore takes priority over these defaults.
 */
const DEFAULT_INVESTMENT_AMOUNT = 500;
const DEFAULT_DAILY_RETURN = 200;
const DEFAULT_CYCLE_DAYS = 3;
const DEFAULT_CYCLE_TOTAL_RETURN =
  DEFAULT_DAILY_RETURN * DEFAULT_CYCLE_DAYS;

/*
 * Nigeria uses West Africa Time (WAT), UTC+1.
 *
 * This function gets the current Nigerian
 * calendar date and clock time regardless of
 * the user's device timezone.
 */
function getNigeriaNow(): Date {
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
   * Create a Date representing the Nigerian clock.
   *
   * The constructed UTC timestamp is shifted back
   * by one hour because Nigeria is UTC+1.
   */
  return new Date(
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    ) -
      60 * 60 * 1000
  );
}

/*
 * Get the next 12:00 AM Nigerian time.
 */
function getNextNigeriaMidnight(): Date {
  const nigeriaNow = getNigeriaNow();

  const nextMidnight = new Date(nigeriaNow);

  /*
   * 23:00 UTC representation = 12:00 AM Nigeria time.
   */
  nextMidnight.setUTCHours(23, 0, 0, 0);

  if (
    nextMidnight.getTime() <=
    nigeriaNow.getTime()
  ) {
    nextMidnight.setUTCDate(
      nextMidnight.getUTCDate() + 1
    );
  }

  return nextMidnight;
}

/*
 * Calculate the time remaining until the target.
 */
function calculateCountdown(
  target: Date
): Countdown {
  const nigeriaNow = getNigeriaNow();

  const difference = Math.max(
    0,
    target.getTime() -
      nigeriaNow.getTime()
  );

  const totalSeconds = Math.floor(
    difference / 1000
  );

  return {
    hours: Math.floor(
      totalSeconds / 3600
    ),

    minutes: Math.floor(
      (totalSeconds % 3600) / 60
    ),

    seconds: totalSeconds % 60,

    totalMilliseconds: difference,
  };
}

/*
 * Always display countdown numbers as two digits.
 */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/*
 * Format money using Nigerian Naira formatting.
 */
function formatMoney(
  value: number
): string {
  return Number(value || 0).toLocaleString(
    "en-NG"
  );
}

/*
 * Safely format Firebase timestamps,
 * JavaScript Dates, strings and numbers.
 */
function formatDate(
  value: unknown
): string {
  if (!value) {
    return "—";
  }

  try {
    let date: Date | null = null;

    if (
      typeof value === "object" &&
      value !== null &&
      "toDate" in value &&
      typeof (
        value as {
          toDate?: unknown;
        }
      ).toDate === "function"
    ) {
      date = (
        value as {
          toDate: () => Date;
        }
      ).toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (
      typeof value === "string"
    ) {
      date = new Date(value);
    } else if (
      typeof value === "number"
    ) {
      date = new Date(value);
    }

    if (
      !date ||
      Number.isNaN(date.getTime())
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "en-NG",
      {
        timeZone: "Africa/Lagos",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    ).format(date);
  } catch {
    return "—";
  }
}

export default function Investment() {
  const navigate = useNavigate();

  const [loading, setLoading] =
    useState(true);

  const [investment, setInvestment] =
    useState<InvestmentData | null>(null);

  const [countdown, setCountdown] =
    useState<Countdown>(() =>
      calculateCountdown(
        getNextNigeriaMidnight()
      )
    );

  const [currentNigeriaTime, setCurrentNigeriaTime] =
    useState("");

  const [returnDueMessage, setReturnDueMessage] =
    useState("");

  /*
   * Authenticate the user and load their
   * approved investment from Firestore.
   *
   * This page only READS the investment.
   * It does not change the user's balance.
   */
  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            navigate("/login", {
              replace: true,
            });

            return;
          }

          try {
            const investmentRef =
              doc(
                db,
                "investments",
                user.uid
              );

            const snapshot =
              await getDoc(
                investmentRef
              );

            if (snapshot.exists()) {
              setInvestment(
                snapshot.data() as InvestmentData
              );
            } else {
              setInvestment(null);
            }
          } catch (error) {
            console.error(
              "Investment loading error:",
              error
            );

            setInvestment(null);
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [navigate]);

  /*
   * Nigerian-time countdown.
   *
   * The countdown is recalculated every second,
   * so it does not depend on the user's local
   * timezone.
   */
  useEffect(() => {
    let previousNigeriaDate = "";

    function updateClock() {
      const nigeriaNow =
        getNigeriaNow();

      const dateKey = [
        nigeriaNow.getUTCFullYear(),

        String(
          nigeriaNow.getUTCMonth() + 1
        ).padStart(2, "0"),

        String(
          nigeriaNow.getUTCDate()
        ).padStart(2, "0"),
      ].join("-");

      /*
       * Display the current Nigerian time.
       */
      setCurrentNigeriaTime(
        new Intl.DateTimeFormat(
          "en-NG",
          {
            timeZone: "Africa/Lagos",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }
        ).format(new Date())
      );

      /*
       * Always calculate the next Nigerian midnight.
       */
      const nextMidnight =
        getNextNigeriaMidnight();

      setCountdown(
        calculateCountdown(
          nextMidnight
        )
      );

      /*
       * Detect when Nigeria moves into
       * a new calendar day.
       *
       * We do not credit money here.
       * Actual balance processing must be
       * handled by a trusted system.
       */
      if (
        previousNigeriaDate &&
        previousNigeriaDate !==
          dateKey
      ) {
        setReturnDueMessage(
          "A new Nigerian day has started. Your daily return is now due for processing."
        );
      }

      previousNigeriaDate = dateKey;
    }

    updateClock();

    const interval =
      window.setInterval(
        updateClock,
        1000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  /*
   * Use the approved investment amount
   * from Firestore when available.
   */
  const investmentAmount =
    useMemo(() => {
      return (
        investment?.investmentAmount ??
        investment?.principalAmount ??
        DEFAULT_INVESTMENT_AMOUNT
      );
    }, [investment]);

  /*
   * Use the approved daily return from
   * Firestore when available.
   */
  const dailyReturn =
    investment?.dailyReturn ??
    DEFAULT_DAILY_RETURN;

  /*
   * Use the approved total return from
   * Firestore when available.
   */
  const totalReturns =
    investment?.totalReturns ??
    DEFAULT_CYCLE_TOTAL_RETURN;

  /*
   * Use the investment's cycle duration
   * when it exists.
   */
  const cycleDays =
    investment?.cycleDays ??
    DEFAULT_CYCLE_DAYS;

  /*
   * Only an ACTIVE investment should
   * display the active investment screen.
   */
  const isActive =
    investment?.status?.toUpperCase() ===
    "ACTIVE";

  /*
   * Loading screen.
   */
  if (loading) {
    return (
      <main className="investment-page">
        <div className="investment-loading">
          <div className="investment-loader" />

          <p>
            Loading your investment...
          </p>
        </div>
      </main>
    );
  }

  /*
   * No investment / inactive investment.
   */
  if (!investment || !isActive) {
    return (
      <main className="investment-page">
        <div className="investment-container">
          <header className="investment-header">
            <Link
              to="/dashboard"
              className="investment-brand"
              aria-label="Return to dashboard"
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

            <h1>
              No Active Investment
            </h1>

            <p>
              Your investment has not
              been activated yet. Make
              a minimum deposit of ₦500
              and wait for administrator
              approval.
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

  /*
   * ACTIVE INVESTMENT SCREEN
   */
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

              <h1>
                Active Investment
              </h1>

              <p className="investment-subtitle">
                Your investment is
                currently active.
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
                    {pad(
                      countdown.hours
                    )}
                    :
                    {pad(
                      countdown.minutes
                    )}
                    :
                    {pad(
                      countdown.seconds
                    )}
                  </span>

                  <span className="countdown-caption">
                    HOURS : MINUTES :
                    SECONDS
                  </span>
                </div>
              </div>
            </div>

            <div className="nigeria-time">
              <span>
                🇳🇬 Nigeria time
              </span>

              <strong>
                {currentNigeriaTime}
              </strong>
            </div>

            <p className="midnight-message">
              Daily return is
              scheduled for
              <strong>
                {" "}
                12:00 AM WAT
              </strong>
              .
            </p>
          </section>

          {/* DAILY RETURN */}
          <section className="daily-return-card">
            <div>
              <span className="daily-return-label">
                DAILY RETURN
              </span>

              <strong>
                ₦
                {formatMoney(
                  dailyReturn
                )}
              </strong>

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
              <span>
                Investment amount
              </span>

              <strong>
                ₦
                {formatMoney(
                  investmentAmount
                )}
              </strong>
            </div>

            <div className="investment-detail">
              <span>
                Daily return
              </span>

              <strong>
                ₦
                {formatMoney(
                  dailyReturn
                )}
              </strong>
            </div>

            <div className="investment-detail">
              <span>
                {cycleDays}-day cycle
                return
              </span>

              <strong>
                ₦
                {formatMoney(
                  totalReturns
                )}
              </strong>
            </div>

            <div className="investment-detail">
              <span>
                Cycle duration
              </span>

              <strong>
                {cycleDays} Days
              </strong>
            </div>
          </section>

          {/* START DATE */}
          <section className="investment-start">
            <span>
              Investment started
            </span>

            <strong>
              {formatDate(
                investment.startedAt
              )}
            </strong>
          </section>

          {/* INFORMATION */}
          <section className="investment-notice">
            <strong>
              Your investment is
              currently active.
            </strong>

            <p>
              The countdown follows
              Nigeria's West Africa
              Time (WAT). The next
              daily return is scheduled
              for 12:00 AM Nigerian
              time.
            </p>
          </section>

          {/* MIDNIGHT MESSAGE */}
          {returnDueMessage && (
            <div
              className="investment-success-message"
              role="status"
            >
              {returnDueMessage}
            </div>
          )}

          {/* DASHBOARD BUTTON */}
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
