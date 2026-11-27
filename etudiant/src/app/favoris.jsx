import React from "react";
import { View, Pressable, FlatList } from "react-native";
import { Redirect, useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../context/AppContext";
import { api } from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { Header, Loading, Empty, ErrorBox, Divider, Btn, toast } from "../components/ui";
import { BookRow } from "../components/Books";

export default function Favoris() {
  const { c, isAuthenticated } = useApp();
  const router = useRouter();
  const { data, setData, error, reload } = useLoad(() => api.favorites(), []);
  if (!isAuthenticated) return <Redirect href="/connexion" />;

  const remove = async (id) => {
    try {
      await api.removeFavorite(id);
      setData((l) => l.filter((x) => x.id !== id));
      toast("Retiré de vos favoris");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <Header title="Mes favoris" />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(b) => String(b.id)}
          ItemSeparatorComponent={() => <Divider inset={88} />}
          ListEmptyComponent={
            <Empty icon="heart" title="Aucun favori" text="Touchez le cœur sur la fiche d'un livre pour le retrouver ici.">
              <Btn title="Parcourir le catalogue" onPress={() => router.push("/catalogue")} style={{ width: 240 }} />
            </Empty>
          }
          renderItem={({ item }) => (
            <BookRow
              book={item}
              right={
                <Pressable onPress={() => remove(item.id)} hitSlop={10} accessibilityLabel={`Retirer ${item.titre} des favoris`} style={{ padding: 6 }}>
                  <Feather name="heart" size={20} color={c.late} />
                </Pressable>
              }
            />
          )}
        />
      )}
    </View>
  );
}
