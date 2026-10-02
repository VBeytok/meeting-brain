// Mirrors the API's allow-list (apps/api/src/meeting-files/file-types.ts), so
// a file is refused before anything is uploaded. The API checks again.

export type MeetingFileKind = 'RECORDING' | 'TRANSCRIPT';

export const MAX_FILE_SIZE = 1024 ** 3; // 1 GB
export const MAX_FILES_PER_MEETING = 10;

const FILE_TYPES: Record<string, { kind: MeetingFileKind; mimeType: string; aliases: string[] }> = {
  mp3: { kind: 'RECORDING', mimeType: 'audio/mpeg', aliases: ['audio/mpeg', 'audio/mp3'] },
  m4a: {
    kind: 'RECORDING',
    mimeType: 'audio/mp4',
    aliases: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  },
  wav: {
    kind: 'RECORDING',
    mimeType: 'audio/wav',
    aliases: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
  },
  ogg: { kind: 'RECORDING', mimeType: 'audio/ogg', aliases: ['audio/ogg', 'application/ogg'] },
  webm: { kind: 'RECORDING', mimeType: 'video/webm', aliases: ['video/webm', 'audio/webm'] },
  mp4: { kind: 'RECORDING', mimeType: 'video/mp4', aliases: ['video/mp4'] },
  mov: { kind: 'RECORDING', mimeType: 'video/quicktime', aliases: ['video/quicktime'] },
  txt: { kind: 'TRANSCRIPT', mimeType: 'text/plain', aliases: ['text/plain'] },
  vtt: { kind: 'TRANSCRIPT', mimeType: 'text/vtt', aliases: ['text/vtt'] },
  srt: {
    kind: 'TRANSCRIPT',
    mimeType: 'application/x-subrip',
    aliases: ['application/x-subrip', 'text/srt', 'application/srt', 'text/plain'],
  },
};

// For <input accept>: ".mp3,.m4a,...".
export const ACCEPT = Object.keys(FILE_TYPES)
  .map((extension) => `.${extension}`)
  .join(',');

export const ALLOWED_LIST = 'MP3, M4A, WAV, OGG, WebM, MP4, MOV, TXT, VTT or SRT';

// The kind of an acceptable file, or why it is refused.
export function checkFile(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true; kind: MeetingFileKind } | { ok: false; error: string } {
  const extension = /[^/\\]\.([^./\\]+)$/.exec(file.name)?.[1]?.toLowerCase();
  const type = extension === undefined ? undefined : FILE_TYPES[extension];
  const reported = file.type.split(';')[0].trim().toLowerCase();
  if (
    !type ||
    (reported !== '' && reported !== 'application/octet-stream' && !type.aliases.includes(reported))
  ) {
    return { ok: false, error: `This type of file can't be added. Use ${ALLOWED_LIST}.` };
  }
  if (file.size === 0) {
    return { ok: false, error: 'This file is empty.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: 'This file is larger than 1 GB.' };
  }
  return { ok: true, kind: type.kind };
}

const sizeFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

// 1536 → "1.5 KB". Binary units, labelled the way people expect.
export function formatBytes(bytes: number): string {
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${sizeFormat.format(value)} ${units[unit]}`;
}

export function kindLabel(kind: MeetingFileKind): string {
  return kind === 'RECORDING' ? 'Recording' : 'Transcript';
}
