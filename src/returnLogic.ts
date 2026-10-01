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
 * This file is responsible for processing one daily return
 * for an active investment.
 *
 * CURRENT PLAN:
 * Minimum investment: ₦500
 * Daily return:       ₦200
 *
 * IMPORTANT:
 * This is application logic for the current development stage.
 * Firebase Security Rules will be added later and must prevent
 * unauthorized clients from changing balances directly.
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
   * Date on which the most recent daily return
   * was successfully processed.
   *
   * Example:
   * "2026-10-01"
   */
  lastReturnDate?: string;

  /*
   * Optional counter showing how many daily returns
   * have already been processed.
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

export type ReturnProcessResult = {
  success: boolean;

  /*
   * true when ₦200 or the configured daily return
   * was actually added to the user's balance.
   */
  credited: boolean;

  /*
   * Amount actually credited during this call.
   */
  amountCredited: number;

  /*
   * Human-readable result.
   */
  message: string;

  /*
   * Current balance after the transaction when
   * available.
   */
  newBalance?: number;

  /*
   * Nigerian calendar date used by the processor.
   */
  nigeriaDate?: string;
};


/* ============================================================
   DEFAULT SETTINGS
   ============================================================ */

const DEFAULT_DAILY_RETURN = 200;

const DEFAULT_MINIMUM_INVESTMENT = 500;


/* ============================================================
   NIGERIAN TIME HELPERS
   ============================================================ */

/*
 * Nigeria uses West Africa Time:
 *
 * UTC + 1
 *
 * We use the Africa/Lagos timezone instead of relying
 * on the user's phone timezone.
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

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const values: Record<
    string,
    string
  > = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  /*
   * Convert the Nigerian clock into the
   * actual UTC timestamp.
   *
   * Nigeria is UTC+1, therefore subtract
   * one hour.
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
 * Return the current Nigerian calendar date.
 *
 * Example:
 *
 * "2026-10-01"
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


/*
 * Get the next Nigerian midnight.
 *
 * Example:
 *
 * Current Nigerian time:
 * 2026-10-01 21:30
 *
 * Next return time:
 * 2026-10-02 00:00 WAT
 */
export function getNextNigeriaMidnight(
  fromDate: Date = getNigeriaNow()
): Date {
  const nigeriaNow =
    new Date(fromDate);

  /*
   * Because Nigeria is UTC+1,
   * Nigerian midnight is 23:00 UTC
   * on the previous UTC calendar day.
   */
  const nextMidnight =
    new Date(nigeriaNow);

  nextMidnight.setUTCHours(
    23,
    0,
    0,
    0
  );

  /*
   * If today's Nigerian midnight has
   * already passed, move to tomorrow.
   */
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


/* ============================================================
   FIRESTORE DATE HELPERS
   ============================================================ */

/*
 * Convert supported Firestore/date values
 * into a JavaScript Date.
 */
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
      return (
        value as {
          toDate: () => Date;
        }
      ).toDate();
    } catch {
      return null;
    }
  }

  /*
   * JavaScript Date
   */
  if (value instanceof Date) {
    return value;
  }

  /*
   * Number timestamp
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


/*
 * Convert a date into a Firestore Timestamp.
 */
function toTimestamp(
  date: Date
): Timestamp {
  return Timestamp.fromDate(
    date
  );
}


/* ============================================================
   NUMBER HELPERS
   ============================================================ */

/*
 * Make sure a value is a safe non-negative number.
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
   MAIN DAILY RETURN PROCESSOR
   ============================================================ */

/*
 * Process one daily return for a user.
 *
 * The function:
 *
 * 1. Finds the user's account.
 * 2. Finds the user's investment.
 * 3. Checks that the investment is ACTIVE.
 * 4. Checks whether a return is due.
 * 5. Prevents a duplicate return for the same
 *    Nigerian calendar day.
 * 6. Adds the daily return to the user's balance.
 * 7. Records the processed Nigerian date.
 * 8. Schedules the next Nigerian midnight.
 *
 * The user UID is the only argument required.
 */
export async function processDailyReturn(
  uid: string
): Promise<ReturnProcessResult> {
  /*
   * Basic UID validation.
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
   * Get the current Nigerian date/time.
   */
  const nigeriaNow =
    getNigeriaNow();

  const nigeriaDate =
    getNigeriaDateKey(
      nigeriaNow
    );


  /*
   * Firestore document references.
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


  /*
   * Run the balance-changing operation
   * inside a Firestore transaction.
   *
   * This means the user balance and investment
   * state are handled together.
   */
  try {
    const result =
      await runTransaction(
        db,
        async (transaction) => {
          /*
           * Read both documents.
           */
          const [
            userSnapshot,
            investmentSnapshot,
          ] = await Promise.all([
            transaction.get(
              userRef
            ),

            transaction.get(
              investmentRef
            ),
          ]);


          /*
           * USER DOCUMENT DOES NOT EXIST
           */
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


          /*
           * INVESTMENT DOCUMENT DOES NOT EXIST
           */
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
             CHECK INVESTMENT STATUS
             ================================================== */

          const investmentStatus =
            String(
              investment.status || ""
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
             CHECK INVESTMENT AMOUNT
             ================================================== */

          const investmentAmount =
            safeNumber(
              investment.investmentAmount ??
                investment.principalAmount,
              0
            );


          /*
           * Do not process a return if the
           * investment amount is invalid.
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
             DETERMINE DAILY RETURN
             ================================================== */

          const dailyReturn =
            safeNumber(
              investment.dailyReturn,
              DEFAULT_DAILY_RETURN
            );


          /*
           * A zero or invalid daily return
           * should never be credited.
           */
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
             DUPLICATE RETURN PROTECTION
             ================================================== */

          const lastReturnDate =
            investment.lastReturnDate;


          /*
           * If this Nigerian calendar day has
           * already been processed, DO NOT credit
           * another return.
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
             CHECK NEXT RETURN TIME
             ================================================== */

          const nextReturnDate =
            toDate(
              investment.nextReturnAt
            );


          /*
           * If nextReturnAt exists and the scheduled
           * time has NOT arrived yet, do not credit.
           *
           * This prevents a user from receiving the
           * daily return before midnight.
           */
          if (
            nextReturnDate &&
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
           * Calculate the new balance.
           */
          const newBalance =
            currentBalance +
            dailyReturn;


          /* ==================================================
             RETURN COUNTER
             ================================================== */

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


          const newReturnsProcessed =
            returnsProcessed + 1;


          /* ==================================================
             NEXT RETURN
             ================================================== */

          /*
           * After processing today's return,
           * schedule the next one for the next
           * Nigerian midnight.
           */
          const nextNigeriaMidnight =
            getNextNigeriaMidnight(
              nigeriaNow
            );


          /* ==================================================
             UPDATE USER BALANCE
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
             RETURN RESULT
             ================================================== */

          return {
            success: true,

            credited: true,

            amountCredited:
              dailyReturn,

            message:
              `Daily return of ₦${dailyReturn.toLocaleString(
                "en-NG"
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
   CHECK WITHOUT PROCESSING
   ============================================================ */

/*
 * This function is useful for the Investment page.
 *
 * It checks whether a return appears to be due,
 * but DOES NOT change the balance.
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


    /*
     * Investment must be active.
     */
    if (
      String(
        investment.status || ""
      ).toUpperCase() !==
      "ACTIVE"
    ) {
      return false;
    }


    /*
     * Today's return has already
     * been processed.
     */
    const today =
      getNigeriaDateKey();

    if (
      investment.lastReturnDate ===
      today
    ) {
      return false;
    }


    /*
     * Check the scheduled return time.
     */
    const nextReturn =
      toDate(
        investment.nextReturnAt
      );


    /*
     * If no nextReturnAt exists yet,
     * don't automatically claim that a
     * return is due.
     */
    if (!nextReturn) {
      return false;
    }


    /*
     * Return is due once the scheduled
     * timestamp has arrived.
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
   PREPARE NEXT RETURN
   ============================================================ */

/*
 * This helper can be used when an admin approves
 * a new investment.
 *
 * It schedules the FIRST daily return for the
 * next Nigerian midnight.
 *
 * It does NOT credit money.
 */
export function getInitialNextReturnAt(): Timestamp {
  return toTimestamp(
    getNextNigeriaMidnight()
  );
}


/* ============================================================
   FORMAT RETURN MESSAGE
   ============================================================ */

/*
 * Small helper for displaying return amounts
 * consistently throughout the application.
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
