import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import {
  processDailyReturn,
  formatReturnAmount,
} from "./returnLogic";

type InvestmentData = {
  status?: string;
  principalAmount?: number;
  investmentAmount?: number;
  dailyReturn?: number;
  totalReturns?: number;
  cycleDays?: number;
  startedAt?: unknown;
  nextReturnAt?: unknown;
  lastReturnDate?: string;
  returnsProcessed?: number;
};

type Countdown = {
  hours: number;
  minutes: number;
  seconds: number;
  totalMilliseconds: number;
};

/*
 * ============================================================
 * XS COMPANY LIMITED
 * INVESTMENT PAGE
 * ============================================================
 *
 * CURRENT PLAN
 *
 * Minimum investment: ₦500
 * Daily return:       ₦200
 *
 * RETURN PROCESSING
 *
 * The daily return is processed through returnLogic.ts.
 *
 * No Cloud Functions are used.
 *
 * The return is checked:
 *
 * 1. When the user opens this page.
 * 2. When the Nigerian calendar day changes while
 *    this page remains open.
 *
 * returnLogic.ts prevents duplicate same-day credits.
 * ============================================================
 */

const DEFAULT_INVESTMENT_AMOUNT = 500;
const DEFAULT_DAILY_RETURN = 200;
const DEFAULT_CYCLE_DAYS = 3;

const DEFAULT_CYCLE_TOTAL_RETURN =
  DEFAULT_DAILY_RETURN * DEFAULT_CYCLE_DAYS;

/*
 * ============================================================
 * NIGERIAN TIME
 * ============================================================
 *
 * Nigeria uses West Africa Time (WAT), UTC+1.
 *
 * We intentionally calculate the Nigerian calendar date
 * rather than depending on the user's device timezone.
 * ============================================================
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
   * The Date created here represents the Nigerian clock
   * in a UTC-based calculation.
   *
   * Nigeria is UTC+1, so subtract one hour.
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
 * ============================================================
 * NIGERIAN DATE KEY
 * ============================================================
 *
 * Example:
 *
 * 2026-10-02
 *
 * This is used to detect when Nigeria enters a new day.
 * ============================================================
 */

function getNigeriaDateKey(): string {
  const nigeriaNow = getNigeriaNow();

  return [
    nigeriaNow.getUTCFullYear(),

    String(
      nigeriaNow.getUTCMonth() + 1
    ).padStart(2, "0"),

    String(
      nigeriaNow.getUTCDate()
    ).padStart(2, "0"),
  ].join("-");
}

/*
 * ============================================================
 * NEXT NIGERIAN MIDNIGHT
 * ============================================================
 */

function getNextNigeriaMidnight(): Date {
  const nigeriaNow = getNigeriaNow();

  const nextMidnight = new Date(nigeriaNow);

  /*
   * 23:00 UTC representation = 12:00 AM Nigeria time.
   */
  nextMidnight.setUTCHours(
    23,
    0,
    0,
    0
  );

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
 * ============================================================
 * COUNTDOWN
 * ============================================================
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
 * ============================================================
 * PAD COUNTDOWN NUMBERS
 * ============================================================
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/*
 * ============================================================
 * MONEY FORMATTER
 * ============================================================
 */

function formatMoney(
  value: number
): string {
  return Number(value || 0).toLocaleString(
    "en-NG"
  );
}

/*
 * ============================================================
 * FIRESTORE DATE FORMATTER
 * ============================================================
 *
 * Handles:
 *
 * - Firebase Timestamp
 * - JavaScript Date
 * - ISO strings
 * - numbers
 * ============================================================
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
    } else if (
      value instanceof Date
    ) {
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

/*
 * ============================================================
 * INVESTMENT PAGE
 * ============================================================
 */

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
   * Used internally to prevent the midnight
   * processing effect from running more than
   * once for the same detected Nigerian date.
   */
  const [processedDateKey, setProcessedDateKey] =
    useState("");

  /*
   * ==========================================================
   * LOAD INVESTMENT + PROCESS DUE RETURN
   * ==========================================================
   *
   * When the authenticated user enters the Investment page:
   *
   * 1. Confirm authentication.
   * 2. Run the daily-return processor.
   * 3. Reload the investment document.
   *
   * The transaction inside returnLogic.ts prevents
   * duplicate processing.
   */

  useEffect(() => {
    let cancelled = false;

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
            /*
             * --------------------------------------------------
             * STEP 1
             * Process any return that is currently due.
             * --------------------------------------------------
             *
             * It is safe to call this when a return is not due.
             * returnLogic.ts simply returns an appropriate result.
             */

            const returnResult =
              await processDailyReturn(
                user.uid
              );

            if (cancelled) {
              return;
            }

            /*
             * --------------------------------------------------
             * STEP 2
             * Display a success message if a return
             * was actually credited.
             * --------------------------------------------------
             */

            if (
              returnResult.processed &&
              returnResult.amount > 0
            ) {
              setReturnDueMessage(
                `${formatReturnAmount(
                  returnResult.amount
                )} daily return has been added to your balance.`
              );
            } else {
              setReturnDueMessage("");
            }

            /*
             * --------------------------------------------------
             * STEP 3
             * Reload the investment AFTER processing.
             *
             * This ensures the page displays the newest:
             *
             * - totalReturns
             * - nextReturnAt
             * - lastReturnDate
             * - returnsProcessed
             * --------------------------------------------------
             */

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

            if (cancelled) {
              return;
            }

            if (snapshot.exists()) {
              setInvestment(
                snapshot.data() as InvestmentData
              );
            } else {
              setInvestment(null);
            }

            /*
             * Store the current Nigerian date.
             * This is used by the midnight watcher below.
             */

            setProcessedDateKey(
              getNigeriaDateKey()
            );
          } catch (error) {
            if (cancelled) {
              return;
            }

            console.error(
              "Investment/return processing error:",
              error
            );

            /*
             * We still attempt to load the investment.
             *
             * This means a temporary return-processing problem
             * does not unnecessarily hide the user's investment.
             */

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

              if (cancelled) {
                return;
              }

              if (snapshot.exists()) {
                setInvestment(
                  snapshot.data() as InvestmentData
                );
              } else {
                setInvestment(null);
              }
            } catch (loadError) {
              console.error(
                "Investment loading error:",
                loadError
              );

              if (!cancelled) {
                setInvestment(null);
              }
            }
          } finally {
            if (!cancelled) {
              setLoading(false);
            }
          }
        }
      );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigate]);

  /*
   * ============================================================
   * NIGERIAN CLOCK + MIDNIGHT RETURN PROCESSOR
   * ============================================================
   *
   * This runs every second.
   *
   * The page does NOT process a return every second.
   *
   * It only calls processDailyReturn() when the Nigerian
   * calendar date changes.
   *
   * Example:
   *
   * 11:59:59 PM
   *       ↓
   * 12:00:00 AM
   *       ↓
   * New Nigerian date detected
   *       ↓
   * processDailyReturn()
   *
   * returnLogic.ts handles whether the return is actually due
   * and prevents duplicate credits.
   */

  useEffect(() => {
    let previousNigeriaDate =
      getNigeriaDateKey();

    let midnightProcessing = false;

    async function processMidnightReturn() {
      if (midnightProcessing) {
        return;
      }

      midnightProcessing = true;

      try {
        const user =
          auth.currentUser;

        if (!user) {
          return;
        }

        /*
         * Only process if the user's investment
         * is active.
         */

        const investmentRef =
          doc(
            db,
            "investments",
            user.uid
          );

        const investmentSnapshot =
          await getDoc(
            investmentRef
          );

        if (
          !investmentSnapshot.exists()
        ) {
          return;
        }

        const currentInvestment =
          investmentSnapshot.data() as InvestmentData;

        if (
          currentInvestment.status?.toUpperCase() !==
          "ACTIVE"
        ) {
          return;
        }

        /*
         * Process the new day's return.
         */

        const result =
          await processDailyReturn(
            user.uid
          );

        if (
          result.processed &&
          result.amount > 0
        ) {
          setReturnDueMessage(
            `${formatReturnAmount(
              result.amount
            )} daily return has been added to your balance.`
          );
        }

        /*
         * Reload investment so the screen immediately
         * reflects the new total and next return time.
         */

        const refreshedSnapshot =
          await getDoc(
            investmentRef
          );

        if (
          refreshedSnapshot.exists()
        ) {
          setInvestment(
            refreshedSnapshot.data() as InvestmentData
          );
        }
      } catch (error) {
        console.error(
          "Midnight return processing error:",
          error
        );
      } finally {
        midnightProcessing = false;
      }
    }

    function updateClock() {
      const nigeriaNow =
        getNigeriaNow();

      const dateKey =
        getNigeriaDateKey();

      /*
       * Display current Nigerian time.
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
       * Update countdown to next Nigerian midnight.
       */

      const nextMidnight =
        getNextNigeriaMidnight();

      setCountdown(
        calculateCountdown(
          nextMidnight
        )
      );

      /*
       * Detect Nigerian date change.
       */

      if (
        previousNigeriaDate !==
        dateKey
      ) {
        previousNigeriaDate =
          dateKey;

        /*
         * Do not show the old message saying
         * the return is merely "due for processing".
         *
         * Actually attempt the processing.
         */

        void processMidnightReturn();
      }

      /*
       * Keep the variable used so TypeScript does not
       * consider nigeriaNow unused in future edits.
       */

      void nigeriaNow;
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
   * ============================================================
   * INVESTMENT DISPLAY VALUES
   * ============================================================
   */

  const investmentAmount =
    useMemo(() => {
      return (
        investment?.investmentAmount ??
        investment?.principalAmount ??
        DEFAULT_INVESTMENT_AMOUNT
      );
    }, [investment]);

  const dailyReturn =
    investment?.dailyReturn ??
    DEFAULT_DAILY_RETURN;

  /*
   * IMPORTANT:
   *
   * totalReturns is the amount actually accumulated
   * by the return processor.
   *
   * We do not want the page to invent a total return
   * if Firestore does not contain one.
   *
   * However, the fallback is retained for compatibility
   * with an older investment document.
   */

  const totalReturns =
    investment?.totalReturns ??
    DEFAULT_CYCLE_TOTAL_RETURN;

  const cycleDays =
    investment?.cycleDays ??
    DEFAULT_CYCLE_DAYS;

  /*
   * Only ACTIVE investments display the active
   * investment screen.
   */

  const isActive =
    investment?.status?.toUpperCase() ===
    "ACTIVE";

  /*
   * ============================================================
   * LOADING SCREEN
   * ============================================================
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
   * ============================================================
   * NO ACTIVE INVESTMENT
   * ============================================================
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
   * ============================================================
   * ACTIVE INVESTMENT SCREEN
   * ============================================================
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
            aria-label="Return to XS d          <Link
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

          {/* SUCCESS MESSAGE */}

          {returnDueMessage && (
            <div
              className="investment-success-message"
              role="status"
              aria-live="polite"
            >
              {returnDueMessage}
            </div>
          )}

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
