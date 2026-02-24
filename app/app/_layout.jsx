import { Stack } from 'expo-router';
import '../global.css'; // Add Global CSS import for NativeWind

export default function RootLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="matches" />
            <Stack.Screen name="player" />
        </Stack>
    );
}
