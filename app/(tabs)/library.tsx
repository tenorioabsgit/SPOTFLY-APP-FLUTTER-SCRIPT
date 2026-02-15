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
  ScrollView,
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
import LanguageToggle from '../../src/components/LanguageToggle';

interface AlbumGroup {
  albumName: string;
  artist: string;
  artwork: string;
  trackCount: number;
  tracks: Track[];
}

type FilterType = 'all' | 'playlists' | 'downloaded';
type SortType = 'recent' | 'alphabetical' | 'creator';
type ViewType = 'list' | 'grid';

export default function LibraryScreen() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('recent');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [userAlbums, setUserAlbums] = useState<AlbumGroup[]>([]);

  useEffect(() => {
    loadPlaylists();
    loadUserAlbums();
  }, [user]);

  async function loadPlaylists() {
    setIsLoadingPlaylists(true);
    try {
      if (user) {
        const [userPl, publicPl] = await Promise.all([
          getUserPlaylists(user.id).catch(() => []),
          getPublicPlaylists(20).catch(() => []),
        ]);
        // Merge: user playlists + public (deduped) + defaults as fallback
        const allIds = new Set(userPl.map(p => p.id));
        const deduped = publicPl.filter(p => !allIds.has(p.id));
        setPlaylists([...userPl, ...deduped]);
      } else {
        setPlaylists([]);
      }
    } catch (e) {
      console.error('Error loading playlists:', e);
      setPlaylists([]);
    } finally {
      setIsLoadingPlaylists(false);
    }
  }

  async function loadUserAlbums() {
    if (!user) { setUserAlbums([]); return; }
    try {
      const tracks = await getUserTracks(user.id);
      const map = new Map<string, Track[]>();
      for (const t of tracks) {
        const key = t.album || t.title;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
      const groups: AlbumGroup[] = [];
      for (const [albumName, albumTracks] of map) {
        groups.push({
          albumName,
          artist: albumTracks[0].artist,
          artwork: albumTracks[0].artwork,
          trackCount: albumTracks.length,
          tracks: albumTracks,
        });
      }
      setUserAlbums(groups);
    } catch (e) {
      console.error('Error loading user albums:', e);
    }
  }

  async function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) {
      Alert.alert('Erro', 'Digite um nome para a playlist');
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
      const newPlaylist: Playlist = { id: newId, ...playlistData };

      setPlaylists(prev => [newPlaylist, ...prev]);
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setShowCreateModal(false);
    } catch (e) {
      console.error('Error creating playlist:', e);
      Alert.alert('Erro', 'Não foi possível criar a playlist. Tente novamente.');
    } finally {
      setIsCreating(false);
    }
  }

  function getSortedPlaylists(): Playlist[] {
    let filtered = [...playlists];
    if (filter === 'playlists' && user) {
      filtered = playlists.filter(p => p.createdBy === user.id);
    }

    switch (sortBy) {
      case 'alphabetical':
        return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case 'creator':
        return filtered.sort((a, b) => a.createdBy.localeCompare(b.createdBy));
      case 'recent':
      default:
        return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    }
  }

  function renderListItem({ item }: { item: Playlist }) {
    return (
      <TouchableOpacity
        style={styles.listItem}
        onPress={() => router.push(`/playlist/${item.id}`)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.artwork }} style={styles.listArtwork} />
        <View style={styles.listInfo}>
          <Text style={styles.listTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.listMeta}>
            <Text style={styles.listType}>Playlist</Text>
            <Text style={styles.listDot}> · </Text>
            <Text style={styles.listCreator}>
              {item.createdBy === user?.id ? 'Você' : item.createdBy}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderGridItem({ item }: { item: Playlist }) {
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => router.push(`/playlist/${item.id}`)}
        activeOpacity={0.7}
      >
        <Image source={{ uri: item.artwork }} style={styles.gridArtwork} />
        <Text style={styles.gridTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  }

  const sortedPlaylists = getSortedPlaylists();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <Image
            source={{ uri: user?.photoUrl || 'https://i.pravatar.cc/40' }}
            style={styles.avatar}
          />
          <Text style={styles.headerTitle}>{t('library.title')}</Text>
        </View>
        <View style={styles.headerIcons}>
          <LanguageToggle />
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
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

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['all', 'playlists', 'downloaded'] as FilterType[]).map((f) => (
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
              {f === 'all'
                ? 'Tudo'
                : f === 'playlists'
                ? 'Playlists'
                : 'Baixados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sort and View Toggle */}
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            const sorts: SortType[] = ['recent', 'alphabetical', 'creator'];
            const current = sorts.indexOf(sortBy);
            setSortBy(sorts[(current + 1) % sorts.length]);
          }}
        >
          <Ionicons name="swap-vertical" size={18} color={Colors.textPrimary} />
          <Text style={styles.sortText}>
            {sortBy === 'recent'
              ? 'Recentes'
              : sortBy === 'alphabetical'
              ? 'A-Z'
              : 'Criador'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setViewType(viewType === 'list' ? 'grid' : 'list')}
        >
          <Ionicons
            name={viewType === 'list' ? 'grid' : 'list'}
            size={22}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Playlist List */}
      {isLoadingPlaylists ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          key={viewType}
          data={sortedPlaylists}
          keyExtractor={(item) => item.id}
          renderItem={viewType === 'list' ? renderListItem : renderGridItem}
          numColumns={viewType === 'grid' ? 2 : 1}
          contentContainerStyle={[
            styles.listContainer,
            viewType === 'grid' && styles.gridContainer,
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* User uploaded albums */}
              {userAlbums.length > 0 && (
                <View style={styles.albumsSection}>
                  <Text style={styles.albumsSectionTitle}>{t('library.myAlbums')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albumsScroll}>
                    {userAlbums.map((album, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.albumCard}
                        onPress={() => router.push(`/album/${encodeURIComponent(album.albumName)}`)}
                        activeOpacity={0.7}
                      >
                        <Image source={{ uri: album.artwork }} style={styles.albumCardArt} />
                        <Text style={styles.albumCardTitle} numberOfLines={1}>{album.albumName}</Text>
                        <Text style={styles.albumCardMeta} numberOfLines={1}>{album.artist} · {album.trackCount} {t('library.tracks')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Liked Songs */}
              <TouchableOpacity style={styles.likedSongsItem} activeOpacity={0.7}>
                <View style={styles.likedSongsArtwork}>
                  <Ionicons name="heart" size={24} color={Colors.textPrimary} />
                </View>
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle}>{t('library.liked')}</Text>
                  <View style={styles.listMeta}>
                    <Ionicons name="pin" size={12} color={Colors.primary} />
                    <Text style={styles.listType}> Playlist · Spotfly</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </>
          }
          ListFooterComponent={
            <View style={{ height: Layout.miniPlayerHeight + 80 }} />
          }
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
            <Text style={styles.modalTitle}>Nova Playlist</Text>

            <TextInput
              style={styles.modalInput}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              placeholder="Nome da playlist"
              placeholderTextColor={Colors.textInactive}
              autoFocus
            />

            <TextInput
              style={[styles.modalInput, styles.modalInputDesc]}
              value={newPlaylistDesc}
              onChangeText={setNewPlaylistDesc}
              placeholder="Descrição (opcional)"
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
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCreateButton, isCreating && { opacity: 0.7 }]}
                onPress={handleCreatePlaylist}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text style={styles.modalCreateText}>Criar</Text>
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
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    marginLeft: Layout.padding.md,
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
  listContainer: {
    paddingHorizontal: 0,
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
  listInfo: {
    flex: 1,
    marginLeft: Layout.padding.sm,
  },
  listTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  listType: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  listDot: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  listCreator: {
    color: Colors.textSecondary,
    fontSize: 12,
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
  albumsSection: {
    paddingTop: Layout.padding.sm,
    paddingBottom: Layout.padding.md,
  },
  albumsSectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.md,
    marginBottom: Layout.padding.sm,
  },
  albumsScroll: {
    paddingHorizontal: Layout.padding.md,
  },
  albumCard: {
    width: 140,
    marginRight: Layout.padding.sm,
  },
  albumCardArt: {
    width: 140,
    height: 140,
    borderRadius: Layout.borderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  albumCardTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Layout.padding.sm,
  },
  albumCardMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  likedSongsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Layout.padding.sm,
    paddingHorizontal: Layout.padding.md,
  },
  likedSongsArtwork: {
    width: 56,
    height: 56,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
