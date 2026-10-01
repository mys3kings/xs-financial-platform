import { Routes, Route } from "react-router-dom";

import Home from "./Home";
import Register from "./Register";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import Dashboard from "./Dashboard";
import Deposit from "./Deposit";
import Withdraw from "./Withdraw";
import Referral from "./Referral";
import Admin from "./Admin";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      {/* -------------------------------- */}
      {/* PUBLIC PAGES */}
      {/* -------------------------------- */}

      <Route
        path="/"
        element={<Home />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      {/* -------------------------------- */}
      {/* ADMIN PAGE */}
      {/* -------------------------------- */}

      <Route
        path="/admin"
        element={<Admin />}
      />

      {/* -------------------------------- */}
      {/* PROTECTED USER PAGES */}
      {/* -------------------------------- */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/deposit"
        element={
          <ProtectedRoute>
            <Deposit />
          </ProtectedRoute>
        }
      />

      <Route
        path="/withdraw"
        element={
          <ProtectedRoute>
            <Withdraw />
          </ProtectedRoute>
        }
      />

      <Route
        path="/referral"
        element={
          <ProtectedRoute>
            <Referral />
          </ProtectedRoute>
        }
      />

      {/* -------------------------------- */}
      {/* FALLBACK */}
      {/* -------------------------------- */}

      <Route
        path="*"
        element={<Home />}
      />
    </Routes>
  );
}
