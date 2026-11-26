import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [unread, setUnread] = useState(0);

  const save = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => save(await api.login(email, password));
  const loginSSO = async (idToken, nonce) => save(await api.loginSSO(idToken, nonce));
  const register = (data) => api.register(data);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setUnread(0);
  };

  const updateUser = (fields) => {
    setUser((u) => {
      const next = { ...u, ...fields };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  };

  // Compteur de notifications non lues (rafraîchi régulièrement)
  const refreshUnread = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const data = await api.getNotifications();
      setUnread(data.unread_count || 0);
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    // Profil à jour au démarrage (statut, photo…)
    api.getMe().then((me) => updateUser(me)).catch(() => {});
    refreshUnread();
    const id = setInterval(refreshUnread, 60_000);
    return () => clearInterval(id);
  }, [token, refreshUnread]);

  const isAuthenticated = !!token && !!user;
  const isStaff = user?.role === "admin" || user?.role === "bibliothecaire";

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, isStaff, unread, setUnread, refreshUnread, login, loginSSO, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
