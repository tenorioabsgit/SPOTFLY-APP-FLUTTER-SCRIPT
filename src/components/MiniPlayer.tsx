import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePlayer } from '../contexts/PlayerContext';
import { Colors } from '../constants/Colors';
import { Layout } from '../constants/Layout';
import { formatDuration } from '../utils/format';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, position, duration } = usePlayer();
  const router = useRouter();

  if (!currentTrack) return null;

  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.95}
      onPress={() => router.push('/player')}
    >
      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.content}>
        <Image source={{ uri: currentTrack.artwork }} style={styles.artwork} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist}
          </Text>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            style={styles.playButton}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Layout.borderRadius.md,
    marginHorizontal: Layout.padding.sm,
    marginBottom: Layout.padding.xs,
    overflow: 'hidden',
  },
  progressBar: {
    height: 2,
    backgroundColor: Colors.inactive,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Layout.padding.sm,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: Layout.borderRadius.sm,
  },
  info: {
    flex: 1,
    marginLeft: Layout.padding.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    padding: Layout.padding.sm,
  },
});
