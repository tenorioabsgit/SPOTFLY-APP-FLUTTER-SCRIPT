import { getSupabaseClient } from './supabaseClient';
import { fetchJamendo } from './sources/jamendo';
import { uploadTrackMedia } from './storage';
import { TrackRecord, ImportStats, SourceResult } from './types';
import { log, validateTrack } from './utils';
import { SupabaseClient } from '@supabase/supabase-js';

const EXISTENCE_CHECK_CHUNK = 200;
const WRITE_BATCH_SIZE = 500;

async function main() {
  log('main', '=== Spotfly Music Import Starting ===');
  const startTime = Date.now();

  const client = getSupabaseClient();
  log('main', 'Supabase client initialized');

  const results = await Promise.allSettled([
    fetchJamendo(client),
  ]);

  const allTracks: TrackRecord[] = [];
  const allStats: ImportStats[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const sr: SourceResult = result.value;
      const valid = sr.tracks.filter(validateTrack);
      allTracks.push(...valid);

      if (sr.errors.length > 0) {
        log(sr.sourceName, `Warnings: ${sr.errors.join('; ')}`);
      }

      allStats.push({
        source: sr.sourceName,
        fetched: sr.tracks.length,
        newTracks: 0,
        skippedDuplicates: 0,
        errors: sr.errors.length,
      });
    } else {
      log('main', `Source failed: ${result.reason}`);
      allStats.push({
        source: 'unknown',
        fetched: 0,
        newTracks: 0,
        skippedDuplicates: 0,
        errors: 1,
      });
    }
  }

  log('main', `Total valid tracks fetched: ${allTracks.length}`);

  const existingIds = await getExistingIds(client, allTracks.map((t) => t.id));
  const newTracks = allTracks.filter((t) => !existingIds.has(t.id));
  log(
    'main',
    `After dedup: ${newTracks.length} new, ${allTracks.length - newTracks.length} duplicates`
  );

  const sourcePrefixMap: Record<string, string> = { jamendo: 'jamendo-' };
  for (const stat of allStats) {
    const prefix = sourcePrefixMap[stat.source] || stat.source;
    const sourceTracks = allTracks.filter((t) => t.id.startsWith(prefix));
    const sourceNew = newTracks.filter((t) => t.id.startsWith(prefix));
    stat.newTracks = sourceNew.length;
    stat.skippedDuplicates = sourceTracks.length - sourceNew.length;
  }

  let writtenCount = 0;

  if (newTracks.length > 0 && process.env.DRY_RUN !== '1') {
    log('main', `Uploading ${newTracks.length} tracks to Supabase Storage...`);

    const UPLOAD_CONCURRENCY = 3;
    const WRITE_FLUSH_SIZE = 10;
    const DEADLINE_MS = 16 * 60 * 1000; // stay under the workflow's timeout-minutes: 20
    let uploaded = 0;
    let skipped = 0;
    let pending: TrackRecord[] = [];

    for (let i = 0; i < newTracks.length; i += UPLOAD_CONCURRENCY) {
      if (Date.now() - startTime > DEADLINE_MS) {
        log('main', `Time budget reached at ${i}/${newTracks.length} tracks; stopping early for a clean exit`);
        break;
      }
      const chunk = newTracks.slice(i, i + UPLOAD_CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async (track) => {
          const result = await uploadTrackMedia(client, track.id, track.audio_url, track.artwork);
          if (result) {
            track.audio_url = result.audioUrl;
            track.artwork = result.artwork;
            pending.push(track);
            uploaded++;
          } else {
            log('main', `WARN: Could not upload ${track.id} to Storage, skipping`);
            skipped++;
          }
        })
      );

      if (pending.length >= WRITE_FLUSH_SIZE) {
        await upsertTracks(client, pending);
        writtenCount += pending.length;
        log('main', `Progress: ${writtenCount}/${newTracks.length} tracks written`);
        pending = [];
      }
    }

    if (pending.length > 0) {
      await upsertTracks(client, pending);
      writtenCount += pending.length;
      log('main', `Progress: ${writtenCount}/${newTracks.length} tracks written`);
    }

    log('main', `Storage upload complete: ${uploaded} uploaded, ${skipped} skipped`);
  } else if (process.env.DRY_RUN === '1') {
    log('main', `[DRY RUN] Would write ${newTracks.length} tracks`);
    for (const t of newTracks.slice(0, 5)) {
      log('main', `  - ${t.id}: "${t.title}" by ${t.artist} [${t.genre}]`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('main', '=== Import Summary ===');
  for (const stat of allStats) {
    log(
      'main',
      `  ${stat.source}: fetched=${stat.fetched} new=${stat.newTracks} dupes=${stat.skippedDuplicates} errors=${stat.errors}`
    );
  }
  log('main', `Total new tracks written: ${writtenCount}`);
  log('main', `Completed in ${elapsed}s`);
}

async function getExistingIds(client: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  for (let i = 0; i < ids.length; i += EXISTENCE_CHECK_CHUNK) {
    const chunk = ids.slice(i, i + EXISTENCE_CHECK_CHUNK);
    if (chunk.length === 0) continue;
    const { data, error } = await client.from('tracks').select('id').in('id', chunk);
    if (error) throw new Error(`Existence check failed: ${error.message}`);
    for (const row of data ?? []) existing.add(row.id as string);
  }
  return existing;
}

async function upsertTracks(client: SupabaseClient, tracks: TrackRecord[]): Promise<void> {
  for (let i = 0; i < tracks.length; i += WRITE_BATCH_SIZE) {
    const chunk = tracks.slice(i, i + WRITE_BATCH_SIZE);
    const { error } = await client
      .from('tracks')
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`Batch upsert failed: ${error.message}`);
    log('main', `Wrote batch of ${chunk.length} tracks (${i + chunk.length}/${tracks.length})`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
