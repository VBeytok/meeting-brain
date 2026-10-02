export type StoredObject = {
  size: number;
  contentType: string | undefined;
};

// Object storage for meeting files. An abstract class rather than an
// interface so it can be the injection token; S3FileStorage implements it.
export abstract class FileStorage {
  // A URL the browser PUTs the bytes to. The request must carry exactly this
  // Content-Type: it is part of the signature.
  abstract presignUpload(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string>;

  // A URL that GETs the object. With `downloadAs`, the response carries
  // `Content-Disposition: attachment` with that file name, so browsers save it.
  abstract presignDownload(
    key: string,
    options: { contentType: string; expiresInSeconds: number; downloadAs?: string },
  ): Promise<string>;

  // Size and type of a stored object, or null when there is none.
  abstract head(key: string): Promise<StoredObject | null>;

  // Removes the object. Succeeds when it is already gone.
  abstract delete(key: string): Promise<void>;
}
