import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

interface PendingFile {
  uri: string;
  name: string;
  title: string;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function UploadScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { playTrack } = usePlayer();
  const [uploadedTracks, setUploadedTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);

  // Batch upload state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [albumArtist, setAlbumArtist] = useState('');
  const [albumName, setAlbumName] = useState('');
  const [albumGenre, setAlbumGenre] = useState('');
  const [coverUri, setCoverUri] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingIndex, setUploadingIndex] = useState(0);
  const [totalToUpload, setTotalToUpload] = useState(0);

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

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;

      const newFiles: PendingFile[] = result.assets.map((file) => ({
        uri: file.uri,
        name: file.name,
        title: file.name.replace(/\.[^/.]+$/, ''),
      }));

      setPendingFiles((prev) => [...prev, ...newFiles]);

      if (!albumArtist) {
        setAlbumArtist(user?.displayName || '');
      }
      if (!albumName) {
        setAlbumName('Meus Uploads');
      }
      if (!albumGenre) {
        setAlbumGenre('Outro');
      }
    } catch (e) {
      console.error('Error picking files:', e);
      showAlert('Erro', 'Não foi possível selecionar os arquivos');
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

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateFileTitle(index: number, title: string) {
    setPendingFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, title } : f))
    );
  }

  async function uploadAll() {
    if (pendingFiles.length === 0) {
      showAlert('Erro', 'Selecione pelo menos uma música');
      return;
    }
    if (!albumArtist.trim()) {
      showAlert('Erro', 'Digite o nome do artista/banda');
      return;
    }
    if (!user) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadingIndex(0);
    setTotalToUpload(pendingFiles.length);

    try {
      // Upload cover once (shared for all tracks)
      let artworkUrl = '';
      if (coverUri) {
        try {
          artworkUrl = await uploadPlaylistCover(user.id, coverUri);
        } catch (e) {
          console.error('Cover upload error:', e);
        }
      }

      const uploaded: Track[] = [];

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        setUploadingIndex(i + 1);
        setUploadProgress(0);

        const audioUrl = await uploadMusicFile(
          user.id,
          file.uri,
          file.name,
          (progress: UploadProgress) => {
            setUploadProgress(Math.round(progress.progress * 100));
          }
        );

        const trackId = 'upload-' + Date.now() + '-' + i;
        const finalArtwork = artworkUrl || `https://picsum.photos/seed/${trackId}/300/300`;

        const newTrack: Track = {
          id: trackId,
          title: file.title.trim() || file.name,
          artist: albumArtist.trim(),
          album: albumName.trim() || 'Meus Uploads',
          duration: 0,
          artwork: finalArtwork,
          audioUrl,
          isLocal: false,
          genre: albumGenre.trim() || 'Outro',
          license: 'Copyleft - Livre para compartilhar',
          addedAt: Date.now(),
          uploadedBy: user.id,
          uploadedByName: user.displayName || 'Anônimo',
          titleLower: (file.title.trim() || file.name).toLowerCase(),
        };

        await saveTrackMetadata(newTrack);

        uploaded.push(newTrack);
      }

      setUploadedTracks((prev) => [...uploaded, ...prev]);

      // Reset form
      setPendingFiles([]);
      setAlbumArtist('');
      setAlbumName('');
      setAlbumGenre('');
      setCoverUri('');

      const msg = uploaded.length === 1
        ? `"${uploaded[0].title}" foi compartilhada com a comunidade!`
        : `${uploaded.length} músicas foram compartilhadas com a comunidade!`;
      showAlert('Upload concluído!', msg);
    } catch (e) {
      console.error('Upload error:', e);
      showAlert('Erro', 'Falha no upload. Tente novamente.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingIndex(0);
      setTotalToUpload(0);
    }
  }

  async function deleteTrack(track: Track) {
    if (Platform.OS === 'web') {
      if (window.confirm(`Deseja remover "${track.title}"?`)) {
        try {
          await deleteTrackMetadata(track.id);
          setUploadedTracks((prev) => prev.filter((t) => t.id !== track.id));
        } catch (e) {
          showAlert('Erro', 'Não foi possível remover a música.');
        }
      }
    } else {
      Alert.alert('Remover música', `Deseja remover "${track.title}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrackMetadata(track.id);
              setUploadedTracks((prev) => prev.filter((t) => t.id !== track.id));
            } catch (e) {
              showAlert('Erro', 'Não foi possível remover a música.');
            }
          },
        },
      ]);
    }
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Upload button area */}
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={pickFiles}
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
                <Text style={styles.uploadTitle}>
                  Enviando {uploadingIndex}/{totalToUpload}... {uploadProgress}%
                </Text>
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                </View>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload" size={40} color={Colors.textPrimary} />
                <Text style={styles.uploadTitle}>
                  {pendingFiles.length > 0 ? 'Adicionar mais músicas' : 'Selecionar Músicas'}
                </Text>
                <Text style={styles.uploadSubtitle}>
                  MP3, WAV, FLAC, OGG, AAC, M4A
                </Text>
                <Text style={[styles.uploadSubtitle, { marginTop: 4, fontSize: 11 }]}>
                  Selecione várias músicas de uma vez para enviar um disco inteiro
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Pending files list + album data */}
        {pendingFiles.length > 0 && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              Músicas selecionadas ({pendingFiles.length})
            </Text>

            {pendingFiles.map((file, index) => (
              <View key={`${file.name}-${index}`} style={styles.fileRow}>
                <Ionicons name="musical-note" size={20} color={Colors.primary} />
                <TextInput
                  style={styles.fileTitleInput}
                  value={file.title}
                  onChangeText={(text) => updateFileTitle(index, text)}
                  placeholder="Título da faixa"
                  placeholderTextColor={Colors.textInactive}
                  editable={!isUploading}
                />
                {!isUploading && (
                  <TouchableOpacity onPress={() => removeFile(index)} style={styles.removeButton}>
                    <Ionicons name="close-circle" size={22} color="#ff5252" />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {/* Album metadata */}
            <Text style={[styles.sectionTitle, { marginTop: Layout.padding.lg }]}>
              Dados do Disco / Banda
            </Text>

            <TextInput
              style={styles.input}
              value={albumArtist}
              onChangeText={setAlbumArtist}
              placeholder="Artista / Banda *"
              placeholderTextColor={Colors.textInactive}
              editable={!isUploading}
            />

            <TextInput
              style={styles.input}
              value={albumName}
              onChangeText={setAlbumName}
              placeholder="Nome do Álbum"
              placeholderTextColor={Colors.textInactive}
              editable={!isUploading}
            />

            <TextInput
              style={styles.input}
              value={albumGenre}
              onChangeText={setAlbumGenre}
              placeholder="Gênero"
              placeholderTextColor={Colors.textInactive}
              editable={!isUploading}
            />

            {/* Cover Image */}
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
                  {coverUri ? 'Capa selecionada' : 'Capa do disco (opcional)'}
                </Text>
                <Text style={styles.coverPickerHint}>Toque para escolher uma imagem</Text>
              </View>
            </TouchableOpacity>

            {/* Copyleft notice */}
            <View style={styles.copyleftNotice}>
              <Ionicons name="globe-outline" size={16} color={Colors.primary} />
              <Text style={styles.copyleftNoticeText}>
                Ao enviar, suas músicas serão compartilhadas com toda a comunidade sob licença Copyleft.
              </Text>
            </View>

            {/* Upload button */}
            <TouchableOpacity
              style={[styles.uploadButton, isUploading && { opacity: 0.7 }]}
              onPress={uploadAll}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color={Colors.background} size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={Colors.background} />
                  <Text style={styles.uploadButtonText}>
                    Enviar {pendingFiles.length} {pendingFiles.length === 1 ? 'música' : 'músicas'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

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
          uploadedTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              trackList={uploadedTracks}
              onOptionsPress={(t) => deleteTrack(t)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scrollContent: {
    paddingBottom: Layout.padding.xl,
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
  formSection: {
    marginHorizontal: Layout.padding.md,
    marginTop: Layout.padding.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Layout.padding.sm,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: Layout.borderRadius.sm,
    paddingHorizontal: Layout.padding.sm,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.inactive,
  },
  fileTitleInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    marginLeft: Layout.padding.sm,
    paddingVertical: 0,
  },
  removeButton: {
    padding: 4,
  },
  input: {
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
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius.round,
    paddingVertical: 16,
    gap: 8,
  },
  uploadButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  trackListHeader: {
    paddingHorizontal: Layout.padding.md,
    paddingTop: Layout.padding.xl,
    paddingBottom: Layout.padding.sm,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
});
