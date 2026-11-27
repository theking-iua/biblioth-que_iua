// Rappels de retour : notifications locales programmées sur le téléphone (aucun serveur de push nécessaire).
// Pour chaque prêt en cours : un rappel 2 jours avant l'échéance et un le jour même, à 9 h.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { parseDate } from "./format";
import { storage } from "./storage";

const CHANNEL = "rappels-retour";
const native = Platform.OS !== "web";

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function remindersEnabled() {
  return (await storage.get("rappels")) !== "off";
}

export async function setRemindersEnabled(on) {
  await storage.set("rappels", on ? "on" : "off");
  if (!on && native) await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Demande l'autorisation (Android 13+ : il faut d'abord un canal). Renvoie true si accordée. */
export async function ensurePermission() {
  if (!native) return false;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Rappels de retour",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return !!asked.granted;
}

const at9 = (d, daysBefore) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBefore, 9, 0, 0, 0);
  return x;
};

/** Reprogramme tous les rappels d'après la liste des prêts. */
export async function syncReminders(loans) {
  if (!native || !(await remindersEnabled())) return;
  try {
    if (!(await ensurePermission())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const l of loans.filter((x) => x.statut === "en_cours")) {
      const due = parseDate(l.date_retour_prevue);
      if (!due) continue;
      const plan = [
        { date: at9(due, 2), body: `« ${l.titre} » est à rendre dans 2 jours. Pensez à le prolonger si besoin.` },
        { date: at9(due, 0), body: `« ${l.titre} » est à rendre aujourd'hui à la bibliothèque.` },
      ];
      for (const p of plan) {
        if (p.date.getTime() <= now) continue;
        await Notifications.scheduleNotificationAsync({
          content: { title: "Rappel de retour", body: p.body, data: { url: "/prets" } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date, channelId: CHANNEL },
        });
      }
    }
  } catch {
    /* les rappels sont un confort : jamais bloquants */
  }
}

export async function clearReminders() {
  if (native) await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}
