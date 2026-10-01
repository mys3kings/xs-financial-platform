import { Routes, Route } from "react-router-dom";

import Home from "./Home";
import Register from "./Register";
import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import Dashboard from "./Dashboard";
import Deposit from "./Deposit";
import Withdraw from "./Withdraw";
import Referral from "./Referral";
import ProtectedRoute from "./ProtectedRoute";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/forgot-password"
        element={<ForgotPassword />}
      />

      {/* Protected user pages */}
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

      {/* Fallback */}
      <Route path="*" element={<Home />} />
    </Routes>
  );
        }
