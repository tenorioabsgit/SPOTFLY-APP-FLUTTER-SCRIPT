import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log, isRockGenre, isSfxTrack } from '../utils';
import { SupabaseClient } from '@supabase/supabase-js';

const SOURCE = 'jamendo';
const BASE_URL = 'https://api.jamendo.com/v3.0/tracks/';
const PAGE_SIZE = 200;
const PAGES_PER_GENRE = 5; // 1.000 tracks per genre

// Rock-related genres only
const GENRES = [
  'rock', 'metal', 'punk', 'hardrock', 'hardcore',
  'progressive', 'grunge', 'alternative', 'indie',
  'postpunk', 'stonerrock', 'numetal', 'metalcore',
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
  client: SupabaseClient
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

  // Load state from Supabase
  let state: JamendoState = {
    genreIndex: 0,
    sortIndex: 0,
    globalOffset: 0,
    lastRun: '',
  };

  try {
    const { data, error } = await client
      .from('import_state')
      .select('genre_index, sort_index, global_offset, last_run')
      .eq('source', SOURCE)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      state = {
        genreIndex: data.genre_index,
        sortIndex: data.sort_index,
        globalOffset: data.global_offset,
        lastRun: data.last_run,
      };
    }
  } catch (e) {
    log(SOURCE, `Could not load state: ${(e as Error).message}`);
  }

  // Strategy 1: Fetch by genre rotation (5 genres per run, 5 pages each)
  const genresToFetch = 5;
  let requestCount = 0;
  let sfxSkipped = 0;

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

          const trackGenre = t.musicinfo?.tags?.genres?.[0] || genre;
          const candidate = {
            title: t.name,
            artist: t.artist_name,
            album: t.album_name,
            genre: trackGenre,
            duration: t.duration,
          };
          if (isSfxTrack(candidate)) {
            sfxSkipped++;
            continue;
          }

          tracks.push(
            sanitizeTrack({
              id,
              title: t.name,
              artist: t.artist_name,
              artist_id: `jamendo-artist-${t.artist_id}`,
              album: t.album_name || 'Singles',
              album_id: t.album_id ? `jamendo-album-${t.album_id}` : '',
              duration: t.duration,
              artwork: t.album_image || t.image || '',
              audio_url: t.audio || t.audiodownload,
              genre: trackGenre,
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
        const trackGenre = t.musicinfo?.tags?.genres?.[0] || '';
        if (!isRockGenre(trackGenre)) continue;
        const id = `jamendo-${t.id}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const candidate = {
          title: t.name,
          artist: t.artist_name,
          album: t.album_name,
          genre: trackGenre,
          duration: t.duration,
        };
        if (isSfxTrack(candidate)) {
          sfxSkipped++;
          continue;
        }

        tracks.push(
          sanitizeTrack({
            id,
            title: t.name,
            artist: t.artist_name,
            artist_id: `jamendo-artist-${t.artist_id}`,
            album: t.album_name || 'Singles',
            album_id: t.album_id ? `jamendo-album-${t.album_id}` : '',
            duration: t.duration,
            artwork: t.album_image || t.image || '',
            audio_url: t.audio || t.audiodownload,
            genre: trackGenre,
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

  // Save updated state (skipped entirely in DRY_RUN so a dry run never advances pagination)
  if (process.env.DRY_RUN === '1') {
    log(SOURCE, 'DRY RUN: state not saved');
  } else {
    try {
      const genreIndex = (state.genreIndex + genresToFetch) % GENRES.length;
      const globalOffset = state.globalOffset + globalPages * PAGE_SIZE;
      const { error } = await client.from('import_state').upsert({
        source: SOURCE,
        genre_index: genreIndex,
        sort_index: (state.sortIndex + 1) % SORT_ORDERS.length,
        global_offset: globalOffset,
        last_run: new Date().toISOString(),
      });
      if (error) throw error;
      log(SOURCE, `State saved: genreIdx=${genreIndex}, globalOffset=${globalOffset}`);
    } catch (e) {
      log(SOURCE, `Could not save state: ${(e as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} unique tracks (${requestCount} API calls, ${sfxSkipped} SFX skipped, ${errors.length} errors)`);
  return { sourceName: SOURCE, tracks, errors };
}
