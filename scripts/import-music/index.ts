import { initFirebaseAdmin, getStorageBucket } from './firebaseAdmin';
import { fetchJamendo } from './sources/jamendo';
import { uploadTrackMedia } from './storage';
import { TrackRecord, ImportStats, SourceResult } from './types';
import { log, validateTrack } from './utils';
import * as admin from 'firebase-admin';

const BATCH_SIZE = 500;

async function main() {
  log('main', '=== Spotfly Music Import Starting ===');
  const startTime = Date.now();

  const db = initFirebaseAdmin();
  log('main', 'Firebase Admin initialized');

  // Fetch from all sources concurrently (pass db for state persistence)
  const results = await Promise.allSettled([
    fetchJamendo(db),
  ]);

  const allTracks: TrackRecord[] = [];
  const allStats: ImportStats[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const sr: SourceResult = result.value;

      // Filter valid tracks
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

  // Deduplicate against Firestore
  const existingIds = await batchCheckExisting(
    db,
    allTracks.map(t => t.id)
  );

  const newTracks = allTracks.filter(t => !existingIds.has(t.id));
  log(
    'main',
    `After dedup: ${newTracks.length} new, ${allTracks.length - newTracks.length} duplicates`
  );

  // Update per-source stats
  const sourcePrefixMap: Record<string, string> = {
    jamendo: 'jamendo-',
  };
  for (const stat of allStats) {
    const prefix = sourcePrefixMap[stat.source] || stat.source;
    const sourceTracks = allTracks.filter(t => t.id.startsWith(prefix));
    const sourceNew = newTracks.filter(t => t.id.startsWith(prefix));
    stat.newTracks = sourceNew.length;
    stat.skippedDuplicates = sourceTracks.length - sourceNew.length;
  }

  // Upload media to Firebase Storage for new tracks
  if (newTracks.length > 0 && process.env.DRY_RUN !== '1') {
    const bucket = getStorageBucket();
    log('main', `Uploading ${newTracks.length} tracks to Firebase Storage...`);

    const UPLOAD_CONCURRENCY = 3;
    let uploaded = 0;
    let kept = 0;

    for (let i = 0; i < newTracks.length; i += UPLOAD_CONCURRENCY) {
      const chunk = newTracks.slice(i, i + UPLOAD_CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async (track) => {
          const result = await uploadTrackMedia(
            bucket,
            track.id,
            track.audioUrl,
            track.artwork
          );
          if (result) {
            track.originalAudioUrl = result.originalAudioUrl;
            track.originalArtwork = result.originalArtwork;
            track.audioUrl = result.audioUrl;
            track.artwork = result.artwork;
            uploaded++;
          } else {
            log('main', `WARN: Could not upload ${track.id} to Storage, keeping Jamendo URL`);
            kept++;
          }
        })
      );
    }

    log('main', `Storage upload complete: ${uploaded} uploaded, ${kept} kept original URL`);
  }

  // Write new tracks (or dry run)
  if (process.env.DRY_RUN === '1') {
    log('main', `[DRY RUN] Would write ${newTracks.length} tracks`);
    for (const t of newTracks.slice(0, 5)) {
      log('main', `  - ${t.id}: "${t.title}" by ${t.artist} [${t.genre}]`);
    }
  } else if (newTracks.length > 0) {
    await batchWriteTracks(db, newTracks);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('main', '=== Import Summary ===');
  for (const stat of allStats) {
    log(
      'main',
      `  ${stat.source}: fetched=${stat.fetched} new=${stat.newTracks} dupes=${stat.skippedDuplicates} errors=${stat.errors}`
    );
  }
  log('main', `Total new tracks written: ${newTracks.length}`);
  log('main', `Completed in ${elapsed}s`);
}

async function batchCheckExisting(
  db: admin.firestore.Firestore,
  ids: string[]
): Promise<Set<string>> {
  const existing = new Set<string>();
  const CHUNK = 100;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const refs = chunk.map(id => db.collection('tracks').doc(id));
    const snapshots = await db.getAll(...refs);

    for (const snap of snapshots) {
      if (snap.exists) {
        existing.add(snap.id);
      }
    }
  }

  return existing;
}

async function batchWriteTracks(
  db: admin.firestore.Firestore,
  tracks: TrackRecord[]
): Promise<void> {
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const chunk = tracks.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const track of chunk) {
      const ref = db.collection('tracks').doc(track.id);
      batch.set(ref, {
        ...track,
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    log(
      'main',
      `Wrote batch of ${chunk.length} tracks (${i + chunk.length}/${tracks.length})`
    );
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
