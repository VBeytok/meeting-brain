import { MeetingFileKind } from '../generated/prisma/client.js';

export const MAX_FILE_SIZE = 1024 ** 3; // 1 GB
export const MAX_FILES_PER_MEETING = 10;

type FileType = {
  kind: MeetingFileKind;
  // Stored when the browser reports nothing usable.
  mimeType: string;
  // What browsers and OSes report for the extension; any of these is kept as is.
  aliases: readonly string[];
};

const RECORDING = MeetingFileKind.RECORDING;
const TRANSCRIPT = MeetingFileKind.TRANSCRIPT;

// Keyed by extension. Browsers report different types for the same file (or
// none, e.g. .srt), so the extension decides the kind and the reported type
// only has to be a plausible match. The web app keeps a copy of this list.
const FILE_TYPES: Record<string, FileType> = {
  mp3: { kind: RECORDING, mimeType: 'audio/mpeg', aliases: ['audio/mpeg', 'audio/mp3'] },
  m4a: {
    kind: RECORDING,
    mimeType: 'audio/mp4',
    aliases: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  },
  wav: {
    kind: RECORDING,
    mimeType: 'audio/wav',
    aliases: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
  },
  ogg: { kind: RECORDING, mimeType: 'audio/ogg', aliases: ['audio/ogg', 'application/ogg'] },
  webm: { kind: RECORDING, mimeType: 'video/webm', aliases: ['video/webm', 'audio/webm'] },
  mp4: { kind: RECORDING, mimeType: 'video/mp4', aliases: ['video/mp4'] },
  mov: { kind: RECORDING, mimeType: 'video/quicktime', aliases: ['video/quicktime'] },
  txt: { kind: TRANSCRIPT, mimeType: 'text/plain', aliases: ['text/plain'] },
  vtt: { kind: TRANSCRIPT, mimeType: 'text/vtt', aliases: ['text/vtt'] },
  srt: {
    kind: TRANSCRIPT,
    mimeType: 'application/x-subrip',
    aliases: ['application/x-subrip', 'text/srt', 'application/srt', 'text/plain'],
  },
};

export const ALLOWED_EXTENSIONS = Object.keys(FILE_TYPES);

export type ClassifiedFile = { kind: MeetingFileKind; mimeType: string };

// The kind and the type to store for an upload, or null when the file is not
// one we accept. `reportedType` is the browser's File.type, often empty.
export function classifyFile(name: string, reportedType: string): ClassifiedFile | null {
  const extension = /[^/\\]\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase();
  const type = extension === undefined ? undefined : FILE_TYPES[extension];
  if (!type) return null;

  const reported = normalizeMimeType(reportedType);
  if (reported === '' || reported === 'application/octet-stream') {
    return { kind: type.kind, mimeType: type.mimeType };
  }
  return type.aliases.includes(reported) ? { kind: type.kind, mimeType: reported } : null;
}

// "Audio/MPEG; charset=x" → "audio/mpeg".
export function normalizeMimeType(value: string | undefined): string {
  return (value ?? '').split(';')[0].trim().toLowerCase();
}
