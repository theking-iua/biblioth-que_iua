import React from "react";
import { View, Pressable, FlatList, RefreshControl } from "react-native";
import { Redirect } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { Header, Txt, Loading, Empty, ErrorBox, Divider, toast } from "../components/ui";
import { relative } from "../lib/format";
import { alpha, font } from "../lib/theme";

const ICONS = { retard: "alert-triangle", emprunt: "bookmark", reservation: "clock", rappel: "refresh-cw", info: "info", systeme: "info" };

export default function Notifications() {
  const { c, isAuthenticated, setUnread } = useApp();
  const { data, setData, error, reload, refreshing, onRefresh } = useLoad(async () => {
    const d = await api.notifications();
    setUnread(d.unread_count);
    return d.notifications;
  }, []);

  if (!isAuthenticated) return <Redirect href="/connexion" />;

  const tone = (t) => ({ retard: c.late, reservation: c.ok, rappel: c.ochre }[t] || c.brand);

  const markOne = (n) => {
    if (Number(n.lu) === 1) return;
    setData((l) => l.map((x) => (x.id === n.id ? { ...x, lu: 1 } : x)));
    setUnread((u) => Math.max(0, u - 1));
    api.markRead(n.id).catch(() => {});
  };

  const markAll = async () => {
    try {
      await api.markAllRead();
      setData((l) => l.map((x) => ({ ...x, lu: 1 })));
      setUnread(0);
      toast("Toutes les notifications sont lues");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const hasUnread = data?.some((n) => Number(n.lu) === 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Header
        title="Notifications"
        right={hasUnread ? <Txt v="smallStrong" color={c.brand} onPress={markAll} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>Tout marquer lu</Txt> : null}
      />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(n) => String(n.id)}
          ItemSeparatorComponent={() => <Divider />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.brand]} tintColor={c.brand} />}
          ListEmptyComponent={<Empty icon="bell-off" title="Rien de nouveau" text="Vous serez prévenu ici quand une demande est validée ou qu'un livre réservé vous attend." />}
          renderItem={({ item: n }) => {
            const unread = Number(n.lu) === 0;
            const t = tone(n.type);
            return (
              <Pressable onPress={() => markOne(n)} style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: unread ? alpha(c.brand, 0.05) : "transparent" }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: alpha(t, 0.12), alignItems: "center", justifyContent: "center" }}>
                  <Feather name={ICONS[n.type] || "info"} size={19} color={t} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Txt style={{ flex: 1, fontFamily: unread ? font.semibold : font.medium }}>{n.titre}</Txt>
                    {unread && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.brand, marginTop: 6 }} accessibilityLabel="Non lue" />}
                  </View>
                  <Txt v="small" muted style={{ marginTop: 2 }}>{n.message}</Txt>
                  <Txt v="tiny" muted style={{ marginTop: 6, fontSize: 12 }}>{relative(n.date_creation)}</Txt>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
