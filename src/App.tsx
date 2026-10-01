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
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

import Register from "./Register";
import Dashboard from "./Dashboard";
import Deposit from "./Deposit";

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
      answer: "The minimum investment deposit is ₦500.",
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
      <header className="navbar">
        <div className="nav-inner">
          <a href="#home" className="brand">
            <span className="brand-xs">X</span>
            <span className="brand-s">S</span>
            <span className="brand-name">Company Limited</span>
          </a>

          <nav className={`desktop-nav ${menuOpen ? "mobile-open" : ""}`}>
            <a href="#home" onClick={() => setMenuOpen(false)}>
              Home
            </a>

            <a href="#about" onClick={() => setMenuOpen(false)}>
              About
            </a>

            <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
              How It Works
            </a>

            <a href="#plans" onClick={() => setMenuOpen(false)}>
              Plans
            </a>

            <a href="#referral" onClick={() => setMenuOpen(false)}>
              Referral
            </a>

            <a href="#faq" onClick={() => setMenuOpen(false)}>
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
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      <main>
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
              A simple platform designed to help you manage your investment,
              track returns, and participate in the XS referral programme.
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

        <section id="about" className="section">
          <div className="section-heading">
            <span className="eyebrow">ABOUT XS</span>

            <h2>A simple way to manage your investment.</h2>

            <p>
              XS Company Limited provides a structured digital platform where
              registered users can manage their investment activity, returns,
              withdrawals and referrals in one place.
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

        <section id="how-it-works" className="section section-dark">
          <div className="section-heading light">
            <span className="eyebrow">HOW IT WORKS</span>

            <h2>Start in a few simple steps.</h2>
          </div>

          <div className="steps-grid">
            <Step number="01" title="Create an account">
              Register and complete the required consent and account
              information.
            </Step>

            <Step number="02" title="Make a deposit">
              Deposit at
