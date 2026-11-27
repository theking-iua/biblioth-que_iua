// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", "android/*", "ios/*"] },
  {
    rules: {
      // Les apostrophes françaises dans <Text> ne posent aucun problème en React Native (règle pensée pour le HTML)
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // AndroidImportance est réexporté par « export * » : le plugin d'import ne le voit pas
    files: ["src/lib/reminders.js"],
    rules: { "import/namespace": "off" },
  },
]);
