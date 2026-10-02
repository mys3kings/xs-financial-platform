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
 *
 * RETURN BEHAVIOUR
 *
 * The return is NOT processed by Cloud Functions.
 *
 * Instead, when the user opens the Investment page,
 * the application checks whether the next return is due.
 *
 * If the return is due:
 *
 *     User opens Investment page
 *              ↓
 *     Return is checked
 *              ↓
 *     ₦200 is credited
 *              ↓
 *     Investment totalReturns is updated
 *              ↓
 *     lastReturnDate is recorded
 *              ↓
 *     nextReturnAt is moved to the next Nigerian midnight
 *
 * DUPLICATE PROTECTION
 *
 * A user cannot receive the same day's return twice.
 *
 * Firebase Security Rules will be added later.
 *
 * IMPORTANT:
 * This file contains application-side logic only.
 * Security Rules must eventually prevent unauthorized clients
 * from changing balances or investment records directly.
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

  /*
   * Nigerian calendar date on which the most recent
   * daily return was processed.
   *
   * Example:
   *
   * "2026-10-02"
   */
  lastReturnDate?: string;

  /*
   * Number of daily returns that have been processed
   * for this investment.
   */
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

  /*
   * True only when money was actually credited.
   */
  credited: boolean;

  /*
   * Amount credited during this call.
   */
  amountCredited: number;

  /*
   * Human-readable message.
   */
  message: string;

  /*
   * User balance after processing, when available.
   */
  newBalance?: number;

  /*
   * Nigerian calendar date used by the processor.
   */
  nigeriaDate?: string;
};


/* ============================================================
   CONSTANTS
   ============================================================ */

export const DEFAULT_DAILY_RETURN = 200;

export const DEFAULT_MINIMUM_INVESTMENT = 500;


/* ============================================================
   NIGERIAN TIME
   ============================================================ */

/*
 * Nigeria uses West Africa Time (WAT).
 *
 * WAT = UTC + 1
 *
 * This function returns the current moment as a JavaScript
 * Date while using the Nigerian clock to determine the date
 * and time.
 */
function getNigeriaNow(): Date {
  const formatter = new Intl.DateTimeFormat(
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

  const parts = formatter.formatToParts(
    new Date()
  );

  const values: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  /*
   * Convert the Nigerian clock into a UTC timestamp.
   *
   * Nigeria is UTC+1, therefore subtract one hour.
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

/*
 * Returns the Nigerian calendar date.
 *
 * Example:
 *
 * 2026-10-02
 */
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
 * Returns the next Nigerian midnight.
 *
 * Example:
 *
 * Current Nigerian time:
 *
 * October 2, 2026 — 8:00 PM
 *
 * Result:
 *
 * October 3, 2026 — 12:00 AM WAT
 *
 * The returned Date represents the actual UTC instant
 * corresponding to Nigerian midnight.
 */
export function getNextNigeriaMidnight(
  fromDate: Date = getNigeriaNow()
): Date {
  /*
   * Obtain the Nigerian calendar date of the supplied moment.
   */
  const nigeriaDate =
    getNigeriaDateKey(fromDate);

  /*
   * Create tomorrow's Nigerian date.
   */
  const [
    year,
    month,
    day,
  ] = nigeriaDate
    .split("-")
    .map(Number);

  /*
   * Nigerian midnight is 23:00 UTC on the previous
   * UTC calendar day because Nigeria is UTC+1.
   *
   * Start with midnight UTC for the Nigerian date,
   * then move to the following Nigerian day.
   */
  const tomorrowAtNigerianMidnight =
    new Date(
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

  return tomorrowAtNigerianMidnight;
}


/* ============================================================
   FIRESTORE DATE CONVERSION
   ============================================================ */

/*
 * Convert a Firestore Timestamp, Date, number or string
 * into a JavaScript Date.
 */
function toDate(
  value: unknown
): Date | null {
  if (!value) {
    return null;
  }


  /*
   * Firestore Timestamp.
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
      const date = (
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
   * JavaScript Date.
   */
  if (value instanceof Date) {
    return Number.isNaN(
      value.getTime()
    )
      ? null
      : value;
  }


  /*
   * Numeric timestamp.
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
   * String date.
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

/*
 * Returns a safe non-negative number.
 *
 * Invalid or negative values become the fallback.
 */
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

/*
 * Processes ONE due daily return.
 *
 * This function is intended to be called when the user opens
 * the Investment page.
 *
 * FLOW:
 *
 *     Open Investment page
 *             ↓
 *     Check investment
 *             ↓
 *     ACTIVE?
 *             ↓
 *     Return due?
 *             ↓
 *     Already processed today?
 *             ↓
 *     Credit daily return
 *             ↓
 *     Update investment
 *             ↓
 *     Schedule next Nigerian midnight
 */
export async function processDailyReturn(
  uid: string
): Promise<ReturnProcessResult> {
  /*
   * Validate UID.
   */
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


  /*
   * Current Nigerian moment.
   */
  const nigeriaNow =
    getNigeriaNow();


  /*
   * Current Nigerian calendar date.
   */
  const nigeriaDate =
    getNigeriaDateKey(
      nigeriaNow
    );


  /*
   * Firestore references.
   */
  const userRef = doc(
    db,
    "users",
    uid
  );

  const investmentRef = doc(
    db,
    "investments",
    uid
  );


  try {
    /*
     * Firestore transaction.
     *
     * The user's balance and investment information
     * are updated together.
     */
    const result =
      await runTransaction(
        db,
        async (transaction) => {
          /*
           * IMPORTANT:
           *
           * All transaction reads happen before writes.
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


          /*
           * An active investment must have at least
           * the current minimum investment amount.
           */
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
             DUPLICATE PROTECTION
             ================================================== */

          const lastReturnDate =
            investment.lastReturnDate;


          /*
           * If today's return was already processed,
           * NEVER credit another return.
           */
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


          /*
           * An investment without nextReturnAt is not
           * considered due.
           *
           * This prevents accidental first-day crediting.
           */
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


          /*
           * The scheduled return time has not arrived.
           */
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
          }


          /* ==================================================
             CURRENT BALANCE
             ================================================== */

          const currentBalance =
            safeNumber(
              profile.balance,
              0
            );


          /*
           * Add the daily return.
           */
          const newBalance =
            currentBalance +
            dailyReturn;


          /* ==================================================
             RETURN COUNTER
             ================================================== */

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


          const newReturnsProcessed =
            currentReturnsProcessed + 1;


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
             NEXT RETURN TIME
             ================================================== */

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
              balance: newBalance,
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

              nextReturnAt:
                toTimestamp(
                  nextNigeriaMidnight
                ),
            }
          );


          /* ==================================================
             SUCCESS
             ================================================== */

          return {
            success: true,

            credited: true,

            amountCredited:
              dailyReturn,

            message:
              `Daily return of ${formatReturnAmount(
                dailyReturn
              )} has been recorded.`,

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
 * Checks whether a daily return is currently due.
 *
 * IMPORTANT:
 *
 * This function ONLY READS data.
 *
 * It does NOT change:
 *
 * - balance
 * - totalReturns
 * - lastReturnDate
 * - nextReturnAt
 *
 * Use processDailyReturn() when you actually want
 * to process the return.
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
       TODAY CHECK
       ==================================    /* ========================================================
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
       NEXT RETURN CHECK
       ======================================================== */

    const nextReturn =
      toDate(
        investment.nextReturnAt
      );


    /*
     * If there is no scheduled return time,
     * we cannot safely determine that a return is due.
     */
    if (!nextReturn) {
      return false;
    }


    /* ========================================================
       TIME CHECK
       ======================================================== */

    /*
     * The return becomes due once the scheduled
     * Nigerian midnight has been reached.
     */
    return (
      getNigeriaNow().getTime() >=
      nextReturn.getTime()
    );
  } catch (error) {
    console.error(
      "Daily return check error:",
      error
    );

    return false;
  }
}


/* ============================================================
   INITIAL RETURN SCHEDULE
   ============================================================ */

/*
 * Used when an admin activates a new investment.
 *
 * This schedules the FIRST daily return for the
 * next Nigerian midnight.
 *
 * It does NOT credit any money.
 *
 * Example:
 *
 * Investment approved:
 * October 2, 2026 — 3:00 PM
 *
 * First return becomes due:
 * October 3, 2026 — 12:00 AM WAT
 */
export function getInitialNextReturnAt(): Timestamp {
  return toTimestamp(
    getNextNigeriaMidnight()
  );
}


/* ============================================================
   FORMAT RETURN AMOUNT
   ============================================================ */

/*
 * Formats a return amount consistently.
 *
 * Example:
 *
 * 200
 *
 * becomes:
 *
 * ₦200.00
 */
export function formatReturnAmount(
  amount: number
): string {
  return `₦${safeNumber(
    amount,
    0
  ).toLocaleString("en-NG", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  })}`;
}
