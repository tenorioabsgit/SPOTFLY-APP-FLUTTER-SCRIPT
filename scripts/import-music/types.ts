export interface TrackRecord {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  album: string;
  albumId: string;
  duration: number;
  artwork: string;
  audioUrl: string;
  isLocal: boolean;
  genre: string;
  license: string;
  uploadedBy: string;
  uploadedByName: string;
  titleLower: string;
  originalAudioUrl?: string;
  originalArtwork?: string;
}

export interface SourceResult {
  sourceName: string;
  tracks: TrackRecord[];
  errors: string[];
}

export interface ImportStats {
  source: string;
  fetched: number;
  newTracks: number;
  skippedDuplicates: number;
  errors: number;
}
