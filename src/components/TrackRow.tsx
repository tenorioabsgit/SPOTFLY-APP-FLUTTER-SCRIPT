import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Track } from '../types';
import { Colors } from '../constants/Colors';
import { Layout } from '../constants/Layout';
import { formatDuration } from '../utils/format';
import { usePlayer } from '../contexts/PlayerContext';

interface TrackRowProps {
  track: Track;
  trackList?: Track[];
  index?: number;
  showArtwork?: boolean;
  showIndex?: boolean;
  onOptionsPress?: (track: Track) => void;
}

export default function TrackRow({
  track,
  trackList,
  index,
  showArtwork = true,
  showIndex = false,
  onOptionsPress,
}: TrackRowProps) {
  const { currentTrack, isPlaying, playTrack } = usePlayer();
  const isActive = currentTrack?.id === track.id;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => playTrack(track, trackList)}
      activeOpacity={0.7}
    >
      {showIndex && (
        <View style={styles.indexContainer}>
          {isActive && isPlaying ? (
            <Ionicons name="musical-notes" size={14} color={Colors.primary} />
          ) : (
            <Text style={[styles.index, isActive && styles.activeText]}>
              {(index ?? 0) + 1}
            </Text>
          )}
        </View>
      )}

      {showArtwork && (
        <Image source={{ uri: track.artwork }} style={styles.artwork} />
      )}

      <View style={styles.info}>
        <Text
          style={[styles.title, isActive && styles.activeText]}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      <Text style={styles.duration}>{formatDuration(track.duration)}</Text>

      {onOptionsPress && (
        <TouchableOpacity
          style={styles.optionsButton}
          onPress={() => onOptionsPress(track)}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.padding.sm,
    paddingHorizontal: Layout.padding.md,
  },
  indexContainer: {
    width: 28,
    alignItems: 'center',
  },
  index: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: Layout.borderRadius.sm,
    marginRight: Layout.padding.sm,
  },
  info: {
    flex: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  activeText: {
    color: Colors.primary,
  },
  artist: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  duration: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginLeft: Layout.padding.sm,
  },
  optionsButton: {
    padding: Layout.padding.sm,
    marginLeft: Layout.padding.xs,
  },
});
