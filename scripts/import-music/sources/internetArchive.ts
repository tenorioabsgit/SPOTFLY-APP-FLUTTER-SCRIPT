import { TrackRecord, SourceResult } from '../types';
import { sanitizeTrack, sleep, log } from '../utils';

const SOURCE = 'internet-archive';
const SEARCH_URL = 'https://archive.org/advancedsearch.php';
const METADATA_URL = 'https://archive.org/metadata';
const DOWNLOAD_URL = 'https://archive.org/download';
const SEARCH_ROWS = 50;
const MAX_ITEMS = 30;

const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.flac'];

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

export async function fetchInternetArchive(): Promise<SourceResult> {
  const tracks: TrackRecord[] = [];
  const errors: string[] = [];

  try {
    const searchParams = new URLSearchParams({
      q: 'mediatype:audio AND licenseurl:*creativecommons* AND format:mp3',
      output: 'json',
      rows: String(SEARCH_ROWS),
      sort: 'addeddate desc',
      'fl[]': 'identifier,title,creator,subject,licenseurl',
    });

    log(SOURCE, 'Searching for audio items...');
    const searchRes = await fetch(`${SEARCH_URL}?${searchParams}`);

    if (!searchRes.ok) {
      errors.push(`Search HTTP ${searchRes.status}`);
      return { sourceName: SOURCE, tracks, errors };
    }

    const searchData = await searchRes.json();
    const docs: IASearchDoc[] = searchData.response?.docs || [];
    log(SOURCE, `Found ${docs.length} items, processing up to ${MAX_ITEMS}`);

    const itemsToProcess = docs.slice(0, MAX_ITEMS);

    for (const doc of itemsToProcess) {
      try {
        await sleep(500);

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
        const artist =
          meta.metadata.creator || doc.creator || 'Unknown Artist';
        const license =
          meta.metadata.licenseurl || doc.licenseurl || 'Creative Commons';
        const genre = extractGenre(doc.subject);

        for (const file of audioFiles) {
          const duration = file.length
            ? Math.round(parseFloat(file.length))
            : 0;
          const trackId = `ia-${doc.identifier}-${sanitizeFilename(file.name)}`;
          const safeId =
            trackId.length > 128 ? trackId.substring(0, 128) : trackId;

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
    errors.push(`Search error: ${(err as Error).message}`);
  }

  log(SOURCE, `Fetched ${tracks.length} tracks with ${errors.length} errors`);
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
    rock: 'Rock',
    electronic: 'Electronic',
    jazz: 'Jazz',
    classical: 'Classical',
    folk: 'Folk',
    ambient: 'Ambient',
    pop: 'Pop',
    indie: 'Indie',
    experimental: 'Experimental',
    world: 'World',
    piano: 'Piano',
  };
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [key, value] of Object.entries(genreMap)) {
      if (lower.includes(key)) return value;
    }
  }
  return 'Other';
}
