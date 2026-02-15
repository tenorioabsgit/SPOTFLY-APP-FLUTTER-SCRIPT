import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { searchCategories } from '../../src/constants/categories';
import { searchTracksByTitle } from '../../src/services/firestore';
import { Track } from '../../src/types';
import CategoryCard from '../../src/components/CategoryCard';
import TrackRow from '../../src/components/TrackRow';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';

type Tab = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [firestoreTracks, setFirestoreTracks] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setFirestoreTracks([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const tracks = await searchTracksByTitle(query.trim(), 30);
        setFirestoreTracks(tracks);
      } catch (e) {
        console.error('Firestore search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    if (!query.trim()) return null;
    return {
      tracks: firestoreTracks,
      albums: [] as any[],
      artists: [] as any[],
      playlists: [] as any[],
    };
  }, [query, firestoreTracks]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: t('search.everything') },
    { key: 'tracks', label: t('search.songs') },
    { key: 'artists', label: t('library.artists') },
    { key: 'albums', label: t('library.albums') },
    { key: 'playlists', label: t('library.playlists') },
  ];

  function renderCategories() {
    const pairs: typeof searchCategories[] = [];
    for (let i = 0; i < searchCategories.length; i += 2) {
      pairs.push(searchCategories.slice(i, i + 2));
    }
    return (
      <View style={styles.categoriesContainer}>
        <Text style={styles.browseTitle}>{t('search.browseAll')}</Text>
        {pairs.map((pair, index) => (
          <View key={index} style={styles.categoryRow}>
            {pair.map((cat) => (
              <CategoryCard
                key={cat.id}
                name={cat.name}
                color={cat.color}
                onPress={() => setQuery(cat.name)}
              />
            ))}
          </View>
        ))}
      </View>
    );
  }

  function renderResults() {
    if (!results) return null;

    return (
      <FlatList
        data={[]}
        renderItem={null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.resultsContainer}
        ListHeaderComponent={
          <>
            {/* Tabs */}
            <FlatList
              data={tabs}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsContainer}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.tab, activeTab === item.key && styles.tabActive]}
                  onPress={() => setActiveTab(item.key)}
                >
                  <Text
                    style={[styles.tabText, activeTab === item.key && styles.tabTextActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />

            {/* Tracks */}
            {(activeTab === 'all' || activeTab === 'tracks') &&
              results.tracks.length > 0 && (
                <View style={styles.resultSection}>
                  {activeTab === 'all' && (
                    <Text style={styles.resultSectionTitle}>{t('search.songs')}</Text>
                  )}
                  {results.tracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      trackList={results.tracks}
                    />
                  ))}
                </View>
              )}

            {/* Artists */}
            {(activeTab === 'all' || activeTab === 'artists') &&
              results.artists.length > 0 && (
                <View style={styles.resultSection}>
                  {activeTab === 'all' && (
                    <Text style={styles.resultSectionTitle}>{t('library.artists')}</Text>
                  )}
                  {results.artists.map((artist: any) => (
                    <TouchableOpacity key={artist.id} style={styles.artistRow}>
                      <Image source={{ uri: artist.image }} style={styles.artistImage} />
                      <View style={styles.artistInfo}>
                        <Text style={styles.artistName}>{artist.name}</Text>
                        <Text style={styles.artistMeta}>{t('home.artist')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            {/* Albums */}
            {(activeTab === 'all' || activeTab === 'albums') &&
              results.albums.length > 0 && (
                <View style={styles.resultSection}>
                  {activeTab === 'all' && (
                    <Text style={styles.resultSectionTitle}>{t('library.albums')}</Text>
                  )}
                  {results.albums.map((album: any) => (
                    <TouchableOpacity key={album.id} style={styles.albumRow}>
                      <Image source={{ uri: album.artwork }} style={styles.albumImage} />
                      <View style={styles.albumInfo}>
                        <Text style={styles.albumName}>{album.title}</Text>
                        <Text style={styles.albumMeta}>
                          {t('library.album')} - {album.artist}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

            {/* Loading / Empty state */}
            {isSearching && results.tracks.length === 0 && (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.emptyText}>{t('search.searching')}</Text>
              </View>
            )}
            {!isSearching &&
              results.tracks.length === 0 &&
              results.artists.length === 0 &&
              results.albums.length === 0 &&
              results.playlists.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="search" size={48} color={Colors.textInactive} />
                  <Text style={styles.emptyText}>
                    {t('search.noResults')} "{query}"
                  </Text>
                </View>
              )}

            <View style={{ height: Layout.miniPlayerHeight + 80 }} />
          </>
        }
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/profile')}>
          {user?.photoUrl ? (
            <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>
                {(user?.displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.title}>{t('search.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.background} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.searchPlaceholder')}
          placeholderTextColor={Colors.inactive}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.inactive} />
          </TouchableOpacity>
        )}
      </View>

      {query.trim() ? (
        renderResults()
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderCategories()}
          ListFooterComponent={
            <View style={{ height: Layout.miniPlayerHeight + 80 }} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    paddingBottom: Layout.padding.sm,
    gap: Layout.padding.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: Layout.borderRadius.sm,
    marginHorizontal: Layout.padding.md,
    paddingHorizontal: Layout.padding.sm,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: Colors.background,
    fontSize: 15,
    fontWeight: '500',
    marginLeft: Layout.padding.sm,
  },
  categoriesContainer: {
    paddingHorizontal: Layout.padding.sm,
    paddingTop: Layout.padding.lg,
  },
  browseTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.xs,
    marginBottom: Layout.padding.sm,
  },
  categoryRow: {
    flexDirection: 'row',
  },
  tabsContainer: {
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
    gap: Layout.padding.sm,
  },
  tab: {
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
    borderRadius: Layout.borderRadius.round,
    backgroundColor: Colors.surfaceLight,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.background,
    fontWeight: '700',
  },
  resultsContainer: {
    paddingBottom: Layout.padding.xl,
  },
  resultSection: {
    marginTop: Layout.padding.md,
  },
  resultSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.md,
    marginBottom: Layout.padding.sm,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.padding.sm,
    paddingHorizontal: Layout.padding.md,
  },
  artistImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceElevated,
  },
  artistInfo: {
    flex: 1,
    marginLeft: Layout.padding.sm,
  },
  artistName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  artistMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.padding.sm,
    paddingHorizontal: Layout.padding.md,
  },
  albumImage: {
    width: 48,
    height: 48,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
  },
  albumInfo: {
    flex: 1,
    marginLeft: Layout.padding.sm,
  },
  albumName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  albumMeta: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
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
});
