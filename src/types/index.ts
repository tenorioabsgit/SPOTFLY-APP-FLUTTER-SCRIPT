export interface Track {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  duration: number; // seconds
  artwork: string;
  audioUrl: string;
  isLocal: boolean;
  genre: string;
  license: string;
  addedAt?: number;
  uploadedBy?: string;
  uploadedByName?: string;
  titleLower?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  artwork: string;
  tracks: string[]; // track IDs
  year: number;
  genre: string;
}

export interface Artist {
  id: string;
  name: string;
  image: string;
  bio: string;
  monthlyListeners: number;
  genres: string[];
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  artwork: string;
  trackIds: string[];
  createdBy: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoUrl: string;
  createdAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  queue: Track[];
  queueIndex: number;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: RepeatMode;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}
