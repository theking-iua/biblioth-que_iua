import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

const STAFF = ["admin", "bibliothecaire"];
export const MOBILE_APP_URL = import.meta.env.VITE_MOBILE_URL || "http://localhost:5174";

// L'appli admin n'accepte que le personnel : un lecteur est renvoyé vers l'appli mobile
function assertStaff(user) {
  if (!STAFF.includes(user?.role)) {
    const err = new Error("Cet espace est réservé au personnel de la bibliothèque. Les lecteurs se connectent depuis l'application mobile.");
    err.notStaff = true;
    throw err;
  }
}

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await api.login(email, password);
      assertStaff(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const loginSSO = async (idToken, nonce) => {
    setLoading(true);
    try {
      const data = await api.loginSSO(idToken, nonce);
      assertStaff(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedFields) => {
    const updated = { ...user, ...updatedFields };
    localStorage.setItem("user", JSON.stringify(updated));
    setUser(updated);
  };

  const role = user?.role || "visiteur";
  const isAuthenticated = !!token && !!user;
  const isAdmin = role === "admin";
  const isLibrarian = role === "bibliothecaire";
  const isStaff = isAdmin || isLibrarian;
  const isAdherent = role === "adherent";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isAuthenticated,
        isAdmin,
        isLibrarian,
        isStaff,
        isAdherent,
        loading,
        login,
        loginSSO,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé au sein d'un AuthProvider");
  }
  return context;
}
