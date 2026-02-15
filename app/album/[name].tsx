import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../src/constants/Colors';
import { Layout } from '../../src/constants/Layout';
import { usePlayer } from '../../src/contexts/PlayerContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { Track } from '../../src/types';
import TrackRow from '../../src/components/TrackRow';
import {
  getTracksByAlbum,
  updateTrackMetadata,
  deleteTrackMetadata,
} from '../../src/services/firestore';
import { uploadPlaylistCover } from '../../src/services/cloudStorage';
import {
  downloadAlbum,
  isAlbumSynced,
  removeOfflineAlbum,
} from '../../src/services/offlineStorage';

export default function AlbumScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { playQueue, nextTrack, previousTrack, currentTrack } = usePlayer();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  // CRUD state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAlbumName, setEditAlbumName] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editCoverUri, setEditCoverUri] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Offline sync state
  const [synced, setSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });

  // Swipe animation
  const panX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 30,
      onPanResponderMove: Animated.event([null, { dx: panX }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) {
          Animated.spring(panX, { toValue: -200, useNativeDriver: false }).start(() => {
            nextTrack();
            panX.setValue(0);
          });
        } else if (gs.dx > 50) {
          Animated.spring(panX, { toValue: 200, useNativeDriver: false }).start(() => {
            previousTrack();
            panX.setValue(0);
          });
        } else {
          Animated.spring(panX, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    loadAlbum();
  }, [name]);

  useEffect(() => {
    checkSyncStatus();
  }, [tracks]);

  async function loadAlbum() {
    if (!name) return;
    setLoading(true);
    try {
      const result = await getTracksByAlbum(name);
      setTracks(result);
    } catch (e) {
      console.error('Error loading album:', e);
    } finally {
      setLoading(false);
    }
  }

  async function checkSyncStatus() {
    if (tracks.length === 0) return;
    const isSynced = await isAlbumSynced(tracks.map(t => t.id));
    setSynced(isSynced);
  }

  const isOwner = tracks.length > 0 && tracks[0].uploadedBy === user?.id;
  const artist = tracks.length > 0 ? tracks[0].artist : '';
  const artwork = tracks.length > 0 ? tracks[0].artwork : '';
  const genre = tracks.length > 0 ? tracks[0].genre : '';

  const totalDuration = useMemo(() => {
    const total = tracks.reduce((sum, t) => sum + t.duration, 0);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} h ${mins} min`;
    return `${mins} min`;
  }, [tracks]);

  // ── Share ──
  async function handleShare() {
    try {
      await Share.share({
        message: `Ouça "${name}" de ${artist} no Spotfly! 🎵\nShare, Build, Share!`,
      });
    } catch (e) {
      console.error('Error sharing:', e);
    }
  }

  // ── Edit Modal ──
  function openEditModal() {
    setEditAlbumName(name || '');
    setEditGenre(genre);
    setEditCoverUri('');
    setShowEditModal(true);
  }

  async function pickNewCover() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setEditCoverUri(result.assets[0].uri);
    }
  }

  async function handleSaveEdit() {
    if (!editAlbumName.trim()) return;
    setIsSaving(true);
    try {
      let newArtworkUrl = '';
      if (editCoverUri && user) {
        newArtworkUrl = await uploadPlaylistCover(user.id, editCoverUri);
      }

      const updates: Partial<Track> = {};
      if (editAlbumName.trim() !== name) updates.album = editAlbumName.trim();
      if (editGenre.trim() !== genre) updates.genre = editGenre.trim();
      if (newArtworkUrl) updates.artwork = newArtworkUrl;

      if (Object.keys(updates).length > 0) {
        await Promise.all(tracks.map(track => updateTrackMetadata(track.id, updates)));
      }

      setShowEditModal(false);

      if (updates.album) {
        router.replace(`/album/${encodeURIComponent(updates.album)}`);
      } else {
        loadAlbum();
      }
    } catch (e) {
      console.error('Error updating album:', e);
    } finally {
      setIsSaving(false);
    }
  }

  // ── Delete Album ──
  function handleDeleteAlbum() {
    const confirmDelete = async () => {
      setIsDeleting(true);
      try {
        await Promise.all(tracks.map(track => deleteTrackMetadata(track.id)));
        router.back();
      } catch (e) {
        console.error('Error deleting album:', e);
      } finally {
        setIsDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('album.deleteConfirm'))) {
        confirmDelete();
      }
    } else {
      Alert.alert(t('album.delete'), t('album.deleteConfirm'), [
        { text: t('album.cancel'), style: 'cancel' },
        { text: t('album.delete'), style: 'destructive', onPress: confirmDelete },
      ]);
    }
  }

  // ── Offline Sync ──
  async function handleLongPress() {
    if (Platform.OS === 'web') return;

    if (synced) {
      // Already synced — ask to remove
      if (Platform.OS === 'web') {
        if (window.confirm(t('album.syncRemove'))) {
          await removeOfflineAlbum(tracks);
          setSynced(false);
        }
      } else {
        Alert.alert(t('album.synced'), t('album.syncRemove'), [
          { text: t('album.cancel'), style: 'cancel' },
          {
            text: t('album.delete'),
            style: 'destructive',
            onPress: async () => {
              await removeOfflineAlbum(tracks);
              setSynced(false);
            },
          },
        ]);
      }
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ done: 0, total: tracks.length });
    try {
      await downloadAlbum(tracks, (done, total) => {
        setSyncProgress({ done, total });
      });
      setSynced(true);
      if (Platform.OS !== 'web') {
        Alert.alert(t('album.syncComplete'));
      }
    } catch (e) {
      console.error('Error syncing album:', e);
    } finally {
      setIsSyncing(false);
    }
  }

  // ── Render ──
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (isDeleting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentlyPlayingTitle = currentTrack?.album === name ? currentTrack.title : null;

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

              {/* Swipeable artwork with long press for offline sync */}
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={handleLongPress}
                delayLongPress={3000}
                style={styles.artworkContainer}
              >
                <Animated.View
                  {...panResponder.panHandlers}
                  style={{ transform: [{ translateX: panX }] }}
                >
                  <Image
                    source={{ uri: artwork }}
                    style={styles.artwork}
                  />
                </Animated.View>
                {synced && (
                  <View style={styles.syncBadge}>
                    <Ionicons name="cloud-done" size={16} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>

              {/* Now playing indicator */}
              {currentlyPlayingTitle && (
                <Text style={styles.nowPlaying} numberOfLines={1}>
                  ♪ {currentlyPlayingTitle}
                </Text>
              )}

              {/* Sync progress */}
              {isSyncing && (
                <View style={styles.syncProgressContainer}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.syncProgressText}>
                    {t('album.syncProgress')} {syncProgress.done}/{syncProgress.total}
                  </Text>
                </View>
              )}

              <Text style={styles.albumTitle}>{name}</Text>
              <Text style={styles.albumArtist}>{artist}</Text>
              <Text style={styles.albumMeta}>
                {genre ? `${genre} · ` : ''}{tracks.length} músicas{totalDuration !== '0 min' ? `, ${totalDuration}` : ''}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity onPress={handleShare}>
                  <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>

                {isOwner && (
                  <TouchableOpacity onPress={openEditModal}>
                    <Ionicons name="create-outline" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}

                {isOwner && (
                  <TouchableOpacity onPress={handleDeleteAlbum}>
                    <Ionicons name="trash-outline" size={24} color="#ff5252" />
                  </TouchableOpacity>
                )}

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
          <View style={styles.footer}>
            <View style={styles.licenseBanner}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
              <Text style={styles.licenseText}>
                Todas as músicas deste álbum são livres de royalties
              </Text>
            </View>
            <View style={{ height: Layout.miniPlayerHeight + 30 }} />
          </View>
        }
      />

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('album.editTitle')}</Text>

            <TextInput
              style={styles.modalInput}
              value={editAlbumName}
              onChangeText={setEditAlbumName}
              placeholder={t('album.albumName')}
              placeholderTextColor={Colors.textInactive}
            />

            <TextInput
              style={styles.modalInput}
              value={editGenre}
              onChangeText={setEditGenre}
              placeholder={t('album.genre')}
              placeholderTextColor={Colors.textInactive}
            />

            <TouchableOpacity style={styles.coverPickerButton} onPress={pickNewCover}>
              <Image
                source={{ uri: editCoverUri || artwork }}
                style={styles.coverPreview}
              />
              <Text style={styles.coverPickerText}>{t('album.changeCover')}</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('album.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, isSaving && { opacity: 0.7 }]}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>{t('album.save')}</Text>
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
  syncBadge: {
    position: 'absolute',
    bottom: Layout.padding.md + 4,
    right: '50%',
    marginRight: -100,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  nowPlaying: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Layout.padding.xl,
    marginTop: -4,
    marginBottom: 4,
  },
  syncProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  syncProgressText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  albumTitle: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: Layout.padding.md,
    marginTop: Layout.padding.sm,
  },
  albumArtist: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
    paddingHorizontal: Layout.padding.md,
    marginTop: 4,
  },
  albumMeta: {
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
  // Edit Modal styles
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
  coverPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Layout.borderRadius.sm,
    padding: Layout.padding.sm,
    marginBottom: Layout.padding.md,
    borderWidth: 1,
    borderColor: Colors.inactive,
  },
  coverPreview: {
    width: 50,
    height: 50,
    borderRadius: Layout.borderRadius.sm,
  },
  coverPickerText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: Layout.padding.sm,
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
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginLeft: Layout.padding.sm,
    borderRadius: Layout.borderRadius.round,
    backgroundColor: Colors.primary,
  },
  modalSaveText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
