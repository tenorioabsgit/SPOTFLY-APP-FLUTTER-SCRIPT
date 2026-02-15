import { TrackRecord } from './types';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function sanitizeTrack(
  partial: Partial<TrackRecord> & { id: string; audioUrl: string }
): TrackRecord {
  return {
    id: partial.id,
    title: partial.title || 'Unknown Title',
    artist: partial.artist || 'Unknown Artist',
    artistId: partial.artistId || '',
    album: partial.album || 'Singles',
    albumId: partial.albumId || '',
    duration: partial.duration || 0,
    artwork:
      partial.artwork ||
      'https://via.placeholder.com/300x300.png?text=No+Cover',
    audioUrl: partial.audioUrl,
    isLocal: false,
    genre: partial.genre || 'Other',
    license: partial.license || 'Creative Commons',
    uploadedBy: 'system-import',
    uploadedByName: 'Spotfly Bot',
    titleLower: (partial.title || 'unknown title').toLowerCase(),
  };
}

export function validateTrack(track: TrackRecord): boolean {
  if (!track.id || track.id.length > 128) return false;
  if (!track.audioUrl || !track.audioUrl.startsWith('http')) return false;
  if (!track.title) return false;
  return true;
}

export function log(source: string, message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${source}] ${message}`);
}
