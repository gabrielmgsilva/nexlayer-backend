export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimetype: string;
  originalName: string;
}

export interface IStorageService {
  /**
   * Upload a file to the storage provider.
   * @param file  - Multer file in memory buffer
   * @param folder - Logical path prefix, e.g. "products/photos"
   */
  upload(file: Express.Multer.File, folder: string): Promise<UploadResult>;

  /**
   * Delete a file by its storage key.
   */
  delete(key: string): Promise<void>;

  /**
   * Generate a short-lived signed URL for private objects (optional use).
   */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
