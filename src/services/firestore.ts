import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './firebase';
import { Playlist, Track, User } from '../types';

// ============================================================
// USERS
// ============================================================
export async function createUserProfile(user: User): Promise<void> {
  await setDoc(doc(db, 'users', user.id), {
    ...user,
    createdAt: serverTimestamp(),
  });
}

export async function getUserProfile(userId: string): Promise<User | null> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...data,
    id: snap.id,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : data.createdAt,
  } as User;
}

export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<void> {
  await updateDoc(doc(db, 'users', userId), updates);
}

// ============================================================
// PLAYLISTS
// ============================================================
export async function createPlaylist(playlist: Omit<Playlist, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'playlists'), {
    ...playlist,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getPlaylist(playlistId: string): Promise<Playlist | null> {
  const snap = await getDoc(doc(db, 'playlists', playlistId));
  if (!snap.exists()) return null;
  return docToPlaylist(snap.id, snap.data());
}

export async function getUserPlaylists(userId: string): Promise<Playlist[]> {
  const q = query(
    collection(db, 'playlists'),
    where('createdBy', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToPlaylist(d.id, d.data()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getPublicPlaylists(limitCount = 20): Promise<Playlist[]> {
  const q = query(
    collection(db, 'playlists'),
    where('isPublic', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToPlaylist(d.id, d.data()))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limitCount);
}

export async function updatePlaylist(playlistId: string, updates: Partial<Playlist>): Promise<void> {
  await updateDoc(doc(db, 'playlists', playlistId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await deleteDoc(doc(db, 'playlists', playlistId));
}

export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
  await updateDoc(doc(db, 'playlists', playlistId), {
    trackIds: arrayUnion(trackId),
    updatedAt: serverTimestamp(),
  });
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  await updateDoc(doc(db, 'playlists', playlistId), {
    trackIds: arrayRemove(trackId),
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// TRACKS (uploaded by users)
// ============================================================
export async function saveTrackMetadata(track: Track): Promise<void> {
  await setDoc(doc(db, 'tracks', track.id), {
    ...track,
    addedAt: serverTimestamp(),
  });
}

export async function getTrackMetadata(trackId: string): Promise<Track | null> {
  const snap = await getDoc(doc(db, 'tracks', trackId));
  if (!snap.exists()) return null;
  return docToTrack(snap.id, snap.data());
}

export async function getUserTracks(userId: string): Promise<Track[]> {
  const q = query(
    collection(db, 'tracks'),
    where('uploadedBy', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToTrack(d.id, d.data()))
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

export async function deleteTrackMetadata(trackId: string): Promise<void> {
  await deleteDoc(doc(db, 'tracks', trackId));
}

export async function getTracksByIds(trackIds: string[]): Promise<Track[]> {
  if (trackIds.length === 0) return [];
  const results: Track[] = [];
  // Firestore 'in' queries support max 30 items per batch
  for (let i = 0; i < trackIds.length; i += 30) {
    const batch = trackIds.slice(i, i + 30);
    const q = query(collection(db, 'tracks'), where('id', 'in', batch));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      results.push(docToTrack(d.id, d.data()));
    }
  }
  return results;
}

export async function getAllTracks(limitCount = 100): Promise<Track[]> {
  const q = query(
    collection(db, 'tracks'),
    orderBy('addedAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToTrack(d.id, d.data()));
}

export async function getAllCopyleftTracks(limitCount = 50): Promise<Track[]> {
  const q = query(
    collection(db, 'tracks'),
    where('isLocal', '==', false)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToTrack(d.id, d.data()))
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, limitCount);
}

// ============================================================
// LIKED TRACKS
// ============================================================
export async function likeTrack(userId: string, trackId: string): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'likedTracks', trackId), {
    trackId,
    likedAt: serverTimestamp(),
  });
}

export async function unlikeTrack(userId: string, trackId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'likedTracks', trackId));
}

export async function getLikedTrackIds(userId: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'likedTracks'));
  return snap.docs.map(d => d.data().trackId);
}

export async function isTrackLiked(userId: string, trackId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId, 'likedTracks', trackId));
  return snap.exists();
}

// ============================================================
// SEARCH (basic text search via Firestore)
// ============================================================
export async function searchTracksByTitle(searchQuery: string, limitCount = 20): Promise<Track[]> {
  const q = query(
    collection(db, 'tracks'),
    where('titleLower', '>=', searchQuery.toLowerCase()),
    where('titleLower', '<=', searchQuery.toLowerCase() + '\uf8ff'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => docToTrack(d.id, d.data()));
}

// ============================================================
// HELPERS
// ============================================================
function docToPlaylist(id: string, data: any): Playlist {
  return {
    id,
    title: data.title || '',
    description: data.description || '',
    artwork: data.artwork || '',
    trackIds: data.trackIds || [],
    createdBy: data.createdBy || '',
    isPublic: data.isPublic ?? true,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : (data.updatedAt || Date.now()),
  };
}

function docToTrack(id: string, data: any): Track {
  return {
    id,
    title: data.title || '',
    artist: data.artist || '',
    artistId: data.artistId || '',
    album: data.album || '',
    albumId: data.albumId || '',
    duration: data.duration || 0,
    artwork: data.artwork || '',
    audioUrl: data.audioUrl || '',
    isLocal: data.isLocal ?? false,
    genre: data.genre || '',
    license: data.license || '',
    addedAt: data.addedAt instanceof Timestamp ? data.addedAt.toMillis() : data.addedAt,
    uploadedBy: data.uploadedBy || '',
    uploadedByName: data.uploadedByName || '',
    titleLower: data.titleLower || '',
  };
}
