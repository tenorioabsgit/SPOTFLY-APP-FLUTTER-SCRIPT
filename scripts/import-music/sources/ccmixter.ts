import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';

const SOURCE = 'ccmixter';
const BASE_URL = 'http://ccmixter.org/api/query';
const PAGE_SIZE = 50;
const MAX_PAGES = 2;

interface CCMixterFile {
  download_url: string;
  file_format_info?: {
    default_ext?: string;
    ps?: number;
  };
}

interface CCMixterTrack {
  upload_id: number;
  upload_name: string;
  user_real_name?: string;
  user_name?: string;
  license_url: string;
  upload_tags?: string;
  files: CCMixterFile[];
}

export async function fetchCCMixter(): Promise<SourceResult> {
  const tracks: TrackRecord[] = [];
  const errors: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    try {
      const offset = page * PAGE_SIZE;
      const url = `${BASE_URL}?f=json&limit=${PAGE_SIZE}&offset=${offset}&sort=date`;

      log(SOURCE, `Fetching page ${page + 1} (offset ${offset})...`);
      const response = await fetch(url);

      if (!response.ok) {
        errors.push(`HTTP ${response.status} on page ${page + 1}`);
        break;
      }

      const text = await response.text();
      const cleanedText = text.replace(/\\0/g, '');
      let data: CCMixterTrack[];

      try {
        data = JSON.parse(cleanedText);
      } catch {
        errors.push(`JSON parse error on page ${page + 1}`);
        break;
      }

      if (!Array.isArray(data) || data.length === 0) break;

      for (const t of data) {
        if (!t.files || t.files.length === 0) continue;

        const audioFile =
          t.files.find(
            f =>
              f.download_url &&
              (f.file_format_info?.default_ext === 'mp3' ||
                f.download_url.toLowerCase().endsWith('.mp3'))
          ) || t.files.find(f => f.download_url);

        if (!audioFile?.download_url) continue;

        const duration = audioFile.file_format_info?.ps
          ? Math.round(audioFile.file_format_info.ps)
          : 0;

        const artist = t.user_real_name || t.user_name || 'Unknown Artist';
        const genre = extractCCMixterGenre(t.upload_tags);

        tracks.push(
          sanitizeTrack({
            id: `ccmixter-${t.upload_id}`,
            title: t.upload_name || 'Untitled',
            artist,
            album: 'ccMixter Remixes',
            duration,
            artwork: '',
            audioUrl: audioFile.download_url.replace(/ /g, '%20'),
            genre,
            license: t.license_url || 'Creative Commons',
          })
        );
      }

      if (data.length < PAGE_SIZE) break;
      await sleep(1000);
    } catch (err) {
      errors.push(`Page ${page + 1} error: ${(err as Error).message}`);
    }
  }

  log(SOURCE, `Fetched ${tracks.length} tracks with ${errors.length} errors`);
  return { sourceName: SOURCE, tracks, errors };
}

function extractCCMixterGenre(tags?: string): string {
  if (!tags) return 'Remix';
  const tagList = tags.split(',').map(t => t.trim().toLowerCase());
  const genreMap: Record<string, string> = {
    hip_hop: 'Hip Hop',
    electronic: 'Electronic',
    ambient: 'Ambient',
    rock: 'Rock',
    jazz: 'Jazz',
    classical: 'Classical',
    folk: 'Folk',
    pop: 'Pop',
    experimental: 'Experimental',
    chillout: 'Chillout',
  };
  for (const tag of tagList) {
    for (const [key, value] of Object.entries(genreMap)) {
      if (tag.includes(key)) return value;
    }
  }
  return 'Remix';
}
