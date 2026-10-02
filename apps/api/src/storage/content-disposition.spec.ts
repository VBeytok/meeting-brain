import { attachmentDisposition } from './content-disposition.js';

describe('attachmentDisposition', () => {
  it('keeps an ASCII name in both parameters', () => {
    expect(attachmentDisposition('standup.mp3')).toBe(
      `attachment; filename="standup.mp3"; filename*=UTF-8''standup.mp3`,
    );
  });

  it('encodes a non-ASCII name and drops what ASCII cannot hold', () => {
    expect(attachmentDisposition('Нарада café.mp3')).toBe(
      `attachment; filename="cafe.mp3"; filename*=UTF-8''%D0%9D%D0%B0%D1%80%D0%B0%D0%B4%D0%B0%20caf%C3%A9.mp3`,
    );
  });

  it('gives a name that is all non-ASCII a fallback', () => {
    expect(attachmentDisposition('Нарада.mp3')).toBe(
      `attachment; filename="download.mp3"; filename*=UTF-8''%D0%9D%D0%B0%D1%80%D0%B0%D0%B4%D0%B0.mp3`,
    );
  });

  it('cannot be broken out of with quotes or backslashes', () => {
    const header = attachmentDisposition(`a"; filename=evil.exe\\.mp3`);
    expect(header).toMatch(
      /^attachment; filename="a; filename=evil\.exe\.mp3"; filename\*=UTF-8''/,
    );
    expect(header).not.toMatch(/filename\*=UTF-8''[^;]*["\\ ]/);
  });

  it("escapes the characters encodeURIComponent leaves: ' ( ) *", () => {
    expect(attachmentDisposition("it's (final)*.txt")).toContain(
      "filename*=UTF-8''it%27s%20%28final%29%2A.txt",
    );
  });
});
