import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ToastContainer from "./components/common/Toast";

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const SsoCallbackPage = lazy(() => import("./pages/auth/SsoCallbackPage"));

import StaffShell from "./components/staff/StaffShell";
const LibrarianDashboard = lazy(() => import("./pages/librarian/LibrarianDashboard"));
const LoansManagementPage = lazy(() => import("./pages/librarian/LoansManagementPage"));
const LoanRequestsPage = lazy(() => import("./pages/librarian/LoanRequestsPage"));
const ReservationsQueuePage = lazy(() => import("./pages/librarian/ReservationsQueuePage"));
const DelaysTrackerPage = lazy(() => import("./pages/librarian/DelaysTrackerPage"));
const BookManagementPage = lazy(() => import("./pages/librarian/BookManagementPage"));
const MembersManagementPage = lazy(() => import("./pages/librarian/MembersManagementPage"));

const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const TaxonomyPage = lazy(() => import("./pages/admin/TaxonomyPage"));
const DigitalResourcesAdminPage = lazy(() => import("./pages/admin/DigitalResourcesAdminPage"));
const ActivityLogsPage = lazy(() => import("./pages/admin/ActivityLogsPage"));
const ReportsPage = lazy(() => import("./pages/admin/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));

function PageLoader() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
    </div>
  );
}

// Personnel (bibliothécaire ou administrateur)
function StaffRoute({ children }) {
  const { isAuthenticated, isStaff } = useAuth();
  if (!isAuthenticated || !isStaff) return <Navigate to="/connexion" replace />;
  return <StaffShell>{children}</StaffShell>;
}

// Administrateurs uniquement
function AdminRoute({ children }) {
  const { isAuthenticated, isStaff, isAdmin } = useAuth();
  if (!isAuthenticated || !isStaff) return <Navigate to="/connexion" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <StaffShell>{children}</StaffShell>;
}

const staff = (el) => <StaffRoute>{el}</StaffRoute>;
const admin = (el) => <AdminRoute>{el}</AdminRoute>;

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <ToastContainer />
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/connexion" element={<LoginPage />} />
              <Route path="/sso-callback" element={<SsoCallbackPage />} />

              <Route path="/" element={staff(<LibrarianDashboard />)} />
              <Route path="/emprunts" element={staff(<LoansManagementPage />)} />
              <Route path="/demandes" element={staff(<LoanRequestsPage />)} />
              <Route path="/reservations" element={staff(<ReservationsQueuePage />)} />
              <Route path="/retards" element={staff(<DelaysTrackerPage />)} />
              <Route path="/catalogue" element={staff(<BookManagementPage />)} />
              <Route path="/adherents" element={staff(<MembersManagementPage />)} />
              <Route path="/visiteurs" element={staff(<MembersManagementPage />)} />
              <Route path="/memoires" element={staff(<DigitalResourcesAdminPage />)} />

              <Route path="/utilisateurs" element={admin(<AdminUsersPage />)} />
              <Route path="/referentiels" element={admin(<TaxonomyPage />)} />
              <Route path="/rapports" element={admin(<ReportsPage />)} />
              <Route path="/journal" element={admin(<ActivityLogsPage />)} />
              <Route path="/parametres" element={admin(<SettingsPage />)} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
