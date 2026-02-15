import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Track } from '../../src/types';
import TrackRow from '../../src/components/TrackRow';
import SectionHeader from '../../src/components/SectionHeader';
import { getTracksByArtist } from '../../src/services/firestore';

interface AlbumGroup {
  name: string;
  artwork: string;
  trackCount: number;
}

export default function ArtistScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { playQueue } = usePlayer();
  const { t } = useLanguage();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArtist();
  }, [name]);

  async function loadArtist() {
    if (!name) return;
    try {
      const result = await getTracksByArtist(name);
      setTracks(result);
    } catch (e) {
      console.error('Error loading artist:', e);
    } finally {
      setLoading(false);
    }
  }

  const artistImage = tracks.length > 0 ? tracks[0].artwork : '';

  const albums = useMemo(() => {
    const map = new Map<string, AlbumGroup>();
    for (const track of tracks) {
      if (track.album) {
        const existing = map.get(track.album);
        if (existing) {
          existing.trackCount++;
        } else {
          map.set(track.album, {
            name: track.album,
            artwork: track.artwork,
            trackCount: 1,
          });
        }
      }
    }
    return [...map.values()];
  }, [tracks]);

  const totalDuration = useMemo(() => {
    const total = tracks.reduce((sum, t) => sum + t.duration, 0);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} h ${mins} min`;
    return `${mins} min`;
  }, [tracks]);

  async function handleShare() {
    try {
      await Share.share({
        message: `Ouça ${name} no Spotfly! 🎵\nShare, Build, Share!`,
      });
    } catch (e) {
      console.error('Error sharing:', e);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#2a4a3a', Colors.background]}
              style={styles.headerGradient}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: artistImage }}
                  style={styles.artistImage}
                />
              </View>

              <Text style={styles.artistName}>{name}</Text>
              <Text style={styles.artistMeta}>
                {albums.length} {t('artist.albums')} · {tracks.length} {t('artist.songs')}
                {totalDuration !== '0 min' ? ` · ${totalDuration}` : ''}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity onPress={handleShare}>
                  <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  style={styles.shuffleButton}
                  onPress={() => {
                    if (tracks.length > 0) {
                      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                      playQueue(shuffled);
                    }
                  }}
                >
                  <Ionicons name="shuffle" size={18} color={Colors.background} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playButton}
                  onPress={() => {
                    if (tracks.length > 0) {
                      playQueue(tracks);
                    }
                  }}
                >
                  <Ionicons name="play" size={26} color={Colors.background} />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Albums section */}
            {albums.length > 0 && (
              <>
                <SectionHeader title={t('artist.albums')} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.albumsRow}
                >
                  {albums.map((album) => (
                    <TouchableOpacity
                      key={album.name}
                      style={styles.albumCard}
                      onPress={() => router.push(`/album/${encodeURIComponent(album.name)}`)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: album.artwork }} style={styles.albumArtwork} />
                      <Text style={styles.albumTitle} numberOfLines={1}>{album.name}</Text>
                      <Text style={styles.albumMeta}>{album.trackCount} {t('artist.songs')}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <SectionHeader title={t('artist.tracks')} />
          </>
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            trackList={tracks}
            index={index}
            showIndex
          />
        )}
        ListFooterComponent={
          <View style={{ height: Layout.miniPlayerHeight + 30 }} />
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
  imageContainer: {
    alignItems: 'center',
    paddingVertical: Layout.padding.md,
  },
  artistImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.surfaceElevated,
  },
  artistName: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.md,
    marginTop: Layout.padding.sm,
    textAlign: 'center',
  },
  artistMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    paddingHorizontal: Layout.padding.md,
    marginTop: Layout.padding.sm,
    textAlign: 'center',
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
  albumsRow: {
    paddingHorizontal: Layout.padding.md,
  },
  albumCard: {
    width: 140,
    marginRight: Layout.padding.sm,
  },
  albumArtwork: {
    width: 140,
    height: 140,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  albumTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
  },
  albumMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});
