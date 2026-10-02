import {
  doc,
  getDoc,
  runTransaction,
  Timestamp,
} from "firebase/firestore";

import { db } from "./firebase";

/*
 * ============================================================
 * XS COMPANY LIMITED
 * DAILY RETURN LOGIC
 * ============================================================
 *
 * CURRENT BUSINESS SETTINGS
 *
 * Minimum investment: ₦500
 * Daily return:       ₦200
 * Cycle:              3 days
 * Maximum cycle return: ₦600
 *
 * RETURN BEHAVIOUR
 *
 * The return is processed when the user opens the
 * Investment page.
 *
 * Flow:
 *
 * User opens Investment page
 *          ↓
 * Check investment
 *          ↓
 * Is investment ACTIVE?
 *          ↓
 * Is return due?
 *          ↓
 * Has today's return already been processed?
 *          ↓
 * Credit ₦200
 *          ↓
 * Increase totalReturns
 *          ↓
 * Increase returnsProcessed
 *          ↓
 * Save today's Nigerian date
 *          ↓
 * Schedule next Nigerian midnight
 *
 * After 3 successful daily returns:
 *
 * returnsProcessed = 3
 * totalReturns     = ₦600
 * investment status = COMPLETED
 *
 * IMPORTANT:
 *
 * This is application-side logic.
 *
 * Firestore Security Rules must prevent ordinary users
 * from directly modifying balances, investments and
 * return-related fields.
 */


/* ============================================================
   TYPES
   ============================================================ */

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


type UserProfile = {
  balance?: number;

  referralEarnings?: number;

  fullName?: string;

  phone?: string;

  email?: string;

  referralCode?: string;
};


/* ============================================================
   RETURN PROCESS RESULT
   ============================================================ */

export type ReturnProcessResult = {
  success: boolean;

  credited: boolean;

  amountCredited: number;

  message: string;

  newBalance?: number;

  nigeriaDate?: string;
};


/* ============================================================
   CONSTANTS
   ============================================================ */

export const DEFAULT_DAILY_RETURN = 200;

export const DEFAULT_MINIMUM_INVESTMENT = 500;

export const DEFAULT_CYCLE_DAYS = 3;

export const DEFAULT_CYCLE_TOTAL_RETURN =
  DEFAULT_DAILY_RETURN *
  DEFAULT_CYCLE_DAYS;


/* ============================================================
   MONEY FORMATTER
   ============================================================ */

function formatReturnAmount(
  amount: number
): string {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  ).format(amount);
}


/* ============================================================
   NIGERIAN TIME
   ============================================================ */

/*
 * Nigeria uses West Africa Time.
 *
 * WAT = UTC + 1
 *
 * This function obtains the current Nigerian
 * date/time and converts it into the correct
 * JavaScript Date representing that instant.
 */

function getNigeriaNow(): Date {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Africa/Lagos",

        year: "numeric",

        month: "2-digit",

        day: "2-digit",

        hour: "2-digit",

        minute: "2-digit",

        second: "2-digit",

        hourCycle: "h23",
      }
    );

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const values: Record<
    string,
    string
  > = {};

  for (const part of parts) {
    if (
      part.type !== "literal"
    ) {
      values[part.type] =
        part.value;
    }
  }

  /*
   * Interpret the Nigerian clock as UTC,
   * then subtract one hour because Nigeria
   * is UTC+1.
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


/* ============================================================
   NIGERIAN DATE KEY
   ============================================================ */

export function getNigeriaDateKey(
  date: Date = getNigeriaNow()
): string {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Africa/Lagos",

        year: "numeric",

        month: "2-digit",

        day: "2-digit",
      }
    );

  return formatter.format(date);
}


/* ============================================================
   NEXT NIGERIAN MIDNIGHT
   ============================================================ */

/*
 * Returns the next 12:00 AM Nigerian time.
 *
 * Example:
 *
 * Current Nigerian time:
 * October 2, 2026 — 8:00 PM
 *
 * Result:
 * October 3, 2026 — 12:00 AM WAT
 */

export function getNextNigeriaMidnight(
  fromDate: Date = getNigeriaNow()
): Date {
  const nigeriaDate =
    getNigeriaDateKey(
      fromDate
    );

  const [
    year,
    month,
    day,
  ] = nigeriaDate
    .split("-")
    .map(Number);

  /*
   * Nigeria midnight is 23:00 UTC
   * on the previous UTC calendar day.
   */
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day + 1,
      0,
      0,
      0,
      0
    ) -
      60 * 60 * 1000
  );
}


/* ============================================================
   FIRESTORE DATE CONVERSION
   ============================================================ */

function toDate(
  value: unknown
): Date | null {
  if (!value) {
    return null;
  }

  /*
   * Firestore Timestamp
   */
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
    try {
      const date =
        (
          value as {
            toDate: () => Date;
          }
        ).toDate();

      if (
        date instanceof Date &&
        !Number.isNaN(
          date.getTime()
        )
      ) {
        return date;
      }
    } catch {
      return null;
    }
  }

  /*
   * JavaScript Date
   */
  if (
    value instanceof Date
  ) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }

  /*
   * Numeric timestamp
   */
  if (
    typeof value === "number"
  ) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  /*
   * String date
   */
  if (
    typeof value === "string"
  ) {
    const date =
      new Date(value);

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  return null;
}


/* ============================================================
   FIRESTORE TIMESTAMP
   ============================================================ */

function toTimestamp(
  date: Date
): Timestamp {
  return Timestamp.fromDate(
    date
  );
}


/* ============================================================
   NUMBER VALIDATION
   ============================================================ */

function safeNumber(
  value: unknown,
  fallback = 0
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  if (value < 0) {
    return fallback;
  }

  return value;
}


/* ============================================================
   PROCESS DAILY RETURN
   ============================================================ */

export async function processDailyReturn(
  uid: string
): Promise<ReturnProcessResult> {
  if (
    !uid ||
    typeof uid !== "string"
  ) {
    return {
      success: false,

      credited: false,

      amountCredited: 0,

      message:
        "A valid user account is required.",
    };
  }

  const nigeriaNow =
    getNigeriaNow();

  const nigeriaDate =
    getNigeriaDateKey(
      nigeriaNow
    );

  const userRef =
    doc(
      db,
      "users",
      uid
    );

  const investmentRef =
    doc(
      db,
      "investments",
      uid
    );

  try {
    const result =
      await runTransaction(
        db,
        async (
          transaction
        ) => {
          /*
           * ALL TRANSACTION READS
           * MUST HAPPEN BEFORE WRITES.
           */

          const userSnapshot =
            await transaction.get(
              userRef
            );

          const investmentSnapshot =
            await transaction.get(
              investmentRef
            );

          /* ==================================================
             USER CHECK
             ================================================== */

          if (
            !userSnapshot.exists()
          ) {
            return {
              success: false,

              credited: false,

              amountCredited: 0,

              message:
                "User account data could not be found.",
            };
          }

          /* ==================================================
             INVESTMENT CHECK
             ================================================== */

          if (
            !investmentSnapshot.exists()
          ) {
            return {
              success: false,

              credited: false,

              amountCredited: 0,

              message:
                "No investment record was found.",
            };
          }

          const profile =
            userSnapshot.data() as UserProfile;

          const investment =
            investmentSnapshot.data() as InvestmentData;

          /* ==================================================
             INVESTMENT STATUS
             ================================================== */

          const investmentStatus =
            String(
              investment.status ?? ""
            ).toUpperCase();

          if (
            investmentStatus !==
            "ACTIVE"
          ) {
            return {
              success: false,

              credited: false,

              amountCredited: 0,

              message:
                "The investment is not active.",
            };
          }

          /* ==================================================
             INVESTMENT AMOUNT
             ================================================== */

          const investmentAmount =
            safeNumber(
              investment.investmentAmount ??
                investment.principalAmount,
              0
            );

          if (
            investmentAmount <
            DEFAULT_MINIMUM_INVESTMENT
          ) {
            return {
              success: false,

              credited: false,

              amountCredited: 0,

              message:
                "The investment amount does not meet the minimum investment requirement.",
            };
          }

          /* ==================================================
             DAILY RETURN
             ================================================== */

          const dailyReturn =
            safeNumber(
              investment.dailyReturn,
              DEFAULT_DAILY_RETURN
            );

          if (
            dailyReturn <= 0
          ) {
            return {
              success: false,

              credited: false,

              amountCredited: 0,

              message:
                "The investment does not have a valid daily return.",
            };
          }

          /* ==================================================
             CYCLE SETTINGS
             ================================================== */

          const cycleDays =
            Math.max(
              1,
              Math.floor(
                safeNumber(
                  investment.cycleDays,
                  DEFAULT_CYCLE_DAYS
                )
              )
            );

          const currentReturnsProcessed =
            Math.max(
              0,
              Math.floor(
                safeNumber(
                  investment.returnsProcessed,
                  0
                )
              )
            );

          /*
           * If the cycle has already reached its
           * maximum number of returns, do not credit again.
           */

          if (
            currentReturnsProcessed >=
            cycleDays
          ) {
            return {
              success: true,

              credited: false,

              amountCredited: 0,

              message:
                "This investment cycle has already been completed.",

              newBalance:
                safeNumber(
                  profile.balance,
                  0
                ),

              nigeriaDate,
            };
          }

          /* ==================================================
             DUPLICATE PROTECTION
             ================================================== */

          const lastReturnDate =
            investment.lastReturnDate;

          if (
            lastReturnDate ===
            nigeriaDate
          ) {
            return {
              success: true,

              credited: false,

              amountCredited: 0,

              message:
                "Today's daily return has already been processed.",

              newBalance:
                safeNumber(
                  profile.balance,
                  0
                ),

              nigeriaDate,
            };
          }

          /* ==================================================
             NEXT RETURN CHECK
             ================================================== */

          const nextReturnDate =
            toDate(
              investment.nextReturnAt
            );

          if (!nextReturnDate) {
            return {
              success: true,

              credited: false,

              amountCredited: 0,

              message:
                "The next daily return has not been scheduled yet.",

              newBalance:
                safeNumber(
                  profile.balance,
                  0
                ),

              nigeriaDate,
            };
          }

          if (
            nigeriaNow.getTime() <
            nextReturnDate.getTime()
          ) {
            return {
              success: true,

              credited: false,

              amountCredited: 0,

              message:
                "The next daily return is not due yet.",

              newBalance:
                safeNumber(
                  profile.balance,
                  0
                ),

              nigeriaDate,
            };
          }          /* ==================================================
             CURRENT BALANCE
             ================================================== */

          const currentBalance =
            safeNumber(
              profile.balance,
              0
            );

          /* ==================================================
             CREDIT DAILY RETURN
             ================================================== */

          const newBalance =
            currentBalance +
            dailyReturn;

          /* ==================================================
             RETURN COUNTER
             ================================================== */

          const newReturnsProcessed =
            currentReturnsProcessed +
            1;

          /* ==================================================
             TOTAL RETURNS
             ================================================== */

          const currentTotalReturns =
            safeNumber(
              investment.totalReturns,
              0
            );

          const newTotalReturns =
            currentTotalReturns +
            dailyReturn;

          /* ==================================================
             CYCLE COMPLETION
             ================================================== */

          const cycleCompleted =
            newReturnsProcessed >=
            cycleDays;

          /*
           * If this was the final return,
           * the investment becomes COMPLETED.
           *
           * Otherwise it remains ACTIVE and
           * the next return is scheduled.
           */

          const newInvestmentStatus =
            cycleCompleted
              ? "COMPLETED"
              : "ACTIVE";

          const nextNigeriaMidnight =
            getNextNigeriaMidnight(
              nigeriaNow
            );

          /* ==================================================
             UPDATE USER
             ================================================== */

          transaction.update(
            userRef,
            {
              balance:
                newBalance,

              updatedAt:
                Timestamp.now(),
            }
          );

          /* ==================================================
             UPDATE INVESTMENT
             ================================================== */

          transaction.update(
            investmentRef,
            {
              totalReturns:
                newTotalReturns,

              lastReturnDate:
                nigeriaDate,

              returnsProcessed:
                newReturnsProcessed,

              status:
                newInvestmentStatus,

              /*
               * When the cycle is complete there is
               * no next return.
               *
               * Otherwise schedule the next
               * Nigerian midnight.
               */
              nextReturnAt:
                cycleCompleted
                  ? null
                  : toTimestamp(
                      nextNigeriaMidnight
                    ),

              updatedAt:
                Timestamp.now(),
            }
          );

          /* ==================================================
             SUCCESS MESSAGE
             ================================================== */

          if (
            cycleCompleted
          ) {
            return {
              success: true,

              credited: true,

              amountCredited:
                dailyReturn,

              message:
                `Daily return of ${formatReturnAmount(
                  dailyReturn
                )} has been credited. Your ${cycleDays}-day investment cycle is now complete.`,

              newBalance,

              nigeriaDate,
            };
          }

          return {
            success: true,

            credited: true,

            amountCredited:
              dailyReturn,

            message:
              `Daily return of ${formatReturnAmount(
                dailyReturn
              )} has been credited successfully.`,

            newBalance,

            nigeriaDate,
          };
        }
      );

    return result;
  } catch (error) {
    console.error(
      "Daily return processing error:",
      error
    );

    return {
      success: false,

      credited: false,

      amountCredited: 0,

      message:
        "The daily return could not be processed. Please try again.",
    };
  }
}


/* ============================================================
   CHECK WHETHER DAILY RETURN IS DUE
   ============================================================ */

/*
 * This function ONLY checks.
 *
 * It does not change:
 *
 * - balance
 * - totalReturns
 * - lastReturnDate
 * - nextReturnAt
 * - returnsProcessed
 *
 * Use processDailyReturn() to actually process
 * the return.
 */

export async function isDailyReturnDue(
  uid: string
): Promise<boolean> {
  if (
    !uid ||
    typeof uid !== "string"
  ) {
    return false;
  }

  try {
    const investmentRef =
      doc(
        db,
        "investments",
        uid
      );

    const snapshot =
      await getDoc(
        investmentRef
      );

    if (
      !snapshot.exists()
    ) {
      return false;
    }

    const investment =
      snapshot.data() as InvestmentData;

    /* ========================================================
       ACTIVE CHECK
       ======================================================== */

    if (
      String(
        investment.status ?? ""
      ).toUpperCase() !==
      "ACTIVE"
    ) {
      return false;
    }

    /* ========================================================
       CYCLE CHECK
       ======================================================== */

    const cycleDays =
      Math.max(
        1,
        Math.floor(
          safeNumber(
            investment.cycleDays,
            DEFAULT_CYCLE_DAYS
          )
        )
      );

    const returnsProcessed =
      Math.max(
        0,
        Math.floor(
          safeNumber(
            investment.returnsProcessed,
            0
          )
        )
      );

    /*
     * No return is due if the investment
     * has already completed its cycle.
     */

    if (
      returnsProcessed >=
      cycleDays
    ) {
      return false;
    }

    /* ========================================================
       TODAY CHECK
       ======================================================== */

    const today =
      getNigeriaDateKey();

    /*
     * If today's return has already been processed,
     * it is not due anymore.
     */

    if (
      investment.lastReturnDate ===
      today
    ) {
      return false;
    }

    /* ========================================================
       NEXT RETURN TIME
       ======================================================== */

    const nextReturnDate =
      toDate(
        investment.nextReturnAt
      );

    /*
     * If there is no scheduled return,
     * it is not considered due.
     */

    if (!nextReturnDate) {
      return false;
    }

    /* ========================================================
       CURRENT TIME
       ======================================================== */

    const now =
      getNigeriaNow();

    /*
     * Return is due only when the scheduled
     * Nigerian return time has arrived.
     */

    if (
      now.getTime() <
      nextReturnDate.getTime()
    ) {
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "Checking daily return error:",
      error
    );

    return false;
  }
}/* ============================================================
   GET INVESTMENT RETURN SUMMARY
   ============================================================ */

/*
 * Optional helper for the Investment page.
 *
 * This does NOT modify Firestore.
 *
 * It can be used to display:
 *
 * - daily return
 * - total returns
 * - returns processed
 * - remaining returns
 * - cycle days
 * - whether the cycle is complete
 */

export type InvestmentReturnSummary = {
  dailyReturn: number;

  totalReturns: number;

  returnsProcessed: number;

  cycleDays: number;

  remainingReturns: number;

  maximumCycleReturn: number;

  cycleCompleted: boolean;

  nextReturnAt: Date | null;

  lastReturnDate: string;
};


export async function getInvestmentReturnSummary(
  uid: string
): Promise<
  InvestmentReturnSummary | null
> {
  if (
    !uid ||
    typeof uid !== "string"
  ) {
    return null;
  }

  try {
    const investmentRef =
      doc(
        db,
        "investments",
        uid
      );

    const snapshot =
      await getDoc(
        investmentRef
      );

    if (
      !snapshot.exists()
    ) {
      return null;
    }

    const investment =
      snapshot.data() as InvestmentData;

    const dailyReturn =
      safeNumber(
        investment.dailyReturn,
        DEFAULT_DAILY_RETURN
      );

    const cycleDays =
      Math.max(
        1,
        Math.floor(
          safeNumber(
            investment.cycleDays,
            DEFAULT_CYCLE_DAYS
          )
        )
      );

    const totalReturns =
      safeNumber(
        investment.totalReturns,
        0
      );

    const returnsProcessed =
      Math.max(
        0,
        Math.floor(
          safeNumber(
            investment.returnsProcessed,
            0
          )
        )
      );

    const remainingReturns =
      Math.max(
        0,
        cycleDays -
          returnsProcessed
      );

    const maximumCycleReturn =
      dailyReturn *
      cycleDays;

    const cycleCompleted =
      returnsProcessed >=
      cycleDays ||
      String(
        investment.status ?? ""
      ).toUpperCase() ===
        "COMPLETED";

    return {
      dailyReturn,

      totalReturns,

      returnsProcessed,

      cycleDays,

      remainingReturns,

      maximumCycleReturn,

      cycleCompleted,

      nextReturnAt:
        toDate(
          investment.nextReturnAt
        ),

      lastReturnDate:
        investment.lastReturnDate ||
        "",
    };
  } catch (error) {
    console.error(
      "Investment return summary error:",
      error
    );

    return null;
  }
}


/* ============================================================
   GET NEXT RETURN COUNTDOWN
   ============================================================ */

/*
 * Returns the number of milliseconds remaining
 * until the next daily return.
 *
 * This is READ-ONLY.
 *
 * Useful for a countdown displayed on the
 * Investment page.
 */

export async function getNextReturnCountdown(
  uid: string
): Promise<number | null> {
  if (
    !uid ||
    typeof uid !== "string"
  ) {
    return null;
  }

  try {
    const investmentRef =
      doc(
        db,
        "investments",
        uid
      );

    const snapshot =
      await getDoc(
        investmentRef
      );

    if (
      !snapshot.exists()
    ) {
      return null;
    }

    const investment =
      snapshot.data() as InvestmentData;

    if (
      String(
        investment.status ?? ""
      ).toUpperCase() !==
      "ACTIVE"
    ) {
      return null;
    }

    const nextReturnDate =
      toDate(
        investment.nextReturnAt
      );

    if (!nextReturnDate) {
      return null;
    }

    const now =
      getNigeriaNow();

    const remaining =
      nextReturnDate.getTime() -
      now.getTime();

    return Math.max(
      0,
      remaining
    );
  } catch (error) {
    console.error(
      "Next return countdown error:",
      error
    );

    return null;
  }
}


/* ============================================================
   INITIAL NEXT RETURN TIME
   ============================================================ */

/*
 * This function is used when the admin approves
 * a new investment.
 *
 * The first return is scheduled for the next
 * Nigerian midnight.
 */

export function getInitialNextReturnAt(): Timestamp {
  return toTimestamp(
    getNextNigeriaMidnight()
  );
}


/* ============================================================
   END OF RETURN LOGIC
   ============================================================ */
