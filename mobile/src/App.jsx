import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import AppShell, { RequireAuth, BareShell } from "./components/AppShell";
import { Toaster, Loading } from "./components/ui";
import HomePage from "./pages/HomePage";

const CataloguePage = lazy(() => import("./pages/CataloguePage"));
const BookDetailPage = lazy(() => import("./pages/BookDetailPage"));
const MemoiresPage = lazy(() => import("./pages/MemoiresPage"));
const LoansPage = lazy(() => import("./pages/LoansPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CardPage = lazy(() => import("./pages/CardPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const EditProfilePage = lazy(() => import("./pages/AccountForms").then((m) => ({ default: m.EditProfilePage })));
const PasswordPage = lazy(() => import("./pages/AccountForms").then((m) => ({ default: m.PasswordPage })));
const LoginPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.RegisterPage })));
const SsoCallbackPage = lazy(() => import("./pages/AuthPages").then((m) => ({ default: m.SsoCallbackPage })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const auth = (el) => <RequireAuth>{el}</RequireAuth>;
const bare = (el) => <BareShell>{el}</BareShell>;

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Toaster />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/catalogue" element={<CataloguePage />} />
                <Route path="/livre/:id" element={<BookDetailPage />} />
                <Route path="/memoires" element={<MemoiresPage />} />
                <Route path="/prets" element={auth(<LoansPage />)} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/notifications" element={auth(<NotificationsPage />)} />
                <Route path="/favoris" element={auth(<FavoritesPage />)} />
                <Route path="/profil/modifier" element={auth(<EditProfilePage />)} />
                <Route path="/profil/mot-de-passe" element={auth(<PasswordPage />)} />
              </Route>
              <Route path="/carte" element={bare(auth(<CardPage />))} />
              <Route path="/connexion" element={bare(<LoginPage />)} />
              <Route path="/inscription" element={bare(<RegisterPage />)} />
              <Route path="/sso-callback" element={bare(<SsoCallbackPage />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
