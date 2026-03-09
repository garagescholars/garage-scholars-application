import { Stack } from "expo-router";
import { colors } from "../../../src/constants/theme";

export default function ConsultationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Consultations" }} />
      <Stack.Screen name="new" options={{ title: "New Consultation" }} />
      <Stack.Screen name="[id]/configure" options={{ title: "Configure Mockups" }} />
      <Stack.Screen name="[id]/mockups" options={{ title: "Mockup Presentation" }} />
    </Stack>
  );
}
