import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';
import * as admin from 'firebase-admin';

const SOURCE = 'internet-archive';
const SEARCH_URL = 'https://archive.org/advancedsearch.php';
const METADATA_URL = 'https://archive.org/metadata';
const DOWNLOAD_URL = 'https://archive.org/download';
const STATE_DOC = 'import-state/internet-archive';

const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.flac'];

// Different search queries to cover more of the catalog
const SEARCH_QUERIES = [
  'mediatype:audio AND licenseurl:*creativecommons* AND format:mp3',
  'mediatype:audio AND collection:opensource_audio AND format:mp3',
  'mediatype:audio AND licenseurl:*publicdomain* AND format:mp3',
  'mediatype:audio AND collection:audio_music AND format:mp3',
  'mediatype:audio AND licenseurl:*creativecommons* AND subject:rock AND format:mp3',
  'mediatype:audio AND licenseurl:*creativecommons* AND subject:electronic AND format:mp3',
  'mediatype:audio AND licenseurl:*creativecommons* AND subject:jazz AND format:mp3',
  'mediatype:audio AND licenseurl:*creativecommons* AND subject:classical AND format:mp3',
  'mediatype:audio AND licenseurl:*creativecommons* AND subject:folk AND format:mp3',
  'mediatype:audio AND licenseurl:*creativecommons* AND subject:ambient AND format:mp3',
];

const SORT_OPTIONS = [
  'addeddate desc',
  'downloads desc',
  'date desc',
  'createdate desc',
];

interface IASearchDoc {
  identifier: string;
  title: string;
  creator?: string;
  subject?: string | string[];
  licenseurl?: string;
}

interface IAFile {
  name: string;
  format: string;
  length?: string;
  source: string;
}

interface IAMetadata {
  metadata: {
    identifier: string;
    title: string;
    creator?: string;
    subject?: string | string[];
    licenseurl?: string;
  };
  files: IAFile[];
}

interface IAState {
  queryIndex: number;
  sortIndex: number;
  pageOffset: number;
  lastRun: string;
}

export async function fetchInternetArchive(
  db?: admin.firestore.Firestore
): Promise<SourceResult> {
  const tracks: TrackRecord[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  // Load state
  let state: IAState = { queryIndex: 0, sortIndex: 0, pageOffset: 0, lastRun: '' };
  if (db) {
    try {
      const stateDoc = await db.doc(STATE_DOC).get();
      if (stateDoc.exists) state = stateDoc.data() as IAState;
    } catch (e) {
      log(SOURCE, `Could not load state: ${(e as Error).message}`);
    }
  }

  // Run 3 different queries per execution
  const queriesToRun = 3;
  const ROWS_PER_QUERY = 100;
  const MAX_ITEMS_PER_QUERY = 50;

  for (let q = 0; q < queriesToRun; q++) {
    const queryIdx = (state.queryIndex + q) % SEARCH_QUERIES.length;
    const query = SEARCH_QUERIES[queryIdx];
    const sort = SORT_OPTIONS[(state.sortIndex + q) % SORT_OPTIONS.length];

    try {
      const pageOffset = q === 0 ? state.pageOffset : 0;
      const searchParams = new URLSearchParams({
        q: query,
        output: 'json',
        rows: String(ROWS_PER_QUERY),
        page: String(Math.floor(pageOffset / ROWS_PER_QUERY) + 1),
        sort,
        'fl[]': 'identifier,title,creator,subject,licenseurl',
      });

      log(SOURCE, `Query ${q + 1}: "${query.substring(0, 60)}..." (sort: ${sort})`);
      const searchRes = await fetch(`${SEARCH_URL}?${searchParams}`);

      if (!searchRes.ok) {
        errors.push(`Search HTTP ${searchRes.status} for query ${q + 1}`);
        continue;
      }

      const searchData = await searchRes.json();
      const docs: IASearchDoc[] = searchData.response?.docs || [];
      log(SOURCE, `Query ${q + 1}: found ${docs.length} items, processing up to ${MAX_ITEMS_PER_QUERY}`);

      const itemsToProcess = docs.slice(0, MAX_ITEMS_PER_QUERY);

      for (const doc of itemsToProcess) {
        try {
          await sleep(300);

          const metaRes = await fetch(`${METADATA_URL}/${doc.identifier}`);
          if (!metaRes.ok) {
            errors.push(`Metadata HTTP ${metaRes.status} for ${doc.identifier}`);
            continue;
          }

          const meta: IAMetadata = await metaRes.json();

          const audioFiles = meta.files
            .filter(f =>
              AUDIO_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
            )
            .filter(
              f =>
                f.source === 'original' ||
                f.format?.toLowerCase().includes('mp3')
            );

          if (audioFiles.length === 0) continue;

          const artworkUrl = `https://archive.org/services/img/${doc.identifier}`;
          const artist = meta.metadata.creator || doc.creator || 'Unknown Artist';
          const license = meta.metadata.licenseurl || doc.licenseurl || 'Creative Commons';
          const genre = extractGenre(doc.subject);

          for (const file of audioFiles) {
            const duration = file.length ? Math.round(parseFloat(file.length)) : 0;
            const trackId = `ia-${doc.identifier}-${sanitizeFilename(file.name)}`;
            const safeId = trackId.length > 128 ? trackId.substring(0, 128) : trackId;

            if (seen.has(safeId)) continue;
            seen.add(safeId);

            tracks.push(
              sanitizeTrack({
                id: safeId,
                title: cleanTitle(file.name),
                artist,
                album: doc.title || 'Internet Archive',
                duration,
                artwork: artworkUrl,
                audioUrl: `${DOWNLOAD_URL}/${doc.identifier}/${encodeURIComponent(file.name)}`,
                genre,
                license,
              })
            );
          }
        } catch (err) {
          errors.push(`Item ${doc.identifier}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      errors.push(`Query ${q + 1} error: ${(err as Error).message}`);
    }
  }

  // Save state
  if (db) {
    try {
      const newState: IAState = {
        queryIndex: (state.queryIndex + queriesToRun) % SEARCH_QUERIES.length,
        sortIndex: (state.sortIndex + 1) % SORT_OPTIONS.length,
        pageOffset: state.pageOffset + ROWS_PER_QUERY,
        lastRun: new Date().toISOString(),
      };
      await db.doc(STATE_DOC).set(newState);
      log(SOURCE, `State saved: queryIdx=${newState.queryIndex}, pageOffset=${newState.pageOffset}`);
    } catch (e) {
      log(SOURCE, `Could not save state: ${(e as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} unique tracks with ${errors.length} errors`);
  return { sourceName: SOURCE, tracks, errors };
}

function cleanTitle(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .substring(0, 60);
}

function extractGenre(subject?: string | string[]): string {
  if (!subject) return 'Other';
  const tags = Array.isArray(subject)
    ? subject
    : subject.split(';').map(s => s.trim());
  const genreMap: Record<string, string> = {
    rock: 'Rock', electronic: 'Electronic', jazz: 'Jazz',
    classical: 'Classical', folk: 'Folk', ambient: 'Ambient',
    pop: 'Pop', indie: 'Indie', experimental: 'Experimental',
    world: 'World', piano: 'Piano', metal: 'Metal',
    hiphop: 'Hip Hop', 'hip-hop': 'Hip Hop', blues: 'Blues',
    country: 'Country', reggae: 'Reggae', soul: 'Soul',
  };
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [key, value] of Object.entries(genreMap)) {
      if (lower.includes(key)) return value;
    }
  }
  return 'Other';
}
