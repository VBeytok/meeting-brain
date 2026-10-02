import { parseSrt, parseTranscript, parseTxt, parseVtt } from './parse-transcript.js';
import { TranscriptParseError } from './transcript.js';

describe('parseVtt', () => {
  it('reads cues with and without hours, ids and settings', () => {
    const vtt = [
      'WEBVTT',
      '',
      'intro',
      '00:00:01.000 --> 00:00:03.500 align:start',
      'Welcome, everyone.',
      '',
      '00:04.250 --> 00:06.000',
      "Let's start.",
    ].join('\n');
    expect(parseVtt(vtt)).toEqual({
      language: null,
      segments: [
        { start: 1, end: 3.5, text: 'Welcome, everyone.' },
        { start: 4.25, end: 6, text: "Let's start." },
      ],
    });
  });

  it('joins a multi-line cue and takes the speaker from <v>', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      '<v Alice>First line',
      'second line</v>',
    ].join('\n');
    expect(parseVtt(vtt).segments).toEqual([
      { start: 1, end: 4, speaker: 'Alice', text: 'First line second line' },
    ]);
  });

  it('splits a cue where the speaker changes, keeping its timing', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      '<v.loud Alice Smith>Ready?',
      '<v Bob>Yes.',
    ].join('\n');
    expect(parseVtt(vtt).segments).toEqual([
      { start: 1, end: 4, speaker: 'Alice Smith', text: 'Ready?' },
      { start: 1, end: 4, speaker: 'Bob', text: 'Yes.' },
    ]);
  });

  it('strips markup, decodes entities and reads a Language header', () => {
    const vtt = [
      'WEBVTT - Weekly sync',
      'Language: uk',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '<b>Q&amp;A</b> <c.yellow>at</c> <00:00:01.500>five &lt;ish&gt;',
    ].join('\n');
    expect(parseVtt(vtt)).toEqual({
      language: 'uk',
      segments: [{ start: 1, end: 2, text: 'Q&A at five <ish>' }],
    });
  });

  it('handles a BOM and CRLF line ends', () => {
    const vtt = '\uFEFFWEBVTT\r\n\r\n00:00:01.000 --> 00:00:02.000\r\nHello\r\n';
    expect(parseTranscript('a.vtt', vtt).segments).toEqual([{ start: 1, end: 2, text: 'Hello' }]);
  });

  it('skips NOTE, STYLE and REGION blocks and empty cues', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE written by hand',
      '',
      'STYLE',
      '::cue { color: red }',
      '',
      '00:00:01.000 --> 00:00:02.000',
      '',
      '00:00:02.000 --> 00:00:03.000',
      '<i></i>',
      '',
      '00:00:03.000 --> 00:00:04.000',
      'Kept',
    ].join('\n');
    expect(parseVtt(vtt).segments).toEqual([{ start: 3, end: 4, text: 'Kept' }]);
  });

  it('reads a cue with no blank line after the header', () => {
    expect(parseVtt('WEBVTT\n00:00:01.000 --> 00:00:02.000\nHi').segments).toEqual([
      { start: 1, end: 2, text: 'Hi' },
    ]);
  });

  it.each([
    ['a missing header', '00:00:01.000 --> 00:00:02.000\nHello'],
    ['no cues', 'WEBVTT\n\nNOTE nothing here'],
    ['a broken timing', 'WEBVTT\n\n00:00:01 --> soon\nHello'],
  ])('rejects %s', (_case, vtt) => {
    expect(() => parseVtt(vtt)).toThrow(TranscriptParseError);
  });
});

describe('parseSrt', () => {
  it('reads numbered blocks with comma timestamps and multi-line text', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:02,500',
      '<i>Good morning.</i>',
      '',
      '2',
      '00:00:03,000 --> 00:00:05,000',
      '{\\an8}Two lines',
      'of text',
      '',
    ].join('\n');
    expect(parseSrt(srt)).toEqual({
      language: null,
      segments: [
        { start: 1, end: 2.5, text: 'Good morning.' },
        { start: 3, end: 5, text: 'Two lines of text' },
      ],
    });
  });

  it('accepts blocks without a counter, extra blank lines and CRLF', () => {
    const srt =
      '\uFEFF00:00:01,000 --> 00:00:02,000\r\nOne\r\n\r\n\r\n\r\n00:00:02,000 --> 00:00:03,000\r\nTwo\r\n';
    expect(parseTranscript('captions.srt', srt).segments).toEqual([
      { start: 1, end: 2, text: 'One' },
      { start: 2, end: 3, text: 'Two' },
    ]);
  });

  it('skips a block with no text', () => {
    expect(
      parseSrt('1\n00:00:01,000 --> 00:00:02,000\n\n2\n00:00:02,000 --> 00:00:03,000\nKept')
        .segments,
    ).toEqual([{ start: 2, end: 3, text: 'Kept' }]);
  });

  it.each([
    ['prose', 'Just some notes\nwithout timing'],
    ['a broken timing', '1\n00:00:01,000 --> later\nHello'],
    ['blocks without text', '1\n00:00:01,000 --> 00:00:02,000'],
  ])('rejects %s', (_case, srt) => {
    expect(() => parseSrt(srt)).toThrow(TranscriptParseError);
  });
});

describe('parseTxt', () => {
  it('keeps the text, line breaks included, as one segment', () => {
    expect(parseTranscript('notes.txt', '\uFEFF  Alice: hi\r\nBob: hello\n\n')).toEqual({
      language: null,
      segments: [{ text: 'Alice: hi\nBob: hello' }],
    });
    expect(parseTxt('x')).toEqual({ language: null, segments: [{ text: 'x' }] });
  });
});

describe('parseTranscript', () => {
  it.each(['', '   \n\r\n', '\uFEFF'])('rejects an empty file (%j)', (text) => {
    expect(() => parseTranscript('a.txt', text)).toThrow('The file has no text.');
  });

  it('rejects an extension it cannot parse', () => {
    expect(() => parseTranscript('a.mp3', 'x')).toThrow(TranscriptParseError);
  });
});
