import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export const STORAGE_DIRECTORIES = ['products', 'categories', 'departments', 'sections', 'banners', 'brands'] as const;
export type StorageDirectory = (typeof STORAGE_DIRECTORIES)[number];

export interface UploadedMedia {
  success: true;
  data: {
    url: string;
    key: string;
  };
}

@Injectable()
export class StorageService {
  private client?: S3Client;
  private bucket?: string;
  private publicUrl?: string;

  constructor(private readonly config: ConfigService) {}

  async upload(file: Express.Multer.File, directory: StorageDirectory): Promise<UploadedMedia> {
    const client = this.ensureConfigured();
    if (!file?.buffer?.length) throw new BadRequestException('Uploaded file is empty');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('Image exceeds the 10 MB limit');

    const metadata = await sharp(file.buffer).metadata();
    const format = metadata.format;
    if (!['jpeg', 'png', 'webp'].includes(format ?? '') || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only JPEG, PNG and WEBP images are allowed');
    }
    if (format === 'jpeg' && file.mimetype !== 'image/jpeg') throw new BadRequestException('Invalid JPEG file');
    if (format === 'png' && file.mimetype !== 'image/png') throw new BadRequestException('Invalid PNG file');
    if (format === 'webp' && file.mimetype !== 'image/webp') throw new BadRequestException('Invalid WEBP file');

    let pipeline = sharp(file.buffer, { failOn: 'error' }).rotate().resize({
      width: 2400,
      height: 2400,
      fit: 'inside',
      withoutEnlargement: true,
    });
    let extension = format === 'jpeg' ? 'jpg' : format!;
    let contentType = `image/${format === 'jpeg' ? 'jpeg' : format}`;
    if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
    if (format === 'png') pipeline = pipeline.png({ compressionLevel: 8, adaptiveFiltering: true });
    if (format === 'webp') pipeline = pipeline.webp({ quality: 82 });

    const body = await pipeline.toBuffer();
    const key = `${directory}/${randomUUID()}.${extension}`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: this.bucket!,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
    } catch {
      throw new InternalServerErrorException('Failed to upload image to Cloudflare R2');
    }
    return { success: true, data: { url: `${this.publicUrl}/${key}`, key } };
  }

  async delete(key: string): Promise<{ success: true }> {
    const client = this.ensureConfigured();
    this.assertKey(key);
    try {
      await client.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: key }));
    } catch {
      throw new InternalServerErrorException('Failed to delete image from Cloudflare R2');
    }
    return { success: true };
  }

  async list(directory?: string, cursor?: string, limit = 50) {
    const client = this.ensureConfigured();
    if (directory && !STORAGE_DIRECTORIES.includes(directory as StorageDirectory)) {
      throw new BadRequestException('Invalid storage directory');
    }
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const prefix = directory ? `${directory}/` : undefined;
    const result = await client.send(new ListObjectsV2Command({
      Bucket: this.bucket!,
      Prefix: prefix,
      ContinuationToken: cursor,
      MaxKeys: safeLimit,
    }));
    return {
      items: (result.Contents ?? []).map((item) => ({
        key: item.Key,
        url: `${this.publicUrl}/${item.Key}`,
        size: item.Size,
        updatedAt: item.LastModified,
      })),
      nextCursor: result.IsTruncated ? result.NextContinuationToken : undefined,
    };
  }

  async getPresignedUploadUrl(directory: StorageDirectory, contentType: string) {
    const client = this.ensureConfigured();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      throw new BadRequestException('Only JPEG, PNG and WEBP images are allowed');
    }
    const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
    const key = `${directory}/${randomUUID()}.${extension}`;
    const url = await getSignedUrl(client, new PutObjectCommand({
      Bucket: this.bucket!,
      Key: key,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }), { expiresIn: 300 });
    return { success: true, data: { url, publicUrl: `${this.publicUrl}/${key}`, key } };
  }

  assertKey(key: string): void {
    if (!/^\/?(products|categories|banners|brands)\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(key)) {
      throw new BadRequestException('Invalid object key');
    }
  }

  private required(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) throw new BadRequestException(`Cloudflare R2 is not configured: missing ${name}`);
    return value;
  }

  private ensureConfigured(): S3Client {
    if (this.client) return this.client;
    const accountId = this.required('R2_ACCOUNT_ID');
    const accessKeyId = this.required('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.required('R2_SECRET_ACCESS_KEY');
    this.bucket = this.required('R2_BUCKET_NAME');
    this.publicUrl = this.required('R2_PUBLIC_URL').replace(/\/$/, '');
    const endpoint = this.config.get<string>('R2_ENDPOINT')?.trim() || `https://${accountId}.r2.cloudflarestorage.com`;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    return this.client;
  }
}
