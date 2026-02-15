import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { Playlist, Track } from '../../src/types';
import {
  getUserPlaylists,
  getPublicPlaylists,
  createPlaylist as firestoreCreatePlaylist,
  getUserTracks,
} from '../../src/services/firestore';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';

interface LibraryItem {
  id: string;
  title: string;
  subtitle: string;
  artwork: string;
  type: 'playlist' | 'album' | 'liked';
  route: string;
}

type FilterType = 'all' | 'playlists' | 'albums' | 'downloaded';
type SortType = 'recent' | 'alphabetical' | 'creator';
type ViewType = 'list' | 'grid';

export default function LibraryScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [userAlbumItems, setUserAlbumItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('recent');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [userPl, publicPl, userTracks] = await Promise.all([
        user ? getUserPlaylists(user.id).catch(() => []) : Promise.resolve([]),
        getPublicPlaylists(20).catch(() => []),
        user ? getUserTracks(user.id).catch(() => []) : Promise.resolve([]),
      ]);

      // Merge playlists (deduped)
      const allIds = new Set(userPl.map(p => p.id));
      setPlaylists([...userPl, ...publicPl.filter(p => !allIds.has(p.id))]);

      // Derive albums from user tracks
      const albumMap = new Map<string, Track[]>();
      for (const track of userTracks) {
        const key = track.album || track.title;
        if (!albumMap.has(key)) albumMap.set(key, []);
        albumMap.get(key)!.push(track);
      }
      const albums: LibraryItem[] = [];
      for (const [albumName, tracks] of albumMap) {
        albums.push({
          id: `album-${albumName}`,
          title: albumName,
          subtitle: `${t('library.album')} · ${tracks[0].artist} · ${tracks.length} ${t('library.tracks')}`,
          artwork: tracks[0].artwork,
          type: 'album',
          route: `/album/${encodeURIComponent(albumName)}`,
        });
      }
      setUserAlbumItems(albums);
    } catch (e) {
      console.error('Error loading library:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) {
      Alert.alert(t('common.error'), t('library.errorName'));
      return;
    }
    if (!user) return;

    setIsCreating(true);
    try {
      const playlistData = {
        title: newPlaylistName.trim(),
        description: newPlaylistDesc.trim(),
        artwork: `https://picsum.photos/seed/${Date.now()}/300/300`,
        trackIds: [] as string[],
        createdBy: user.id,
        isPublic: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const newId = await firestoreCreatePlaylist(playlistData);
      setPlaylists(prev => [{ id: newId, ...playlistData }, ...prev]);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
    } catch (e) {
      console.error('Error creating playlist:', e);
      Alert.alert(t('common.error'), t('library.errorCreate'));
    } finally {
      setIsCreating(false);
    }
  }

  function getUnifiedItems(): LibraryItem[] {
    // Build playlist items
    const playlistItems: LibraryItem[] = playlists.map(p => ({
      id: p.id,
      title: p.title,
      subtitle: `${t('library.playlist')} · ${p.createdBy === user?.id ? t('library.you') : p.createdBy}`,
      artwork: p.artwork,
      type: 'playlist' as const,
      route: `/playlist/${p.id}`,
    }));

    // Filter
    let items: LibraryItem[] = [];
    if (filter === 'all') {
      items = [...userAlbumItems, ...playlistItems];
    } else if (filter === 'playlists') {
      items = playlistItems;
    } else if (filter === 'albums') {
      items = userAlbumItems;
    } else if (filter === 'downloaded') {
      items = []; // TODO: downloaded items
    }

    // Sort
    switch (sortBy) {
      case 'alphabetical':
        return items.sort((a, b) => a.title.localeCompare(b.title));
      case 'creator':
        return items.sort((a, b) => a.subtitle.localeCompare(b.subtitle));
      case 'recent':
      default:
        return items;
    }
  }

  function renderListItem({ item }: { item: LibraryItem }) {
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => router.push(item.route as any)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.artwork }}
          style={[styles.listArtwork, item.type === 'album' && styles.listArtworkSquare]}
        />
        <View style={styles.listInfo}>
          <Text style={styles.listTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.listSubtitle} numberOfLines={1}>{item.subtitle}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  function renderGridItem({ item }: { item: LibraryItem }) {
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(item.route as any)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.artwork }} style={styles.gridArtwork} />
        <Text style={styles.gridTitle} numberOfLines={2}>{item.title}</Text>
      </TouchableOpacity>
    );
  }

  const items = getUnifiedItems();
  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: t('library.all') },
    { key: 'playlists', label: t('library.playlists') },
    { key: 'albums', label: t('library.albums') },
    { key: 'downloaded', label: t('library.downloaded') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
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
          <Text style={styles.headerTitle}>{t('library.title')}</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort + view toggle */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            const sorts: SortType[] = ['recent', 'alphabetical', 'creator'];
            const idx = sorts.indexOf(sortBy);
            setSortBy(sorts[(idx + 1) % sorts.length]);
          }}
        >
          <Ionicons name="swap-vertical" size={18} color={Colors.textPrimary} />
          <Text style={styles.sortText}>
            {sortBy === 'recent' ? t('library.recent') : sortBy === 'alphabetical' ? t('library.az') : t('library.creator')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setViewType(viewType === 'list' ? 'grid' : 'list')}>
          <Ionicons name={viewType === 'list' ? 'grid' : 'list'} size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          key={viewType}
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={viewType === 'list' ? renderListItem : renderGridItem}
          numColumns={viewType === 'grid' ? 2 : 1}
          contentContainerStyle={viewType === 'grid' ? styles.gridContainer : undefined}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            /* Liked Songs pinned row */
            <TouchableOpacity style={styles.listItem} activeOpacity={0.7}>
              <View style={styles.likedArtwork}>
                <Ionicons name="heart" size={24} color={Colors.textPrimary} />
              </View>
              <View style={styles.listInfo}>
                <Text style={styles.listTitle}>{t('library.liked')}</Text>
                <View style={styles.pinnedRow}>
                  <Ionicons name="pin" size={12} color={Colors.primary} />
                  <Text style={styles.listSubtitle}> {t('library.playlist')} · Spotfly</Text>
                </View>
              </View>
            </TouchableOpacity>
          }
          ListFooterComponent={<View style={{ height: Layout.miniPlayerHeight + 80 }} />}
        />
      )}

      {/* Create Playlist Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('library.newPlaylist')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              placeholder={t('library.playlistName')}
              placeholderTextColor={Colors.textInactive}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, styles.modalInputDesc]}
              value={newPlaylistDesc}
              onChangeText={setNewPlaylistDesc}
              placeholder={t('library.descriptionOptional')}
              placeholderTextColor={Colors.textInactive}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewPlaylistName('');
                  setNewPlaylistDesc('');
                }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateButton, isCreating && { opacity: 0.7 }]}
                onPress={handleCreatePlaylist}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text style={styles.modalCreateText}>{t('library.create')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: Layout.padding.sm,
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Layout.padding.sm,
  },
  avatarInitial: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  headerIcon: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
    gap: Layout.padding.sm,
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
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.sm,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
    marginLeft: Layout.padding.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContainer: {
    paddingHorizontal: Layout.padding.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.padding.sm,
    paddingHorizontal: Layout.padding.md,
  },
  listArtwork: {
    width: 56,
    height: 56,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.surfaceElevated,
  },
  listArtworkSquare: {
    borderRadius: Layout.borderRadius.sm,
  },
  listInfo: {
    flex: 1,
    marginLeft: Layout.padding.sm,
  },
  listTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  listSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  likedArtwork: {
    width: 56,
    height: 56,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItem: {
    flex: 1,
    margin: Layout.padding.xs,
    maxWidth: '50%',
  },
  gridArtwork: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  gridTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: Layout.padding.xl,
  },
  modalContent: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.padding.lg,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Layout.padding.lg,
  },
  modalInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: Layout.borderRadius.sm,
    paddingHorizontal: Layout.padding.md,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    marginBottom: Layout.padding.md,
    borderWidth: 1,
    borderColor: Colors.inactive,
  },
  modalInputDesc: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Layout.padding.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: Layout.padding.sm,
    borderRadius: Layout.borderRadius.round,
    borderWidth: 1,
    borderColor: Colors.inactive,
  },
  modalCancelText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalCreateButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: Layout.padding.sm,
    borderRadius: Layout.borderRadius.round,
    backgroundColor: Colors.primary,
  },
  modalCreateText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
