import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { extname } from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: SupabaseClient | null = null;
  private bucket = process.env.SUPABASE_BUCKET ?? 'uploads';

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.warn('[StorageService] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — uploads will fail');
      return;
    }
    this.client = createClient(url, key, { auth: { persistSession: false } });
  }

  async upload(
    file: Express.Multer.File,
    folder: string,
    namePrefix?: string,
  ): Promise<{ url: string; path: string }> {
    if (!this.client) {
      throw new InternalServerErrorException('Storage not configured');
    }
    if (!file?.buffer) {
      throw new InternalServerErrorException('File buffer missing — ensure memoryStorage is used');
    }

    const ext = extname(file.originalname) || '';
    const safeName = `${namePrefix ? namePrefix + '-' : ''}${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${ext}`;
    const path = `${folder.replace(/^\/+|\/+$/g, '')}/${safeName}`;

    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      throw new InternalServerErrorException(`Upload failed: ${error.message}`);
    }

    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
  }
}
