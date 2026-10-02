import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageEnv } from '../config/storage-env.js';
import { attachmentDisposition } from './content-disposition.js';
import { FileStorage, type StoredObject } from './file-storage.js';

@Injectable()
export class S3FileStorage extends FileStorage implements OnModuleDestroy {
  private readonly bucket: string;
  // Talks to storage from the API.
  private readonly client: S3Client;
  // Only signs URLs. A presigned URL is bound to the host it was signed for,
  // so browser-facing URLs are signed for the public endpoint.
  private readonly publicClient: S3Client;

  constructor(config: ConfigService<StorageEnv, true>) {
    super();
    this.bucket = config.get('S3_BUCKET', { infer: true });
    const options = {
      region: config.get('S3_REGION', { infer: true }),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
    };
    this.client = new S3Client({
      ...options,
      endpoint: config.get('S3_ENDPOINT', { infer: true }),
    });
    this.publicClient = new S3Client({
      ...options,
      endpoint: config.get('S3_PUBLIC_ENDPOINT', { infer: true }),
    });
  }

  presignUpload(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    // The presigner signs only `host` unless told otherwise, and would then drop
    // the type: any Content-Type would be accepted and stored.
    return getSignedUrl(this.publicClient, command, {
      expiresIn: expiresInSeconds,
      signableHeaders: new Set(['content-type']),
    });
  }

  presignDownload(
    key: string,
    options: { contentType: string; expiresInSeconds: number; downloadAs?: string },
  ): Promise<string> {
    // Storage sends these response headers as given in the signed URL.
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: options.contentType,
      ResponseContentDisposition:
        options.downloadAs === undefined ? undefined : attachmentDisposition(options.downloadAs),
    });
    return getSignedUrl(this.publicClient, command, { expiresIn: options.expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    // S3 answers 204 for a missing key too.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const object = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: object.ContentLength ?? 0, contentType: object.ContentType };
    } catch (error) {
      if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
    this.publicClient.destroy();
  }
}
