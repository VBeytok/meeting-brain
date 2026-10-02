// `attachment` with the file's name, per RFC 6266: an ASCII `filename` for old
// clients and a UTF-8 `filename*` for the real name ("Нарада.mp3").
export function attachmentDisposition(fileName: string): string {
  const fallback = fileName
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/["\\]/g, '')
    .trim();
  const ascii = fallback === '' || fallback.startsWith('.') ? `download${fallback}` : fallback;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}

// encodeURIComponent leaves ' ( ) * unescaped, which RFC 5987 does not allow.
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
