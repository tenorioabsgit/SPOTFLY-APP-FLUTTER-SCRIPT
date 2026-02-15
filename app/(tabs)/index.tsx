import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Track } from '../../src/types';
import { getAllTracks, getPublicPlaylists, getUserPlaylists } from '../../src/services/firestore';
import { Playlist } from '../../src/types';
import SectionHeader from '../../src/components/SectionHeader';
import TrackRow from '../../src/components/TrackRow';
import LanguageToggle from '../../src/components/LanguageToggle';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface AlbumCard {
  name: string;
  artist: string;
  artwork: string;
}

interface ArtistCard {
  name: string;
  image: string;
}

type FilterType = 'all' | 'music' | 'playlists';

export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('all');
  const [allTrks, setAllTrks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const greeting = getGreeting();

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      const [tracks, pubPl, userPl] = await Promise.all([
        getAllTracks(100),
        getPublicPlaylists(10).catch(() => []),
        user ? getUserPlaylists(user.id).catch(() => []) : Promise.resolve([]),
      ]);
      setAllTrks(tracks);
      const ids = new Set(userPl.map(p => p.id));
      setPlaylists([...userPl, ...pubPl.filter(p => !ids.has(p.id))]);
    } catch (e) {
      console.error('Error loading home data:', e);
    } finally {
      setIsLoading(false);
    }
  }

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.goodMorning');
    if (hour < 18) return t('home.goodAfternoon');
    return t('home.goodEvening');
  }

  const trendingTracks = useMemo(() => shuffle(allTrks).slice(0, 8), [allTrks]);

  const albumCards = useMemo(() => {
    const map = new Map<string, AlbumCard>();
    for (const t of allTrks) {
      if (t.album && !map.has(t.album)) {
        map.set(t.album, { name: t.album, artist: t.artist, artwork: t.artwork });
      }
    }
    return shuffle([...map.values()]).slice(0, 8);
  }, [allTrks]);

  const artistCards = useMemo(() => {
    const map = new Map<string, ArtistCard>();
    for (const t of allTrks) {
      if (t.artist && !map.has(t.artist)) {
        map.set(t.artist, { name: t.artist, image: t.artwork });
      }
    }
    return shuffle([...map.values()]).slice(0, 8);
  }, [allTrks]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#1a3a2a', Colors.background, Colors.background]}
        style={styles.gradient}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header — Spotify style: profile icon + chips on same row */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.profileIcon}
              onPress={() => router.push('/profile')}
            >
              <Text style={styles.profileInitial}>
                {(user?.displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>

            {(['all', 'music', 'playlists'] as FilterType[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, filter === f && styles.filterChipActive]}
                onPress={() => setFilter(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filter === f && styles.filterChipTextActive,
                  ]}
                >
                  {f === 'all' ? t('home.all') : f === 'music' ? t('home.music') : t('home.playlists')}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={{ flex: 1 }} />
            <LanguageToggle />
          </View>

          {/* Greeting */}
          <Text style={styles.greeting}>{greeting}</Text>

          {/* Quick Access Grid — 2 columns like Spotify */}
          {filter !== 'playlists' && albumCards.length > 0 && (
            <View style={styles.quickAccessGrid}>
              {albumCards.slice(0, 6).map((item) => (
                <TouchableOpacity
                  key={item.name}
                  style={styles.quickAccessCard}
                  onPress={() => router.push(`/album/${encodeURIComponent(item.name)}`)}
                  activeOpacity={0.7}
                >
                  <Image source={{ uri: item.artwork }} style={styles.quickAccessArt} />
                  <Text style={styles.quickAccessTitle} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              {/* Playlists */}
              {filter !== 'music' && playlists.length > 0 && (
                <>
                  <SectionHeader title={t('home.madeForYou')} />
                  <FlatList
                    data={playlists.slice(0, 6)}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.playlistCard}
                        onPress={() => router.push(`/playlist/${item.id}`)}
                      >
                        <Image source={{ uri: item.artwork }} style={styles.playlistArtwork} />
                        <Text style={styles.playlistTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.playlistMeta} numberOfLines={1}>{item.description || 'Playlist'}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}

              {/* Trending Tracks */}
              {filter !== 'playlists' && trendingTracks.length > 0 && (
                <>
                  <SectionHeader title={t('home.trending')} />
                  <View style={styles.trackSection}>
                    {trendingTracks.slice(0, 5).map((track, index) => (
                      <TrackRow
                        key={track.id}
                        track={track}
                        trackList={trendingTracks}
                        index={index}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* Albums */}
              {filter !== 'playlists' && albumCards.length > 0 && (
                <>
                  <SectionHeader title={t('home.newReleases')} />
                  <FlatList
                    data={albumCards}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                    keyExtractor={(item) => item.name}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.albumCard}
                        onPress={() => router.push(`/album/${encodeURIComponent(item.name)}`)}
                        activeOpacity={0.7}
                      >
                        <Image source={{ uri: item.artwork }} style={styles.albumArtwork} />
                        <Text style={styles.albumTitle} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.albumArtist} numberOfLines={1}>{item.artist}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}

              {/* Artists */}
              {filter !== 'playlists' && artistCards.length > 0 && (
                <>
                  <SectionHeader title={t('home.popularArtists')} />
                  <FlatList
                    data={artistCards}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                    keyExtractor={(item) => item.name}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.artistCard}
                        onPress={() => router.push(`/artist/${encodeURIComponent(item.name)}`)}
                        activeOpacity={0.7}
                      >
                        <Image source={{ uri: item.image }} style={styles.artistImage} />
                        <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.artistLabel}>{t('home.artist')}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </>
              )}

              {/* Empty state */}
              {allTrks.length === 0 && playlists.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="musical-notes" size={48} color={Colors.textInactive} />
                  <Text style={styles.emptyText}>{t('home.noMusic')}</Text>
                </View>
              )}
            </>
          )}

          {/* Copyleft Banner */}
          <View style={styles.banner}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerGradient}
            >
              <View style={styles.bannerContent}>
                <Text style={styles.bannerSlogan}>{t('home.bannerSlogan')}</Text>
                <Text style={styles.bannerTitle}>{t('home.bannerTitle')}</Text>
                <Text style={styles.bannerSubtitle}>{t('home.bannerSubtitle')}</Text>
                <TouchableOpacity
                  style={styles.bannerButton}
                  onPress={() => router.push('/upload')}
                >
                  <Ionicons name="cloud-upload" size={18} color={Colors.primary} />
                  <Text style={styles.bannerButtonText}>{t('home.bannerButton')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Bottom padding for mini player */}
          <View style={{ height: Layout.miniPlayerHeight + 20 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Layout.padding.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    paddingBottom: Layout.padding.sm,
    gap: Layout.padding.sm,
  },
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  profileInitial: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  greeting: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.md,
    paddingBottom: Layout.padding.sm,
  },
  filterChip: {
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
    borderRadius: Layout.borderRadius.round,
    backgroundColor: Colors.surfaceLight,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: Colors.background,
    fontWeight: '700',
  },
  horizontalList: {
    paddingHorizontal: Layout.padding.md,
  },
  trackSection: {
    marginTop: Layout.padding.xs,
  },
  playlistCard: {
    width: 150,
    marginRight: Layout.padding.sm,
  },
  playlistArtwork: {
    width: 150,
    height: 150,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  playlistTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
  },
  playlistMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  albumCard: {
    width: 150,
    marginRight: Layout.padding.sm,
  },
  albumArtwork: {
    width: 150,
    height: 150,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  albumTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
  },
  albumArtist: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  artistCard: {
    width: 130,
    alignItems: 'center',
    marginRight: Layout.padding.sm,
  },
  artistImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surfaceElevated,
  },
  artistName: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
    textAlign: 'center',
  },
  artistLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Layout.padding.sm,
    gap: Layout.padding.sm,
    marginBottom: Layout.padding.md,
  },
  quickAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Layout.borderRadius.sm,
    overflow: 'hidden',
    width: '48.5%',
    height: 56,
  },
  quickAccessArt: {
    width: 56,
    height: 56,
    backgroundColor: Colors.surfaceElevated,
  },
  quickAccessTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    paddingHorizontal: Layout.padding.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    marginTop: Layout.padding.md,
  },
  banner: {
    marginHorizontal: Layout.padding.md,
    marginTop: Layout.padding.xl,
    borderRadius: Layout.borderRadius.lg,
    overflow: 'hidden',
  },
  bannerGradient: {
    padding: Layout.padding.lg,
  },
  bannerContent: {
    alignItems: 'center',
  },
  bannerSlogan: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  bannerTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.9,
  },
  bannerSubtitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    opacity: 0.85,
    marginTop: Layout.padding.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: Layout.borderRadius.round,
    paddingHorizontal: Layout.padding.lg,
    paddingVertical: Layout.padding.sm,
    marginTop: Layout.padding.md,
  },
  bannerButtonText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: Layout.padding.xs,
  },
});
