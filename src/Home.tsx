import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Clock3,
  Menu,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const navigate = useNavigate();

  const faqs = [
    {
      question: "How does XS work?",
      answer:
        "Create an account, complete the required information, make an investment deposit, and manage your investment from your dashboard.",
    },
    {
      question: "What is the minimum deposit?",
      answer:
        "The minimum investment deposit is ₦500.",
    },
    {
      question: "How long does an investment cycle last?",
      answer:
        "Each investment cycle lasts 3 days. After the cycle expires, a new cycle requires a new deposit.",
    },
    {
      question: "How does the referral system work?",
      answer:
        "Each user receives a unique referral link. A referral becomes qualified after the referred user registers through the link, deposits at least ₦500, and the deposit is approved.",
    },
  ];

  return (
    <div className="xs-app">
      {/* NAVIGATION */}
      <header className="navbar">
        <div className="nav-inner">
          <a
            href="#home"
            className="brand"
            onClick={() => setMenuOpen(false)}
            aria-label="XS Company Limited"
          >
            <span className="brand-xs">X</span>
            <span className="brand-s">S</span>
            <span className="brand-name">
              Company Limited
            </span>
          </a>

          <nav
            className={`desktop-nav ${
              menuOpen ? "mobile-open" : ""
            }`}
          >
            <a
              href="#home"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </a>

            <a
              href="#about"
              onClick={() => setMenuOpen(false)}
            >
              About
            </a>

            <a
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
            >
              How It Works
            </a>

            <a
              href="#plans"
              onClick={() => setMenuOpen(false)}
            >
              Plans
            </a>

            <a
              href="#referral"
              onClick={() => setMenuOpen(false)}
            >
              Referral
            </a>

            <a
              href="#faq"
              onClick={() => setMenuOpen(false)}
            >
              FAQ
            </a>
          </nav>

          <div className="nav-actions">
            <button
              className="btn btn-outline"
              onClick={() => navigate("/login")}
            >
              Login
            </button>

            <button
              className="btn btn-primary"
              onClick={() => navigate("/register")}
            >
              Get Started
            </button>
          </div>

          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={
              menuOpen
                ? "Close navigation"
                : "Open navigation"
            }
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X size={24} />
            ) : (
              <Menu size={24} />
            )}
          </button>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section id="home" className="hero">
          <div className="hero-overlay" />

          <div className="hero-content">
            <div className="hero-badge">
              <span className="status-dot" />
              A modern financial platform
            </div>

            <h1>
              Build your financial
              <span> future with XS.</span>
            </h1>

            <p>
              A simple platform designed to help you manage
              your investment, track returns, and participate
              in the XS referral programme.
            </p>

            <div className="hero-buttons">
              <button
                className="btn btn-primary btn-large"
                onClick={() => navigate("/register")}
              >
                Start Investing
                <ArrowRight size={18} />
              </button>

              <a
                href="#about"
                className="btn btn-light-outline btn-large"
              >
                Learn More
              </a>
            </div>

            <div className="hero-trust">
              <div>
                <ShieldCheck size={19} />
                <span>Secure account access</span>
              </div>

              <div>
                <BarChart3 size={19} />
                <span>Track your investment</span>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="section">
          <div className="section-heading">
            <span className="eyebrow">ABOUT XS</span>

            <h2>
              A simple way to manage your investment.
            </h2>

            <p>
              XS Company Limited provides a structured digital
              platform where registered users can manage their
              investment activity, returns, withdrawals and
              referrals in one place.
            </p>
          </div>

          <div className="feature-grid">
            <FeatureCard
              icon={<Wallet />}
              title="Easy Investment"
              text="Manage your investment activity from a clear and simple dashboard."
            />

            <FeatureCard
              icon={<BarChart3 />}
              title="Track Returns"
              text="View your investment status, earnings and upcoming return."
            />

            <FeatureCard
              icon={<ShieldCheck />}
              title="Account Protection"
              text="Your account and transaction information are handled through protected application systems."
            />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how-it-works"
          className="section section-dark"
        >
          <div className="section-heading light">
            <span className="eyebrow">HOW IT WORKS</span>

            <h2>Start in a few simple steps.</h2>
          </div>

          <div className="steps-grid">
            <Step
              number="01"
              title="Create an account"
            >
              Register and complete the required consent and
              account information.
            </Step>

            <Step
              number="02"
              title="Make a deposit"
            >
              Deposit at least ₦500 and provide the sender
              account name used for the transfer.
            </Step>

            <Step
              number="03"
              title="Investment activated"
            >
              Your deposit remains pending until an
              administrator verifies and approves it.
            </Step>

            <Step
              number="04"
              title="Manage your cycle"
            >
              Track your active investment, daily return and
              3-day investment cycle from your dashboard.
            </Step>
          </div>
        </section>

        {/* INVESTMENT */}
        <section id="plans" className="section">
          <div className="section-heading">
            <span className="eyebrow">INVESTMENT</span>

            <h2>XS investment cycle</h2>

            <p>
              Review the investment terms carefully before
              participating. Returns are subject to the
              applicable terms and platform conditions.
            </p>
          </div>

          <div className="plan-card">
            <div className="plan-top">
              <div>
                <span className="plan-label">
                  STANDARD CYCLE
                </span>

                <h3>XS Investment</h3>
              </div>

              <div className="plan-icon">
                <Clock3 size={26} />
              </div>
            </div>

            <div className="plan-details">
              <div>
                <span>Minimum deposit</span>
                <strong>₦500</strong>
              </div>

              <div>
                <span>Daily return</span>
                <strong>₦150</strong>
              </div>

              <div>
                <span>Cycle duration</span>
                <strong>3 Days</strong>
              </div>

              <div>
                <span>Minimum withdrawal</span>
                <strong>₦500</strong>
              </div>
            </div>

            <div className="plan-note">
              <Clock3 size={18} />

              <p>
                When the 3-day cycle expires, a new cycle
                requires a new deposit. Withdrawal eligibility
                also requires 2 qualified referrals for the
                current cycle.
              </p>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={() => navigate("/register")}
            >
              Get Started
              <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* REFERRAL */}
        <section
          id="referral"
          className="section referral-section"
        >
          <div className="referral-content">
            <div>
              <span className="eyebrow">
                REFERRAL PROGRAMME
              </span>

              <h2>Share XS with people you know.</h2>

              <p>
                Every user receives a unique referral code and
                link. A referral becomes qualified after the
                referred user registers, deposits at least
                ₦500 and has the deposit approved.
              </p>

              <div className="commission">
                <Users size={25} />

                <div>
                  <strong>₦50</strong>

                  <span>per qualified referral</span>
                </div>
              </div>
            </div>

            <div className="referral-card">
              <Users size={38} />

              <h3>Build your referral network</h3>

              <p>
                Track total referrals, qualified referrals and
                referral commissions directly from your
                account.
              </p>

              <button
                className="btn btn-primary"
                onClick={() => navigate("/register")}
              >
                Join XS
              </button>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section">
          <div className="section-heading">
            <span className="eyebrow">FAQ</span>

            <h2>Frequently asked questions.</h2>
          </div>

          <div className="faq-list">
            {faqs.map((faq, index) => (
              <div
                className="faq-item"
                key={faq.question}
              >
                <button
                  className="faq-question"
                  onClick={() =>
                    setOpenFaq(
                      openFaq === index ? null : index
                    )
                  }
                  aria-expanded={openFaq === index}
                >
                  <span>{faq.question}</span>

                  <ChevronDown
                    size={20}
                    className={
                      openFaq === index ? "rotate" : ""
                    }
                  />
                </button>

                {openFaq === index && (
                  <div className="faq-answer">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div>
          <div className="brand footer-brand">
            <span className="brand-xs">X</span>

            <span className="brand-s">S</span>

            <span className="brand-name">
              Company Limited
            </span>
          </div>

          <p>
            Professional digital platform for managing your XS
            investment activity.
          </p>
        </div>

        <div className="footer-links">
          <a href="#about">About</a>

          <a href="#plans">Investment Terms</a>

          <a href="#referral">Referral Terms</a>

          <a href="#faq">FAQ</a>
        </div>

        <div className="copyright">
          © {new Date().getFullYear()} XS Company Limited.
          All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>

      <h3>{title}</h3>

      <p>{text}</p>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="step">
      <span className="step-number">{number}</span>

      <h3>{title}</h3>

      <p>{children}</p>
    </div>
  );
}

export default HomePage;
