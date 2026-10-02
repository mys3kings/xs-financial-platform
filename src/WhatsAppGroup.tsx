import { useEffect, useState } from "react";

const WHATSAPP_GROUP_LINK =
  "https://chat.whatsapp.com/EEDFs9jUiiPJU0bjEjNNIR";

const STORAGE_KEY = "xs_whatsapp_group_popup";

const MAX_POPUPS_PER_DAY = 2;

// Minimum time between the first and second popup.
// 4 hours = 4 * 60 * 60 * 1000
const MIN_TIME_BETWEEN_POPUPS = 4 * 60 * 60 * 1000;

type PopupStorage = {
  date: string;
  shownCount: number;
  lastShownAt: number;
};

function getTodayKey(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function getPopupStorage(): PopupStorage {
  const today = getTodayKey();

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return {
        date: today,
        shownCount: 0,
        lastShownAt: 0,
      };
    }

    const parsed = JSON.parse(saved) as PopupStorage;

    // Reset automatically when a new day starts.
    if (parsed.date !== today) {
      return {
        date: today,
        shownCount: 0,
        lastShownAt: 0,
      };
    }

    return {
      date: today,
      shownCount: Number(parsed.shownCount) || 0,
      lastShownAt: Number(parsed.lastShownAt) || 0,
    };
  } catch {
    return {
      date: today,
      shownCount: 0,
      lastShownAt: 0,
    };
  }
}

function savePopupStorage(data: PopupStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore localStorage errors.
  }
}

function shouldShowPopup(): boolean {
  const data = getPopupStorage();

  // Never show more than twice per day.
  if (data.shownCount >= MAX_POPUPS_PER_DAY) {
    return false;
  }

  // First popup of the day can appear.
  if (data.shownCount === 0) {
    return true;
  }

  // For the second popup, wait at least 4 hours.
  const timeSinceLastPopup = Date.now() - data.lastShownAt;

  return timeSinceLastPopup >= MIN_TIME_BETWEEN_POPUPS;
}

function markPopupAsShown(): void {
  const data = getPopupStorage();

  savePopupStorage({
    date: getTodayKey(),
    shownCount: Math.min(data.shownCount + 1, MAX_POPUPS_PER_DAY),
    lastShownAt: Date.now(),
  });
}

export default function WhatsAppGroup() {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkPopup = () => {
      if (!shouldShowPopup()) {
        return;
      }

      markPopupAsShown();
      setShowPopup(true);
    };

    /*
     * Give the website a little time to load before showing
     * the popup. This prevents it from appearing immediately.
     */
    timer = setTimeout(() => {
      checkPopup();
    }, 3000);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  /*
   * Check periodically so the second popup can appear later
   * in the same day without requiring the user to refresh.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (!showPopup && shouldShowPopup()) {
        markPopupAsShown();
        setShowPopup(true);
      }
    }, 60 * 1000); // Check once every minute

    return () => clearInterval(interval);
  }, [showPopup]);

  const closePopup = () => {
    setShowPopup(false);
  };

  const joinWhatsAppGroup = () => {
    window.open(
      WHATSAPP_GROUP_LINK,
      "_blank",
      "noopener,noreferrer"
    );

    setShowPopup(false);
  };

  return (
    <>
      {/* =====================================================
          WHATSAPP POPUP
          ===================================================== */}

      {showPopup && (
        <>
          <div
            className="xs-whatsapp-overlay"
            onClick={closePopup}
            aria-hidden="true"
          />

          <div
            className="xs-whatsapp-popup"
            role="dialog"
            aria-modal="true"
            aria-labelledby="xs-whatsapp-title"
          >
            {/* Close button */}
            <button
              type="button"
              className="xs-whatsapp-close"
              onClick={closePopup}
              aria-label="Close WhatsApp invitation"
            >
              ×
            </button>

            {/* WhatsApp icon */}
            <div className="xs-whatsapp-popup-icon">
              <svg
                viewBox="0 0 32 32"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M19.11 17.21c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.15-1.34-.79-.7-1.33-1.57-1.49-1.84-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.56.58.65.21 1.24.18 1.7.11.52-.08 1.6-.65 1.83-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32Z"
                />
                <path
                  fill="currentColor"
                  d="M16.03 3.2c-7.1 0-12.86 5.76-12.86 12.86 0 2.27.6 4.4 1.64 6.25L3.07 28.8l6.64-1.74a12.8 12.8 0 0 0 6.32 1.66h.01c7.1 0 12.86-5.76 12.86-12.86S23.13 3.2 16.03 3.2Zm0 23.4h-.01c-2.02 0-4-.54-5.72-1.56l-.41-.24-3.94 1.03 1.05-3.84-.27-.42a10.64 10.64 0 0 1-1.63-5.67c0-5.88 4.79-10.67 10.68-10.67 2.85 0 5.53 1.11 7.54 3.13a10.6 10.6 0 0 1 3.12 7.55c0 5.89-4.79 10.68-10.67 10.68Z"
                />
              </svg>
            </div>

            <div className="xs-whatsapp-popup-content">
              <h2 id="xs-whatsapp-title">
                Stay Updated!
              </h2>

              <p>
                Join our official XS Company Limited
                WhatsApp group to stay updated with
                important announcements, news and
                information.
              </p>

              <button
                type="button"
                className="xs-whatsapp-join"
                onClick={joinWhatsAppGroup}
              >
                <svg
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M19.11 17.21c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.15-1.34-.79-.7-1.33-1.57-1.49-1.84-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.56.58.65.21 1.24.18 1.7.11.52-.08 1.6-.65 1.83-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32Z"
                  />
                  <path
                    fill="currentColor"
                    d="M16.03 3.2c-7.1 0-12.86 5.76-12.86 12.86 0 2.27.6 4.4 1.64 6.25L3.07 28.8l6.64-1.74a12.8 12.8 0 0 0 6.32 1.66h.01c7.1 0 12.86-5.76 12.86-12.86S23.13 3.2 16.03 3.2Zm0 23.4h-.01c-2.02 0-4-.54-5.72-1.56l-.41-.24-3.94 1.03 1.05-3.84-.27-.42a10.64 10.64 0 0 1-1.63-5.67c0-5.88 4.79-10.67 10.68-10.67 2.85 0 5.53 1.11 7.54 3.13a10.6 10.6 0 0 1 3.12 7.55c0 5.89-4.79 10.68-10.67 10.68Z"
                  />
                </svg>

                Join WhatsApp Group
              </button>

              <button
                type="button"
                className="xs-whatsapp-later"
                onClick={closePopup}
              >
                Maybe later
              </button>
            </div>
          </div>
        </>
      )}

      {/* =====================================================
          FLOATING WHATSAPP BUTTON
          ===================================================== */}

      <button
        type="button"
        className="xs-whatsapp-floating"
        onClick={joinWhatsAppGroup}
        aria-label="Join XS Company Limited WhatsApp group"
        title="Join our WhatsApp group"
      >
        <svg
          viewBox="0 0 32 32"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M19.11 17.21c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.15-1.34-.79-.7-1.33-1.57-1.49-1.84-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.45-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.56.58.65.21 1.24.18 1.7.11.52-.08 1.6-.65 1.83-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32Z"
          />
          <path
            fill="currentColor"
            d="M16.03 3.2c-7.1 0-12.86 5.76-12.86 12.86 0 2.27.6 4.4 1.64 6.25L3.07 28.8l6.64-1.74a12.8 12.8 0 0 0 6.32 1.66h.01c7.1 0 12.86-5.76 12.86-12.86S23.13 3.2 16.03 3.2Zm0 23.4h-.01c-2.02 0-4-.54-5.72-1.56l-.41-.24-3.94 1.03 1.05-3.84-.27-.42a10.64 10.64 0 0 1-1.63-5.67c0-5.88 4.79-10.67 10.68-10.67 2.85 0 5.53 1.11 7.54 3.13a10.6 10.6 0 0 1 3.12 7.55c0 5.89-4.79 10.68-10.67 10.68Z"
          />
        </svg>
      </button>

      {/* =====================================================
          COMPONENT STYLES
          ===================================================== */}

      <style>{`
        .xs-whatsapp-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(2px);
          -webkit-backdrop-filter: blur(2px);
          z-index: 9998;
          animation: xsWhatsappFadeIn 0.2s ease;
        }

        .xs-whatsapp-popup {
          position: fixed;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: min(420px, calc(100vw - 32px));
          background: #ffffff;
          border-radius: 24px;
          padding: 30px 26px 24px;
          box-shadow: 0 24px 70px rgba(20, 33, 61, 0.22);
          z-index: 9999;
          text-align: center;
          animation: xsWhatsappPopupIn 0.28s ease;
          border: 1px solid rgba(20, 33, 61, 0.07);
        }

        .xs-whatsapp-close {
          position: absolute;
          top: 12px;
          right: 14px;
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 50%;
          background: #f3f6fa;
          color: #526070;
          font-size: 23px;
          line-height: 30px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .xs-whatsapp-close:hover {
          background: #e8edf3;
          transform: rotate(90deg);
        }

        .xs-whatsapp-popup-icon {
          width: 68px;
          height: 68px;
          margin: 4px auto 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #25d366;
          color: #ffffff;
          box-shadow: 0 10px 25px rgba(37, 211, 102, 0.25);
        }

        .xs-whatsapp-popup-icon svg {
          width: 38px;
          height: 38px;
        }

        .xs-whatsapp-popup-content h2 {
          margin: 0 0 10px;
          color: #14213d;
          font-size: 24px;
          font-weight: 750;
          letter-spacing: -0.4px;
        }

        .xs-whatsapp-popup-content p {
          margin: 0 auto 22px;
          max-width: 340px;
          color: #657184;
          font-size: 14px;
          line-height: 1.65;
        }

        .xs-whatsapp-join {
          width: 100%;
          min-height: 48px;
          border: none;
          border-radius: 12px;
          background: #25d366;
          color: #ffffff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
          box-shadow: 0 8px 20px rgba(37, 211, 102, 0.2);
        }

        .xs-whatsapp-join:hover {
          background: #20bd5a;
          transform: translateY(-1px);
          box-shadow: 0 11px 25px rgba(37, 211, 102, 0.27);
        }

        .xs-whatsapp-join:active {
          transform: translateY(0);
        }

        .xs-whatsapp-join svg {
          width: 22px;
          height: 22px;
        }

        .xs-whatsapp-later {
          margin-top: 13px;
          border: none;
          background: transparent;
          color: #7a8494;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 12px;
        }

        .xs-whatsapp-later:hover {
          color: #14213d;
        }

        .xs-whatsapp-floating {
          position: fixed;
          right: 18px;
          bottom: 18px;
          width: 54px;
          height: 54px;
          border: none;
          border-radius: 50%;
          background: #25d366;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9990;
          box-shadow:
            0 8px 22px rgba(0, 0, 0, 0.16),
            0 3px 8px rgba(37, 211, 102, 0.25);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .xs-whatsapp-floating:hover {
          transform: scale(1.07);
          box-shadow:
            0 11px 28px rgba(0, 0, 0, 0.18),
            0 5px 12px rgba(37, 211, 102, 0.3);
        }

        .xs-whatsapp-floating:active {
          transform: scale(0.96);
        }

        .xs-whatsapp-floating svg {
          width: 31px;
          height: 31px;
        }

        @keyframes xsWhatsappFadeIn {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes xsWhatsappPopupIn {
          from {
            opacity: 0;
            transform: translate(-50%, -46%) scale(0.96);
          }

          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @media (max-width: 480px) {
          .xs-whatsapp-popup {
            width: calc(100vw - 24px);
            padding: 27px 20px 21px;
            border-radius: 21px;
          }

          .xs-whatsapp-popup-icon {
            width: 62px;
            height: 62px;
          }

          .xs-whatsapp-popup-icon svg {
            width: 35px;
            height: 35px;
          }

          .xs-whatsapp-popup-content h2 {
            font-size: 22px;
          }

          .xs-whatsapp-floating {
            right: 15px;
            bottom: 15px;
            width: 50px;
            height: 50px;
          }

          .xs-whatsapp-floating svg {
            width: 28px;
            height: 28px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .xs-whatsapp-overlay,
          .xs-whatsapp-popup {
            animation: none;
          }

          .xs-whatsapp-close,
          .xs-whatsapp-join,
          .xs-whatsapp-floating {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}
