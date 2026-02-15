import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';
import * as admin from 'firebase-admin';

const SOURCE = 'jamendo';
const BASE_URL = 'https://api.jamendo.com/v3.0/tracks/';
const PAGE_SIZE = 200;
const PAGES_PER_GENRE = 5; // 1.000 tracks per genre
const STATE_DOC = 'import-state/jamendo';

// Genres to rotate through — covers the full Jamendo catalog
const GENRES = [
  'pop', 'rock', 'electronic', 'hiphop', 'jazz',
  'classical', 'reggae', 'metal', 'folk', 'latin',
  'rnb', 'ambient', 'soundtrack', 'punk', 'blues',
  'country', 'indie', 'dance', 'soul', 'world',
];

// Different sort strategies to reach different parts of the catalog
const SORT_ORDERS = [
  'releasedate_desc',
  'popularity_total',
  'popularity_month',
  'releasedate_asc',
];

interface JamendoTrack {
  id: string;
  name: string;
  duration: number;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_name: string;
  album_image: string;
  audio: string;
  audiodownload: string;
  image: string;
  license_ccurl: string;
  musicinfo?: {
    tags?: {
      genres?: string[];
    };
  };
}

interface JamendoResponse {
  headers: {
    status: string;
    code: number;
    results_count: number;
  };
  results: JamendoTrack[];
}

interface JamendoState {
  genreIndex: number;
  sortIndex: number;
  globalOffset: number;
  lastRun: string;
}

export async function fetchJamendo(
  db?: admin.firestore.Firestore
): Promise<SourceResult> {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return {
      sourceName: SOURCE,
      tracks: [],
      errors: ['JAMENDO_CLIENT_ID not set'],
    };
  }

  const tracks: TrackRecord[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  // Load state from Firestore
  let state: JamendoState = {
    genreIndex: 0,
    sortIndex: 0,
    globalOffset: 0,
    lastRun: '',
  };

  if (db) {
    try {
      const stateDoc = await db.doc(STATE_DOC).get();
      if (stateDoc.exists) {
        state = stateDoc.data() as JamendoState;
      }
    } catch (e) {
      log(SOURCE, `Could not load state: ${(e as Error).message}`);
    }
  }

  // Strategy 1: Fetch by genre rotation (5 genres per run, 5 pages each)
  const genresToFetch = 5;
  let requestCount = 0;

  for (let g = 0; g < genresToFetch; g++) {
    const genreIdx = (state.genreIndex + g) % GENRES.length;
    const genre = GENRES[genreIdx];

    for (let page = 0; page < PAGES_PER_GENRE; page++) {
      try {
        const offset = page * PAGE_SIZE;
        const sortOrder = SORT_ORDERS[state.sortIndex % SORT_ORDERS.length];
        const url =
          `${BASE_URL}?client_id=${clientId}&format=json&limit=${PAGE_SIZE}` +
          `&offset=${offset}&order=${sortOrder}` +
          `&tags=${genre}&include=musicinfo&audioformat=mp32`;

        log(SOURCE, `[${genre}] page ${page + 1} (${sortOrder})...`);
        const response = await fetch(url);
        requestCount++;

        if (!response.ok) {
          errors.push(`HTTP ${response.status} on ${genre} page ${page + 1}`);
          break;
        }

        const data: JamendoResponse = await response.json();
        if (data.headers.code !== 0) {
          errors.push(`API error ${data.headers.code} on ${genre} page ${page + 1}`);
          break;
        }

        for (const t of data.results) {
          if (!t.audio && !t.audiodownload) continue;
          const id = `jamendo-${t.id}`;
          if (seen.has(id)) continue;
          seen.add(id);

          tracks.push(
            sanitizeTrack({
              id,
              title: t.name,
              artist: t.artist_name,
              artistId: `jamendo-artist-${t.artist_id}`,
              album: t.album_name || 'Singles',
              albumId: t.album_id ? `jamendo-album-${t.album_id}` : '',
              duration: t.duration,
              artwork: t.album_image || t.image || '',
              audioUrl: t.audio || t.audiodownload,
              genre: t.musicinfo?.tags?.genres?.[0] || genre,
              license: t.license_ccurl || 'Creative Commons',
            })
          );
        }

        if (data.results.length < PAGE_SIZE) break;
        await sleep(500);
      } catch (err) {
        errors.push(`${genre} page ${page + 1}: ${(err as Error).message}`);
      }
    }
  }

  // Strategy 2: Global offset scan (catch everything not tagged by genre)
  const globalPages = 5;
  for (let page = 0; page < globalPages; page++) {
    try {
      const offset = state.globalOffset + page * PAGE_SIZE;
      const url =
        `${BASE_URL}?client_id=${clientId}&format=json&limit=${PAGE_SIZE}` +
        `&offset=${offset}&order=id&include=musicinfo&audioformat=mp32`;

      log(SOURCE, `[global] offset ${offset}...`);
      const response = await fetch(url);
      requestCount++;

      if (!response.ok) break;
      const data: JamendoResponse = await response.json();
      if (data.headers.code !== 0) break;

      for (const t of data.results) {
        if (!t.audio && !t.audiodownload) continue;
        const id = `jamendo-${t.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        tracks.push(
          sanitizeTrack({
            id,
            title: t.name,
            artist: t.artist_name,
            artistId: `jamendo-artist-${t.artist_id}`,
            album: t.album_name || 'Singles',
            albumId: t.album_id ? `jamendo-album-${t.album_id}` : '',
            duration: t.duration,
            artwork: t.album_image || t.image || '',
            audioUrl: t.audio || t.audiodownload,
            genre: t.musicinfo?.tags?.genres?.[0] || 'Other',
            license: t.license_ccurl || 'Creative Commons',
          })
        );
      }

      if (data.results.length < PAGE_SIZE) break;
      await sleep(500);
    } catch (err) {
      errors.push(`global offset error: ${(err as Error).message}`);
    }
  }

  // Save updated state
  if (db) {
    try {
      const newState: JamendoState = {
        genreIndex: (state.genreIndex + genresToFetch) % GENRES.length,
        sortIndex: (state.sortIndex + 1) % SORT_ORDERS.length,
        globalOffset: state.globalOffset + globalPages * PAGE_SIZE,
        lastRun: new Date().toISOString(),
      };
      await db.doc(STATE_DOC).set(newState);
      log(SOURCE, `State saved: genreIdx=${newState.genreIndex}, globalOffset=${newState.globalOffset}`);
    } catch (e) {
      log(SOURCE, `Could not save state: ${(e as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} unique tracks (${requestCount} API calls, ${errors.length} errors)`);
  return { sourceName: SOURCE, tracks, errors };
}
