import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../src/constants/Colors';
import { Layout } from '../src/constants/Layout';
import { Track } from '../src/types';
import * as ImagePicker from 'expo-image-picker';
import { uploadMusicFile, uploadPlaylistCover, UploadProgress } from '../src/services/cloudStorage';
import { saveTrackMetadata, getUserTracks, deleteTrackMetadata } from '../src/services/firestore';
import { usePlayer } from '../src/contexts/PlayerContext';
import { useAuth } from '../src/contexts/AuthContext';
import TrackRow from '../src/components/TrackRow';

export default function UploadScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [uploadedTracks, setUploadedTracks] = useState<Track[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTrack, setEditTrack] = useState<Partial<Track>>({});
  const [pendingUri, setPendingUri] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [coverUri, setCoverUri] = useState('');

  useEffect(() => {
    loadUploadedTracks();
  }, [user]);

  async function loadUploadedTracks() {
    if (!user) {
      setIsLoadingTracks(false);
      return;
    }
    try {
      const tracks = await getUserTracks(user.id);
      setUploadedTracks(tracks);
    } catch (e) {
      console.error('Error loading tracks:', e);
    } finally {
      setIsLoadingTracks(false);
    }
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const fileName = file.name.replace(/\.[^/.]+$/, '');

      setPendingUri(file.uri);
      setPendingName(file.name);
      setEditTrack({
        title: fileName,
        artist: user?.displayName || 'Artista Desconhecido',
        album: 'Meus Uploads',
        genre: 'Outro',
      });
      setShowEditModal(true);
    } catch (e) {
      console.error('Error picking file:', e);
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo');
    }
  }

  async function pickCoverImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        setCoverUri(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Error picking cover:', e);
    }
  }

  async function saveUploadedTrack() {
    if (!editTrack.title?.trim()) {
      Alert.alert('Erro', 'Digite um título para a música');
      return;
    }
    if (!user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload file to Firebase Storage
      const audioUrl = await uploadMusicFile(
        user.id,
        pendingUri,
        pendingName,
        (progress: UploadProgress) => {
          setUploadProgress(Math.round(progress.progress * 100));
        }
      );

      // Upload cover image if selected
      const trackId = 'upload-' + Date.now();
      let artworkUrl = `https://picsum.photos/seed/${trackId}/300/300`;
      if (coverUri) {
        try {
          artworkUrl = await uploadPlaylistCover(user.id, coverUri);
        } catch (e) {
          console.error('Cover upload error:', e);
        }
      }

      const newTrack: Track = {
        id: trackId,
        title: editTrack.title?.trim() || pendingName,
        artist: editTrack.artist?.trim() || 'Artista Desconhecido',
        album: editTrack.album?.trim() || 'Meus Uploads',
        duration: 0,
        artwork: artworkUrl,
        audioUrl,
        isLocal: false,
        genre: editTrack.genre || 'Outro',
        license: 'Copyleft - Livre para compartilhar',
        addedAt: Date.now(),
      };

      // Save metadata to Firestore (visible to all users)
      await saveTrackMetadata({
        ...newTrack,
        // @ts-ignore - extra field for Firestore query
        uploadedBy: user.id,
        uploadedByName: user.displayName || 'Anônimo',
        titleLower: newTrack.title.toLowerCase(),
      } as any);

      setUploadedTracks(prev => [newTrack, ...prev]);

      setShowEditModal(false);
      setPendingUri('');
      setPendingName('');
      setEditTrack({});
      setCoverUri('');

      Alert.alert(
        'Música compartilhada!',
        `"${newTrack.title}" agora está disponível para toda a comunidade Spotfly!\n\nShare, Build, Share`
      );
    } catch (e) {
      console.error('Upload error:', e);
      Alert.alert('Erro', 'Não foi possível enviar o arquivo. Tente novamente.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  async function deleteTrack(track: Track) {
    Alert.alert(
      'Remover música',
      `Deseja remover "${track.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrackMetadata(track.id);
              setUploadedTracks(prev => prev.filter(t => t.id !== track.id));
            } catch (e) {
              console.error('Delete error:', e);
              Alert.alert('Erro', 'Não foi possível remover a música.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compartilhar Música</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Upload button area */}
      <TouchableOpacity
        style={styles.uploadArea}
        onPress={pickFile}
        activeOpacity={0.8}
        disabled={isUploading}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          style={styles.uploadGradient}
        >
          {isUploading ? (
            <>
              <ActivityIndicator size="large" color={Colors.textPrimary} />
              <Text style={styles.uploadTitle}>Enviando... {uploadProgress}%</Text>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
              </View>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={40} color={Colors.textPrimary} />
              <Text style={styles.uploadTitle}>Compartilhar Música</Text>
              <Text style={styles.uploadSubtitle}>
                MP3, WAV, FLAC, OGG, AAC, M4A
              </Text>
              <Text style={[styles.uploadSubtitle, { marginTop: 4, fontSize: 11 }]}>
                Sua música ficará disponível para toda a comunidade
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Uploaded tracks */}
      <View style={styles.trackListHeader}>
        <Text style={styles.sectionTitle}>
          Músicas enviadas ({uploadedTracks.length})
        </Text>
      </View>

      {isLoadingTracks ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : uploadedTracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes" size={48} color={Colors.textInactive} />
          <Text style={styles.emptyText}>Nenhuma música enviada ainda</Text>
          <Text style={styles.emptySubtext}>
            Faça upload das suas músicas para ouvir no Spotfly
          </Text>
        </View>
      ) : (
        <FlatList
          data={uploadedTracks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrackRow
              track={item}
              trackList={uploadedTracks}
              onOptionsPress={(track) => deleteTrack(track)}
            />
          )}
          contentContainerStyle={styles.trackList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => !isUploading && setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Detalhes da Música</Text>

            <TextInput
              style={styles.modalInput}
              value={editTrack.title}
              onChangeText={(text) => setEditTrack({ ...editTrack, title: text })}
              placeholder="Título"
              placeholderTextColor={Colors.textInactive}
              autoFocus
              editable={!isUploading}
            />

            <TextInput
              style={styles.modalInput}
              value={editTrack.artist}
              onChangeText={(text) => setEditTrack({ ...editTrack, artist: text })}
              placeholder="Artista"
              placeholderTextColor={Colors.textInactive}
              editable={!isUploading}
            />

            <TextInput
              style={styles.modalInput}
              value={editTrack.album}
              onChangeText={(text) => setEditTrack({ ...editTrack, album: text })}
              placeholder="Álbum"
              placeholderTextColor={Colors.textInactive}
              editable={!isUploading}
            />

            <TextInput
              style={styles.modalInput}
              value={editTrack.genre}
              onChangeText={(text) => setEditTrack({ ...editTrack, genre: text })}
              placeholder="Gênero"
              placeholderTextColor={Colors.textInactive}
              editable={!isUploading}
            />

            {/* Cover Image Picker */}
            <TouchableOpacity
              style={styles.coverPickerButton}
              onPress={pickCoverImage}
              disabled={isUploading}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverPreview} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={28} color={Colors.textSecondary} />
                </View>
              )}
              <View style={styles.coverPickerInfo}>
                <Text style={styles.coverPickerText}>
                  {coverUri ? 'Capa selecionada' : 'Adicionar capa (opcional)'}
                </Text>
                <Text style={styles.coverPickerHint}>Toque para escolher uma imagem</Text>
              </View>
            </TouchableOpacity>

            {/* Copyleft Notice */}
            <View style={styles.copyleftNotice}>
              <Ionicons name="globe-outline" size={16} color={Colors.primary} />
              <Text style={styles.copyleftNoticeText}>
                Ao enviar, sua música será compartilhada com toda a comunidade sob licença Copyleft.
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  if (isUploading) return;
                  setShowEditModal(false);
                  setPendingUri('');
                  setEditTrack({});
                }}
                disabled={isUploading}
              >
                <Text style={[styles.modalCancelText, isUploading && { opacity: 0.5 }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, isUploading && { opacity: 0.7 }]}
                onPress={saveUploadedTrack}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color={Colors.background} size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Enviar</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.padding.md,
    paddingVertical: Layout.padding.md,
  },
  backButton: {
    padding: Layout.padding.xs,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  uploadArea: {
    marginHorizontal: Layout.padding.md,
    borderRadius: Layout.borderRadius.lg,
    overflow: 'hidden',
  },
  uploadGradient: {
    alignItems: 'center',
    paddingVertical: Layout.padding.xl,
  },
  uploadTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: Layout.padding.sm,
  },
  uploadSubtitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
  },
  progressBarContainer: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: Layout.padding.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  trackListHeader: {
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.xl,
    paddingBottom: Layout.padding.sm,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: Layout.padding.md,
  },
  emptySubtext: {
    color: Colors.textTertiary,
    fontSize: 13,
    marginTop: Layout.padding.xs,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  trackList: {
    paddingBottom: Layout.padding.xl,
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
  coverPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: Layout.borderRadius.sm,
    backgroundColor: Colors.inactive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPickerInfo: {
    flex: 1,
    marginLeft: Layout.padding.sm,
  },
  coverPickerText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  coverPickerHint: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  copyleftNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderRadius: Layout.borderRadius.sm,
    padding: Layout.padding.sm,
    marginBottom: Layout.padding.md,
  },
  copyleftNoticeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    flex: 1,
    marginLeft: Layout.padding.xs,
    lineHeight: 16,
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
