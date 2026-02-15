import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Share,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from './components/Slider';
import { usePlayer } from '../src/contexts/PlayerContext';
import { Colors } from '../src/constants/Colors';
import { Layout } from '../src/constants/Layout';
import { formatDuration } from '../src/utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - 80;

export default function PlayerScreen() {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    shuffle,
    repeat,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();
  const router = useRouter();
  const [liked, setLiked] = useState(false);

  const panX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 30,
      onPanResponderMove: Animated.event([null, { dx: panX }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) {
          Animated.spring(panX, { toValue: -SCREEN_WIDTH, useNativeDriver: false }).start(() => {
            nextTrack();
            panX.setValue(0);
          });
        } else if (gs.dx > 50) {
          Animated.spring(panX, { toValue: SCREEN_WIDTH, useNativeDriver: false }).start(() => {
            previousTrack();
            panX.setValue(0);
          });
        } else {
          Animated.spring(panX, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  if (!currentTrack) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nenhuma música tocando</Text>
      </View>
    );
  }

  async function handleShare() {
    if (!currentTrack) return;
    try {
      await Share.share({
        message: `Ouça "${currentTrack.title}" de ${currentTrack.artist} no Spotfly! 🎵\nShare, Build, Share - ${currentTrack.license}`,
      });
    } catch (e) {
      console.error('Error sharing:', e);
    }
  }

  const progress = duration > 0 ? position / duration : 0;

  return (
    <LinearGradient
      colors={['#2a4a3a', '#1a2a1a', Colors.background]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-down" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>TOCANDO DO</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentTrack.album}
            </Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="share-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Artwork */}
        <View style={styles.artworkContainer}>
          <Animated.View
            {...panResponder.panHandlers}
            style={{ transform: [{ translateX: panX }] }}
          >
            <Image
              source={{ uri: currentTrack.artwork }}
              style={styles.artwork}
            />
          </Animated.View>
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <View style={styles.trackInfoLeft}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setLiked(!liked)}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={26}
              color={liked ? Colors.primary : Colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <Slider
            value={progress}
            onValueChange={(val) => seekTo(val * duration)}
          />
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(Math.floor(position))}</Text>
            <Text style={styles.timeText}>{formatDuration(Math.floor(duration))}</Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={toggleShuffle} style={styles.controlButton}>
            <Ionicons
              name="shuffle"
              size={24}
              color={shuffle ? Colors.primary : Colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={previousTrack} style={styles.controlButton}>
            <Ionicons name="play-skip-back" size={30} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={36}
              color={Colors.background}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={nextTrack} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={30} color={Colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleRepeat} style={styles.controlButton}>
            <Ionicons
              name={repeat === 'one' ? 'repeat' : 'repeat'}
              size={24}
              color={repeat !== 'off' ? Colors.primary : Colors.textSecondary}
            />
            {repeat === 'one' && (
              <View style={styles.repeatOneBadge}>
                <Text style={styles.repeatOneText}>1</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity>
            <Ionicons name="phone-portrait-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.licenseBadge}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
            <Text style={styles.licenseText}>{currentTrack.license}</Text>
          </View>
          <TouchableOpacity>
            <Ionicons name="list" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Layout.padding.lg,
    paddingBottom: Layout.padding.xl,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Layout.padding.md,
  },
  headerButton: {
    padding: Layout.padding.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  artworkContainer: {
    alignItems: 'center',
    marginVertical: Layout.padding.lg,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: Layout.borderRadius.lg,
    backgroundColor: Colors.surfaceElevated,
  },
  trackInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackInfoLeft: {
    flex: 1,
    marginRight: Layout.padding.md,
  },
  trackTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  trackArtist: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 4,
  },
  progressContainer: {
    marginTop: Layout.padding.lg,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Layout.padding.md,
  },
  controlButton: {
    padding: Layout.padding.sm,
    position: 'relative',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
  },
  repeatOneBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    color: Colors.background,
    fontSize: 8,
    fontWeight: '700',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Layout.padding.lg,
  },
  licenseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Layout.padding.sm,
    paddingVertical: 4,
    borderRadius: Layout.borderRadius.round,
  },
  licenseText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
});
