import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { formatDuration } from '../../src/utils/format';
import { Playlist, Track } from '../../src/types';
import TrackRow from '../../src/components/TrackRow';
import { loadData, saveData, KEYS } from '../../src/services/storage';
import { getPlaylist as firestoreGetPlaylist, getTracksByIds as firestoreGetTracksByIds } from '../../src/services/firestore';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playQueue, playTrack } = usePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  async function loadPlaylist() {
    if (!id) return;
    try {
      // Load from Firestore
      const found = await firestoreGetPlaylist(id);
      if (found) {
        setPlaylist(found);
        if (found.trackIds.length > 0) {
          const tracks = await firestoreGetTracksByIds(found.trackIds);
          setPlaylistTracks(tracks);
        }
      }
    } catch (e) {
      console.error('Error loading playlist:', e);
    }
  }

  const totalDuration = useMemo(() => {
    const total = playlistTracks.reduce((sum, t) => sum + t.duration, 0);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} h ${mins} min`;
    return `${mins} min`;
  }, [playlistTracks]);

  async function handleShare() {
    if (!playlist) return;
    try {
      await Share.share({
        message: `Confira a playlist "${playlist.title}" no Spotfly! 🎵\n${playlist.description}\nShare, Build, Share!`,
      });
    } catch (e) {
      console.error('Error sharing:', e);
    }
  }

  async function handleRemoveTrack(track: Track) {
    if (!playlist) return;
    Alert.alert(
      'Remover música',
      `Remover "${track.title}" desta playlist?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const updatedIds = playlist.trackIds.filter(tid => tid !== track.id);
            const updatedPlaylist = { ...playlist, trackIds: updatedIds, updatedAt: Date.now() };
            setPlaylist(updatedPlaylist);
            setPlaylistTracks(prev => prev.filter(t => t.id !== track.id));
          },
        },
      ]
    );
  }

  if (!playlist) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={playlistTracks}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#2a4a3a', Colors.background]}
              style={styles.headerGradient}
            >
              {/* Back button */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>

              {/* Artwork */}
              <View style={styles.artworkContainer}>
                <Image
                  source={{ uri: playlist.artwork }}
                  style={styles.artwork}
                />
              </View>

              {/* Info */}
              <Text style={styles.playlistTitle}>{playlist.title}</Text>
              {playlist.description && (
                <Text style={styles.playlistDesc}>{playlist.description}</Text>
              )}
              <Text style={styles.playlistMeta}>
                {playlist.createdBy} · {playlistTracks.length} músicas, {totalDuration}
              </Text>

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => {}}>
                  <Ionicons name="heart-outline" size={26} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {}}>
                  <Ionicons name="download-outline" size={26} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare}>
                  <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {}}>
                  <Ionicons name="ellipsis-horizontal" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={styles.shuffleButton}
                  onPress={() => {
                    if (playlistTracks.length > 0) {
                      const shuffled = [...playlistTracks].sort(() => Math.random() - 0.5);
                      playQueue(shuffled);
                    }
                  }}
                >
                  <Ionicons name="shuffle" size={18} color={Colors.background} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => {
                    if (playlistTracks.length > 0) {
                      playQueue(playlistTracks);
                    }
                  }}
                >
                  <Ionicons name="play" size={26} color={Colors.background} />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </>
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            trackList={playlistTracks}
            index={index}
            showIndex
            onOptionsPress={(track) => handleRemoveTrack(track)}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <View style={styles.licenseBanner}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
              <Text style={styles.licenseText}>
                Todas as músicas desta playlist são livres de royalties
              </Text>
            </View>
            <View style={{ height: Layout.miniPlayerHeight + Layout.tabBarHeight + 20 }} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  headerGradient: {
    paddingBottom: Layout.padding.md,
  },
  backButton: {
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    paddingBottom: Layout.padding.sm,
  },
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: Layout.padding.md,
  },
  artwork: {
    width: 200,
    height: 200,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  playlistTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.md,
    marginTop: Layout.padding.sm,
  },
  playlistDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: Layout.padding.md,
    marginTop: 4,
  },
  playlistMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    paddingHorizontal: Layout.padding.md,
    marginTop: Layout.padding.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    gap: Layout.padding.lg,
  },
  shuffleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2,
  },
  footer: {
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.xl,
  },
  licenseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    padding: Layout.padding.md,
    borderRadius: Layout.borderRadius.md,
  },
  licenseText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginLeft: Layout.padding.sm,
    flex: 1,
  },
});
