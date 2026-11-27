import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Modal, Animated, StyleSheet, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import { useApp } from "../context/AppContext";
import { font, alpha } from "../lib/theme";

// ---------------------------------------------------------------- Texte
const variants = {
  h1: { fontFamily: font.display, fontSize: 28, lineHeight: 32 },
  h2: { fontFamily: font.display, fontSize: 22, lineHeight: 27 },
  title: { fontFamily: font.displaySemi, fontSize: 18, lineHeight: 23 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  strong: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  tiny: { fontFamily: font.medium, fontSize: 11, lineHeight: 14 },
};

export function Txt({ v = "body", color, muted, style, ...rest }) {
  const { c } = useApp();
  return <Text style={[variants[v], { color: color || (muted ? c.muted : c.ink) }, style]} {...rest} />;
}

export const Icon = ({ name, size = 20, color, style }) => {
  const { c } = useApp();
  return <Feather name={name} size={size} color={color || c.ink} style={style} />;
};

// ---------------------------------------------------------------- Boutons
export function Btn({ title, onPress, kind = "primary", icon, loading, disabled, style, small }) {
  const { c } = useApp();
  const bg = { primary: c.brand, quiet: alpha(c.ink, 0.06), danger: alpha(c.late, 0.1), outline: c.surface }[kind];
  const fg = { primary: c.onBrand, quiet: c.ink, danger: c.late, outline: c.ink }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: !!loading }}
      style={({ pressed }) => [
        s.btn,
        small && { paddingVertical: 9, paddingHorizontal: 14 },
        { backgroundColor: bg, opacity: off ? 0.55 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        kind === "outline" && { borderWidth: 1, borderColor: c.line },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Feather name={icon} size={18} color={fg} /> : null}
      {!!title && <Text style={{ fontFamily: font.semibold, fontSize: 15, color: fg }}>{title}</Text>}
    </Pressable>
  );
}

export function LinkText({ children, onPress, color, style }) {
  const { c } = useApp();
  return (
    <Text onPress={onPress} accessibilityRole="link" style={[{ fontFamily: font.semibold, color: color || c.brand }, style]}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------- Champs
export function Field({ label, hint, style, inputStyle, right, ...input }) {
  const { c } = useApp();
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {!!label && <Txt v="smallStrong" style={{ marginBottom: 6 }}>{label}</Txt>}
      <View>
        <TextInput
          placeholderTextColor={alpha(c.muted, 0.75)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={[
            s.input,
            { backgroundColor: c.surface, borderColor: focus ? c.brand : c.line, color: c.ink },
            input.editable === false && { opacity: 0.6 },
            right && { paddingRight: 48 },
            inputStyle,
          ]}
          {...input}
        />
        {right && <View style={s.inputRight}>{right}</View>}
      </View>
      {!!hint && <Txt v="small" muted style={{ marginTop: 5 }}>{hint}</Txt>}
    </View>
  );
}

export function PasswordField(props) {
  const [show, setShow] = useState(false);
  return (
    <Field
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <Pressable onPress={() => setShow((x) => !x)} hitSlop={10} accessibilityLabel={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
          <Icon name={show ? "eye-off" : "eye"} size={19} />
        </Pressable>
      }
      {...props}
    />
  );
}

// ---------------------------------------------------------------- Écrans
export function Screen({ children, scroll = true, style, contentStyle, refreshControl, edges = ["top"] }) {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: edges.includes("top") ? insets.top : 0 };
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: c.paper }, pad, style]}>{children}</View>;
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: c.paper }, style]}
      contentContainerStyle={[pad, { paddingBottom: 28 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

/** En-tête d'un écran secondaire, avec retour. */
export function Header({ title, right, transparent }) {
  const { c } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: transparent ? "transparent" : c.paper }}>
      <View style={s.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={({ pressed }) => [s.round, pressed && { backgroundColor: alpha(c.ink, 0.06) }]}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={6}
        >
          <Icon name="chevron-left" size={26} />
        </Pressable>
        <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>{title}</Txt>
        {right}
      </View>
    </View>
  );
}

export function IconBtn({ name, onPress, label, color, filled }) {
  const { c } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={({ pressed }) => [s.round, pressed && { backgroundColor: alpha(c.ink, 0.06) }]}>
      <Feather name={name} size={21} color={color || c.ink} style={filled ? { opacity: 1 } : null} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Filtres
export function Chips({ value, onChange, options }) {
  const { c } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const label = typeof o === "string" ? o : o.label;
        const on = val === value;
        return (
          <Pressable
            key={val}
            onPress={() => onChange(val)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[s.chip, { backgroundColor: on ? c.ink : c.surface, borderColor: on ? c.ink : c.line }]}
          >
            <Text style={{ fontFamily: font.medium, fontSize: 14, color: on ? c.paper : c.ink }}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Segmented({ value, onChange, options }) {
  const { c } = useApp();
  return (
    <View style={[s.segment, { backgroundColor: alpha(c.ink, 0.06) }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.segItem, on && { backgroundColor: c.surface, ...shadow(1) }]}
          >
            <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, color: on ? c.ink : c.muted }}>
              {o.label}
              {o.count > 0 ? <Text style={{ color: on ? c.brand : c.muted }}> {o.count}</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- États
export function Loading() {
  const { c } = useApp();
  return (
    <View style={{ paddingVertical: 64, alignItems: "center" }}>
      <ActivityIndicator size="large" color={c.brand} />
    </View>
  );
}

export function Empty({ icon, title, text, children }) {
  const { c } = useApp();
  return (
    <View style={{ paddingVertical: 48, paddingHorizontal: 24, alignItems: "center" }}>
      {icon && (
        <View style={[s.emptyIcon, { backgroundColor: alpha(c.ink, 0.06) }]}>
          <Feather name={icon} size={26} color={c.muted} />
        </View>
      )}
      <Txt v="strong" style={{ textAlign: "center" }}>{title}</Txt>
      {!!text && <Txt v="small" muted style={{ textAlign: "center", marginTop: 4, maxWidth: 280 }}>{text}</Txt>}
      {children && <View style={{ marginTop: 20, alignSelf: "stretch", alignItems: "center" }}>{children}</View>}
    </View>
  );
}

export function ErrorBox({ message, onRetry }) {
  const { c } = useApp();
  return (
    <View style={{ margin: 16, padding: 16, borderRadius: 16, backgroundColor: alpha(c.late, 0.1) }}>
      <Txt v="small" color={c.late}>{message}</Txt>
      {onRetry && <LinkText onPress={onRetry} color={c.late} style={{ marginTop: 8, textDecorationLine: "underline" }}>Réessayer</LinkText>}
    </View>
  );
}

export function Card({ children, style }) {
  const { c } = useApp();
  return <View style={[{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.line, overflow: "hidden" }, style]}>{children}</View>;
}

export function Divider({ inset = 0 }) {
  const { c } = useApp();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: inset }} />;
}

/** Ligne de menu (profil) */
export function MenuRow({ icon, label, onPress, right, danger, iconColor }) {
  const { c } = useApp();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.menuRow, pressed && { backgroundColor: alpha(c.ink, 0.04) }]}>
      <Feather name={icon} size={20} color={danger ? c.late : iconColor || c.muted} />
      <Txt style={{ flex: 1 }} color={danger ? c.late : undefined}>{label}</Txt>
      {right !== undefined ? right : !danger && <Feather name="chevron-right" size={18} color={c.muted} />}
    </Pressable>
  );
}

export function Toggle({ on }) {
  const { c } = useApp();
  return (
    <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: on ? c.brand : c.line }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", transform: [{ translateX: on ? 18 : 0 }] }} />
    </View>
  );
}

// ---------------------------------------------------------------- Feuille qui monte du bas
export function Sheet({ open, onClose, title, children }) {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,16,32,0.45)" }]} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={[s.grabber, { backgroundColor: c.line }]} />
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 8 }}>
            <Txt v="title" style={{ flex: 1 }}>{title}</Txt>
            <Pressable onPress={onClose} style={[s.round, { backgroundColor: alpha(c.ink, 0.06), width: 36, height: 36 }]} accessibilityLabel="Fermer">
              <Feather name="x" size={18} color={c.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------- Messages éphémères
let push = () => {};
export const toast = (message, type = "success") => push({ message, type, id: Math.random() });

export function Toaster() {
  const { c } = useApp();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef();

  useEffect(() => {
    push = (t) => {
      clearTimeout(timer.current);
      setItem(t);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== "web" }).start();
      timer.current = setTimeout(() => setItem(null), 3800);
    };
  }, [anim]);

  if (!item) return null;
  const icon = { success: "check-circle", error: "alert-circle", info: "info" }[item.type];
  const tone = { success: c.ok, error: c.late, info: c.brand }[item.type];
  return (
    <Animated.View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[s.toastWrap, { top: insets.top + 8, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}
    >
      <Pressable onPress={() => setItem(null)} style={[s.toast, { backgroundColor: c.surface, borderColor: c.line }, shadow(4)]}>
        <Feather name={icon} size={20} color={tone} />
        <Txt v="small" style={{ flex: 1 }}>{item.message}</Txt>
      </Pressable>
    </Animated.View>
  );
}

export const shadow = (level = 2) =>
  Platform.select({
    android: { elevation: level * 2 },
    default: { shadowColor: "#14213D", shadowOpacity: 0.08 + level * 0.03, shadowRadius: level * 4, shadowOffset: { width: 0, height: level } },
  });

const s = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: Platform.OS === "ios" ? 14 : 11, fontFamily: font.regular, fontSize: 15 },
  inputRight: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  header: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  segment: { flexDirection: "row", padding: 4, borderRadius: 16, gap: 2 },
  segItem: { flexGrow: 1, flexBasis: "auto", alignItems: "center", paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", paddingTop: 10 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  toastWrap: { position: "absolute", left: 12, right: 12, zIndex: 100 },
  toast: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
});
