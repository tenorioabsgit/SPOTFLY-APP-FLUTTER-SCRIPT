import { SupabaseClient } from '@supabase/supabase-js';
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

/** Upload a Buffer to a Supabase Storage bucket. Returns the public URL. */
export async function uploadToStorage(
  client: SupabaseClient,
  bucket: string,
  buffer: Buffer,
  objectPath: string,
  contentType: string
): Promise<string> {
  const { error } = await client.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * Download from a remote URL and upload to a Supabase Storage bucket.
 * Returns the public URL, or null on failure.
 */
export async function transferToStorage(
  client: SupabaseClient,
  bucket: string,
  sourceUrl: string,
  objectPath: string,
  contentType: string,
  timeoutMs = 30000
): Promise<string | null> {
  const downloaded = await downloadToBuffer(sourceUrl, timeoutMs);
  if (!downloaded) return null;

  try {
    return await uploadToStorage(client, bucket, downloaded.buffer, objectPath, contentType);
  } catch (err) {
    log('storage', `Upload failed for ${bucket}/${objectPath}: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Download audio + artwork for a track and upload both to Supabase Storage.
 * Audio is required (returns null if it fails); artwork failure keeps the
 * original (typically Jamendo CDN) URL instead of blocking the whole track.
 */
export async function uploadTrackMedia(
  client: SupabaseClient,
  trackId: string,
  audioUrl: string,
  artworkUrl: string
): Promise<{ audioUrl: string; artwork: string } | null> {
  const audioPath = `${trackId}.mp3`;
  const artworkPath = `${trackId}.jpg`;

  const newAudioUrl = await transferToStorage(
    client,
    'audio',
    audioUrl,
    audioPath,
    'audio/mpeg',
    60000
  );
  if (!newAudioUrl) {
    log('storage', `SKIP ${trackId}: audio download/upload failed`);
    return null;
  }

  let newArtworkUrl = artworkUrl;
  if (artworkUrl) {
    const artResult = await transferToStorage(
      client,
      'artwork',
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

  return { audioUrl: newAudioUrl, artwork: newArtworkUrl };
}
