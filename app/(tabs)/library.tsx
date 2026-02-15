import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { Playlist } from '../../src/types';
import { defaultPlaylists } from '../../src/data/mockData';
import {
  getUserPlaylists,
  getPublicPlaylists,
  createPlaylist as firestoreCreatePlaylist,
} from '../../src/services/firestore';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';

type FilterType = 'all' | 'playlists' | 'downloaded';
type SortType = 'recent' | 'alphabetical' | 'creator';
type ViewType = 'list' | 'grid';

export default function LibraryScreen() {
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>(defaultPlaylists);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('recent');
  const [viewType, setViewType] = useState<ViewType>('list');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    loadPlaylists();
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
        setPlaylists([...userPl, ...deduped, ...defaultPlaylists]);
      } else {
        setPlaylists(defaultPlaylists);
      }
    } catch (e) {
      console.error('Error loading playlists:', e);
      setPlaylists(defaultPlaylists);
    } finally {
      setIsLoadingPlaylists(false);
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
        <TouchableOpacity
          style={styles.profileRow}
          onPress={() => setShowProfileMenu(true)}
        >
          <Image
            source={{ uri: user?.photoUrl || 'https://i.pravatar.cc/40' }}
            style={styles.avatar}
          />
          <Text style={styles.headerTitle}>{t('library.title')}</Text>
        </TouchableOpacity>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={28} color={Colors.textPrimary} />
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
          }
          ListFooterComponent={
            <View style={{ height: Layout.miniPlayerHeight + 80 }} />
          }
        />
      )}

      {/* Profile Menu Dropdown */}
      {showProfileMenu && (
        <>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setShowProfileMenu(false)}
          />
          <View style={styles.menuContainer}>
            {/* Profile Info */}
            <View style={styles.menuProfile}>
              <Image
                source={{ uri: user?.photoUrl || 'https://i.pravatar.cc/40' }}
                style={styles.menuAvatar}
              />
              <View style={styles.menuProfileInfo}>
                <Text style={styles.menuProfileName} numberOfLines={1}>
                  {user?.displayName || 'Usuário'}
                </Text>
                <Text style={styles.menuProfileEmail} numberOfLines={1}>
                  {user?.email || ''}
                </Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* Language Toggle */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setLanguage(language === 'pt' ? 'en' : 'pt');
              }}
            >
              <Ionicons name="language-outline" size={22} color={Colors.textPrimary} />
              <Text style={styles.menuItemText}>
                {language === 'pt' ? 'Switch to English' : 'Mudar para Português'}
              </Text>
              <View style={styles.menuBadge}>
                <Text style={styles.menuBadgeText}>{language.toUpperCase()}</Text>
              </View>
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowProfileMenu(false);
                signOut();
              }}
            >
              <Ionicons name="log-out-outline" size={22} color="#ff5252" />
              <Text style={[styles.menuItemText, { color: '#ff5252' }]}>
                {t('profile.logout')}
              </Text>
            </TouchableOpacity>
          </View>
        </>
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
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 98,
  },
  menuContainer: {
    position: 'absolute',
    top: 55,
    left: Layout.padding.md,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Layout.borderRadius.lg,
    padding: Layout.padding.md,
    width: 280,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.padding.sm,
  },
  menuAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: Layout.padding.sm,
  },
  menuProfileInfo: {
    flex: 1,
  },
  menuProfileName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  menuProfileEmail: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.inactive,
    marginVertical: Layout.padding.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  menuItemText: {
    color: Colors.textPrimary,
    fontSize: 15,
    marginLeft: Layout.padding.sm,
    flex: 1,
  },
  menuBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius.round,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  menuBadgeText: {
    color: Colors.background,
    fontSize: 11,
    fontWeight: '700',
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
