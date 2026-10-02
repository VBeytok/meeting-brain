import { transcriptText } from './transcript-text.js';

describe('transcriptText', () => {
  it('writes one block per file with times and speakers when known', () => {
    const text = transcriptText([
      {
        name: 'call.mp3',
        transcript: {
          language: 'en',
          segments: [
            { start: 0, end: 2, speaker: 'Speaker A', text: 'Hi.' },
            { start: 3725, text: 'Later.' },
          ],
        },
      },
      { name: 'notes.txt', transcript: { language: null, segments: [{ text: 'Plain notes' }] } },
    ]);

    expect(text).toBe(
      '## Part 1: call.mp3\n[0:00:00] Speaker A: Hi.\n[1:02:05] Later.\n\n## Part 2: notes.txt\nPlain notes',
    );
  });
});
