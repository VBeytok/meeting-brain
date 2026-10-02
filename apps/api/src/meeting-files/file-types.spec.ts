import { MeetingFileKind } from '../generated/prisma/client.js';
import { classifyFile, normalizeMimeType } from './file-types.js';

describe('classifyFile', () => {
  it.each([
    ['standup.mp3', 'audio/mpeg', MeetingFileKind.RECORDING, 'audio/mpeg'],
    ['call.m4a', 'audio/x-m4a', MeetingFileKind.RECORDING, 'audio/x-m4a'],
    ['screen.MOV', 'video/quicktime', MeetingFileKind.RECORDING, 'video/quicktime'],
    ['voice.webm', 'audio/webm', MeetingFileKind.RECORDING, 'audio/webm'],
    ['notes.txt', 'text/plain', MeetingFileKind.TRANSCRIPT, 'text/plain'],
    ['captions.vtt', 'text/vtt', MeetingFileKind.TRANSCRIPT, 'text/vtt'],
  ])('accepts %s reported as %s', (name, reported, kind, mimeType) => {
    expect(classifyFile(name, reported)).toEqual({ kind, mimeType });
  });

  it('falls back to the extension when the browser reports no type', () => {
    expect(classifyFile('captions.srt', '')).toEqual({
      kind: MeetingFileKind.TRANSCRIPT,
      mimeType: 'application/x-subrip',
    });
    expect(classifyFile('meeting.mp4', 'application/octet-stream')).toEqual({
      kind: MeetingFileKind.RECORDING,
      mimeType: 'video/mp4',
    });
  });

  it('normalizes the reported type', () => {
    expect(classifyFile('notes.txt', 'Text/Plain; charset=utf-8')?.mimeType).toBe('text/plain');
  });

  it.each([
    ['slides.pdf', 'application/pdf'],
    ['README', 'text/plain'],
    ['archive.tar.gz', 'application/gzip'],
    ['.mp3', 'audio/mpeg'],
    ['song.mp3', 'video/mp4'],
    ['virus.exe.txt', 'application/x-msdownload'],
  ])('rejects %s reported as %s', (name, reported) => {
    expect(classifyFile(name, reported)).toBeNull();
  });
});

describe('normalizeMimeType', () => {
  it('handles a missing type', () => {
    expect(normalizeMimeType(undefined)).toBe('');
  });
});
