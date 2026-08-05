export interface TrackRecord {
  id: string;
  title: string;
  artist: string;
  artist_id: string;
  album: string;
  album_id: string;
  duration: number;
  artwork: string;
  audio_url: string;
  is_local: boolean;
  genre: string;
  license: string;
  source: string;
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
