import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Track } from '../types';

const OFFLINE_DIR = `${FileSystem.documentDirectory}offline-music/`;
const SYNC_KEY = 'spotfly-synced-tracks';

interface SyncedTracks {
  [trackId: string]: string; // trackId -> local file path
}

async function getSyncedMap(): Promise<SyncedTracks> {
  const raw = await AsyncStorage.getItem(SYNC_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveSyncedMap(map: SyncedTracks): Promise<void> {
  await AsyncStorage.setItem(SYNC_KEY, JSON.stringify(map));
}

export async function ensureOfflineDir(): Promise<void> {
  if (Platform.OS === 'web') return;
  const info = await FileSystem.getInfoAsync(OFFLINE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OFFLINE_DIR, { intermediates: true });
  }
}

export async function downloadTrack(
  track: Track,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (Platform.OS === 'web') return track.audioUrl;
  if (!track.audioUrl) throw new Error('No audio URL');

  await ensureOfflineDir();

  const ext = track.audioUrl.includes('.mp3') ? '.mp3' : '.audio';
  const localPath = `${OFFLINE_DIR}${track.id}${ext}`;

  const downloadResumable = FileSystem.createDownloadResumable(
    track.audioUrl,
    localPath,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      onProgress?.(progress);
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result) throw new Error('Download failed');

  const map = await getSyncedMap();
  map[track.id] = result.uri;
  await saveSyncedMap(map);

  return result.uri;
}

export async function downloadAlbum(
  tracks: Track[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  if (Platform.OS === 'web') return;

  const tracksToDownload = [];
  for (const track of tracks) {
    if (track.audioUrl && !(await isTrackOffline(track.id))) {
      tracksToDownload.push(track);
    }
  }

  let done = 0;
  for (const track of tracksToDownload) {
    await downloadTrack(track);
    done++;
    onProgress?.(done, tracksToDownload.length);
  }
}

export async function isTrackOffline(trackId: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const map = await getSyncedMap();
  if (!map[trackId]) return false;
  const info = await FileSystem.getInfoAsync(map[trackId]);
  return info.exists;
}

export async function getOfflinePath(trackId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const map = await getSyncedMap();
  const path = map[trackId];
  if (!path) return null;
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

export async function isAlbumSynced(trackIds: string[]): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const map = await getSyncedMap();
  for (const id of trackIds) {
    if (!map[id]) return false;
    const info = await FileSystem.getInfoAsync(map[id]);
    if (!info.exists) return false;
  }
  return trackIds.length > 0;
}

export async function removeOfflineTrack(trackId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const map = await getSyncedMap();
  const path = map[trackId];
  if (path) {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch (e) {
      console.error('Error deleting offline track:', e);
    }
    delete map[trackId];
    await saveSyncedMap(map);
  }
}

export async function removeOfflineAlbum(tracks: Track[]): Promise<void> {
  for (const track of tracks) {
    await removeOfflineTrack(track.id);
  }
}
