import React from 'react';
import { Stack, useSegments } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/contexts/AuthContext';
import { PlayerProvider } from '../src/contexts/PlayerContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import { usePlayer } from '../src/contexts/PlayerContext';
import { Colors } from '../src/constants/Colors';
import MiniPlayer from '../src/components/MiniPlayer';

const MAX_APP_WIDTH = 900;

function AppContent() {
  const { currentTrack } = usePlayer();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const isTabScreen = segments[0] === '(tabs)';
  const isPlayerScreen = segments[0] === 'player';
  const isAuthScreen = segments[0] === '(auth)';

  const showGlobalMiniPlayer = currentTrack && !isTabScreen && !isPlayerScreen && !isAuthScreen;

  return (
    <View style={styles.outerContainer}>
      <View style={styles.appContainer}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="player"
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="playlist/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="album/[name]" options={{ headerShown: false }} />
          <Stack.Screen name="artist/[name]" options={{ headerShown: false }} />
          <Stack.Screen name="upload" options={{ headerShown: false }} />
        </Stack>
        {showGlobalMiniPlayer && (
          <View style={[styles.globalMiniPlayer, { bottom: insets.bottom }]}>
            <MiniPlayer />
          </View>
        )}
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <PlayerProvider>
            <StatusBar style="light" />
            <AppContent />
          </PlayerProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  appContainer: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? MAX_APP_WIDTH : undefined,
  },
  globalMiniPlayer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
