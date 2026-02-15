import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { searchCategories } from '../../src/constants/categories';
import { searchTracksByTitle } from '../../src/services/firestore';
import { Track } from '../../src/types';
import CategoryCard from '../../src/components/CategoryCard';
import TrackRow from '../../src/components/TrackRow';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useAuth } from '../../src/contexts/AuthContext';
import LanguageToggle from '../../src/components/LanguageToggle';

type Tab = 'all' | 'tracks' | 'artists' | 'albums' | 'playlists';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const { playTrack } = usePlayer();
  const { signOut } = useAuth();
  const [firestoreTracks, setFirestoreTracks] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Search Firestore when query changes (with debounce)
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
    { key: 'all', label: 'Tudo' },
    { key: 'tracks', label: 'Músicas' },
    { key: 'artists', label: 'Artistas' },
    { key: 'albums', label: 'Álbuns' },
    { key: 'playlists', label: 'Playlists' },
  ];

  function renderCategories() {
    const pairs: typeof searchCategories[] = [];
    for (let i = 0; i < searchCategories.length; i += 2) {
      pairs.push(searchCategories.slice(i, i + 2));
    }
    return (
      <View style={styles.categoriesContainer}>
        <Text style={styles.browseTitle}>Navegar por categorias</Text>
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
                    style={[
                      styles.tabText,
                      activeTab === item.key && styles.tabTextActive,
                    ]}
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
                    <Text style={styles.resultSectionTitle}>Músicas</Text>
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
                    <Text style={styles.resultSectionTitle}>Artistas</Text>
                  )}
                  {results.artists.map((artist) => (
                    <TouchableOpacity key={artist.id} style={styles.artistRow}>
                      <Image
                        source={{ uri: artist.image }}
                        style={styles.artistImage}
                      />
                      <View style={styles.artistInfo}>
                        <Text style={styles.artistName}>{artist.name}</Text>
                        <Text style={styles.artistMeta}>Artista</Text>
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
                    <Text style={styles.resultSectionTitle}>Álbuns</Text>
                  )}
                  {results.albums.map((album) => (
                    <TouchableOpacity key={album.id} style={styles.albumRow}>
                      <Image
                        source={{ uri: album.artwork }}
                        style={styles.albumImage}
                      />
                      <View style={styles.albumInfo}>
                        <Text style={styles.albumName}>{album.title}</Text>
                        <Text style={styles.albumMeta}>
                          Álbum - {album.artist}
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
                <Text style={styles.emptyText}>Buscando...</Text>
              </View>
            )}
            {!isSearching &&
              results.tracks.length === 0 &&
              results.artists.length === 0 &&
              results.albums.length === 0 &&
              results.playlists.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="search"
                    size={48}
                    color={Colors.textInactive}
                  />
                  <Text style={styles.emptyText}>
                    Nenhum resultado para "{query}"
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
      <View style={styles.header}>
        <Text style={styles.title}>Buscar</Text>
        <View style={styles.headerRight}>
          <LanguageToggle />
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
            if (Platform.OS === 'web') {
              if (window.confirm('Deseja sair da sua conta?')) {
                signOut();
              }
            } else {
              Alert.alert('Sair', 'Deseja sair da sua conta?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair', style: 'destructive', onPress: () => signOut() },
              ]);
            }
          }}
        >
          <Ionicons name="log-out-outline" size={24} color="#ff5252" />
        </TouchableOpacity>
        </View>
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.background} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Artistas, músicas ou playlists"
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.md,
    paddingBottom: Layout.padding.sm,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutBtn: {
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
