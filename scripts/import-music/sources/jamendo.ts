import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';

const SOURCE = 'jamendo';
const BASE_URL = 'https://api.jamendo.com/v3.0/tracks/';
const PAGE_SIZE = 200;
const MAX_PAGES = 3;

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

export async function fetchJamendo(): Promise<SourceResult> {
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

  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const offset = page * PAGE_SIZE;
      const url = `${BASE_URL}?client_id=${clientId}&format=json&limit=${PAGE_SIZE}&offset=${offset}&order=releasedate_desc&include=musicinfo&audioformat=mp32`;

      log(SOURCE, `Fetching page ${page + 1} (offset ${offset})...`);
      const response = await fetch(url);

      if (!response.ok) {
        errors.push(`HTTP ${response.status} on page ${page + 1}`);
        break;
      }

      const data: JamendoResponse = await response.json();

      if (data.headers.code !== 0) {
        errors.push(`API error code ${data.headers.code} on page ${page + 1}`);
        break;
      }

      for (const t of data.results) {
        if (!t.audio && !t.audiodownload) continue;

        const genre = t.musicinfo?.tags?.genres?.[0] || 'Other';

        tracks.push(
          sanitizeTrack({
            id: `jamendo-${t.id}`,
            title: t.name,
            artist: t.artist_name,
            artistId: `jamendo-artist-${t.artist_id}`,
            album: t.album_name || 'Singles',
            albumId: t.album_id ? `jamendo-album-${t.album_id}` : '',
            duration: t.duration,
            artwork: t.album_image || t.image || '',
            audioUrl: t.audio || t.audiodownload,
            genre,
            license: t.license_ccurl || 'Creative Commons',
          })
        );
      }

      if (data.results.length < PAGE_SIZE) break;
      await sleep(1000);
    } catch (err) {
      errors.push(`Page ${page + 1} error: ${(err as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} tracks with ${errors.length} errors`);
  return { sourceName: SOURCE, tracks, errors };
}
