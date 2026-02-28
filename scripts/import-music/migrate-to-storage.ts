import * as admin from 'firebase-admin';
import { initFirebaseAdmin, getStorageBucket } from './firebaseAdmin';
import { uploadTrackMedia } from './storage';
import { log } from './utils';

const CONCURRENCY = 3;
const PAGE_SIZE = 100;

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  failedIds: string[];
}

async function main() {
  const isDryRun = process.env.DRY_RUN === '1';
  const limitCount = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
  const startAfter = process.env.START_AFTER || '';

  log('migrate', '=== Spotfly Storage Migration ===');
  log('migrate', `Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  log('migrate', `Concurrency: ${CONCURRENCY}`);
  if (limitCount < Infinity) log('migrate', `Limit: ${limitCount}`);
  if (startAfter) log('migrate', `Resuming after: ${startAfter}`);

  const db = initFirebaseAdmin();
  const bucket = getStorageBucket();
  const startTime = Date.now();

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
  };

  // Build base query for Jamendo tracks
  let query: admin.firestore.Query = db
    .collection('tracks')
    .orderBy('__name__')
    .limit(PAGE_SIZE);

  // Resume from a specific document
  if (startAfter) {
    const startDoc = await db.collection('tracks').doc(startAfter).get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
      log('migrate', `Resuming after document: ${startAfter}`);
    } else {
      log('migrate', `WARN: START_AFTER doc "${startAfter}" not found, starting from beginning`);
    }
  }

  let lastDocId = '';
  let hasMore = true;
  let processed = 0;

  while (hasMore && processed < limitCount) {
    const snapshot = await query.get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const docs = snapshot.docs;

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < docs.length && processed < limitCount; i += CONCURRENCY) {
      const chunk = docs.slice(i, Math.min(i + CONCURRENCY, docs.length));

      await Promise.allSettled(
        chunk.map(async (doc) => {
          const data = doc.data();
          stats.total++;

          // Skip if already migrated
          if (data.originalAudioUrl) {
            stats.skipped++;
            return;
          }

          // Skip if not a Jamendo URL
          const audioUrl = data.audioUrl as string;
          const artworkUrl = (data.artwork as string) || '';
          if (!audioUrl || !audioUrl.includes('jamendo')) {
            stats.skipped++;
            return;
          }

          if (isDryRun) {
            log('migrate', `[DRY RUN] Would migrate: ${doc.id} - "${data.title}"`);
            stats.migrated++;
            return;
          }

          // Download + Upload
          const result = await uploadTrackMedia(bucket, doc.id, audioUrl, artworkUrl);

          if (result) {
            await doc.ref.update({
              audioUrl: result.audioUrl,
              artwork: result.artwork,
              originalAudioUrl: result.originalAudioUrl,
              originalArtwork: result.originalArtwork,
            });
            stats.migrated++;
            log('migrate', `OK: ${doc.id} - "${data.title}"`);
          } else {
            stats.failed++;
            stats.failedIds.push(doc.id);
          }
        })
      );

      processed += chunk.length;
    }

    // Set up next page
    lastDocId = docs[docs.length - 1].id;
    query = db
      .collection('tracks')
      .orderBy('__name__')
      .startAfter(docs[docs.length - 1])
      .limit(PAGE_SIZE);
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('migrate', '=== Migration Summary ===');
  log('migrate', `  Total scanned: ${stats.total}`);
  log('migrate', `  Migrated: ${stats.migrated}`);
  log('migrate', `  Skipped (already done or non-Jamendo): ${stats.skipped}`);
  log('migrate', `  Failed: ${stats.failed}`);
  log('migrate', `  Last doc ID: ${lastDocId}`);
  log('migrate', `  Completed in ${elapsed}s`);

  if (stats.failedIds.length > 0) {
    log('migrate', `  Failed IDs: ${stats.failedIds.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
