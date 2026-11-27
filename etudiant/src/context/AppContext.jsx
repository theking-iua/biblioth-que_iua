// Contexte global : session (jeton, profil), thème clair/sombre, compteur de notifications.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { api, setToken, setUnauthorizedHandler, loadApiUrl } from "../lib/api";
import { storage } from "../lib/storage";
import { light, dark } from "../lib/theme";
import { clearReminders } from "../lib/reminders";

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const system = useColorScheme();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [themePref, setThemePref] = useState("system"); // system | light | dark
  const [unread, setUnread] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    setUnread(0);
    await storage.remove("token");
    await storage.remove("user");
    await clearReminders();
  }, []);

  // Démarrage : adresse du serveur, session et thème enregistrés
  useEffect(() => {
    (async () => {
      await loadApiUrl();
      const [t, u, th] = await Promise.all([storage.get("token"), storage.get("user"), storage.get("theme")]);
      if (th) setThemePref(th);
      if (t && u) {
        setToken(t);
        try {
          setUser(JSON.parse(u));
        } catch {
          /* profil illisible : on garde la session, /me le rechargera */
        }
      }
      setReady(true);
    })();
    setUnauthorizedHandler(() => {
      setSessionExpired(true);
      logout();
    });
  }, [logout]);

  const saveUser = useCallback(async (u) => {
    setUser(u);
    await storage.set("user", JSON.stringify(u));
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.token);
    await storage.set("token", data.token);
    await saveUser(data.user);
    setSessionExpired(false);
    return data.user;
  };

  const updateUser = (fields) => saveUser({ ...user, ...fields });

  const refreshUnread = useCallback(() => {
    api
      .notifications()
      .then((d) => setUnread(d.unread_count || 0))
      .catch(() => {}); // silencieux
  }, []);

  // Profil à jour + compteur de notifications quand on est connecté
  const loggedIn = !!user;
  useEffect(() => {
    if (!loggedIn) return;
    api.me().then((me) => saveUser(me)).catch(() => {});
    refreshUnread();
    const id = setInterval(refreshUnread, 60_000);
    return () => clearInterval(id);
  }, [loggedIn, refreshUnread, saveUser]);

  const isDark = themePref === "system" ? system === "dark" : themePref === "dark";
  const setTheme = async (pref) => {
    setThemePref(pref);
    await storage.set("theme", pref);
  };

  const value = useMemo(
    () => ({
      ready, user, isAuthenticated: loggedIn, login, logout, updateUser,
      unread, setUnread, refreshUnread, sessionExpired,
      c: isDark ? dark : light, isDark, themePref, setTheme,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, user, unread, isDark, themePref, sessionExpired]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp doit être utilisé dans AppProvider");
  return v;
}
