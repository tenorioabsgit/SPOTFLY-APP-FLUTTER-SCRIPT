import { randomUUID } from 'crypto';
import { Bucket } from '@google-cloud/storage';
import { STORAGE_BUCKET } from './firebaseAdmin';
import { log } from './utils';

/** Download a remote URL into a Buffer. Returns null on failure. */
export async function downloadToBuffer(
  url: string,
  timeoutMs = 30000
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      log('storage', `HTTP ${response.status} downloading ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType =
      response.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
  } catch (err) {
    log('storage', `Download failed for ${url}: ${(err as Error).message}`);
    return null;
  }
}

/** Upload a Buffer to Firebase Storage. Returns the public download URL. */
export async function uploadToStorage(
  bucket: Bucket,
  buffer: Buffer,
  storagePath: string,
  contentType: string
): Promise<string> {
  const token = randomUUID();
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    metadata: {
      contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  const encodedPath = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media&token=${token}`;
}

/**
 * Download from a remote URL and upload to Firebase Storage.
 * Returns the Firebase Storage download URL, or null on failure.
 */
export async function transferToStorage(
  bucket: Bucket,
  sourceUrl: string,
  storagePath: string,
  contentType: string,
  timeoutMs = 30000
): Promise<string | null> {
  const downloaded = await downloadToBuffer(sourceUrl, timeoutMs);
  if (!downloaded) return null;

  try {
    return await uploadToStorage(bucket, downloaded.buffer, storagePath, contentType);
  } catch (err) {
    log('storage', `Upload failed for ${storagePath}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Download audio + artwork for a track and upload both to Firebase Storage.
 * Returns updated URLs and backup of originals, or null if audio fails.
 */
export async function uploadTrackMedia(
  bucket: Bucket,
  trackId: string,
  audioUrl: string,
  artworkUrl: string
): Promise<{
  audioUrl: string;
  artwork: string;
  originalAudioUrl: string;
  originalArtwork: string;
} | null> {
  const audioPath = `spotfly-audio/${trackId}.mp3`;
  const artworkPath = `spotfly-artwork/${trackId}.jpg`;

  // Download + upload audio (required)
  const newAudioUrl = await transferToStorage(
    bucket,
    audioUrl,
    audioPath,
    'audio/mpeg',
    60000
  );
  if (!newAudioUrl) {
    log('storage', `SKIP ${trackId}: audio download/upload failed`);
    return null;
  }

  // Download + upload artwork (optional — keep original on failure)
  let newArtworkUrl = artworkUrl;
  if (artworkUrl) {
    const artResult = await transferToStorage(
      bucket,
      artworkUrl,
      artworkPath,
      'image/jpeg',
      15000
    );
    if (artResult) {
      newArtworkUrl = artResult;
    } else {
      log('storage', `WARN ${trackId}: artwork failed, keeping original`);
    }
  }

  return {
    audioUrl: newAudioUrl,
    artwork: newArtworkUrl,
    originalAudioUrl: audioUrl,
    originalArtwork: artworkUrl,
  };
}
