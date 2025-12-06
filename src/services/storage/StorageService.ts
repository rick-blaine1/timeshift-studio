import { ProjectSchema } from '@/types/schema/Project';
import { VideoFileSchema } from '@/types/schema/VideoFile';

export interface StorageService {
  // Project operations
  saveProject(project: ProjectSchema): Promise<void>;
  loadProject(projectId: string): Promise<ProjectSchema>;
  deleteProject(projectId: string): Promise<void>;
  listProjects(): Promise<ProjectSchema[]>;
  
  // File operations
  saveVideoFile(file: VideoFileSchema, blob: Blob): Promise<void>;
  loadVideoFile(fileId: string): Promise<Blob>;
  deleteVideoFile(fileId: string): Promise<void>;
  
  // Cache operations
  saveThumbnail(fileId: string, thumbnail: string): Promise<void>;
  loadThumbnail(fileId: string): Promise<string>;
  clearCache(): Promise<void>;
}

// IndexedDB implementation
export class IndexedDBStorageService implements StorageService {
  private db: IDBDatabase;
  private readonly DB_NAME = 'TimeLapseEditor';
  private readonly DB_VERSION = 1;
  
  constructor() {
    this.initDb();
  }

  private initDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('videoFiles')) {
          db.createObjectStore('videoFiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'fileId' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        reject(`IndexedDB error: ${(event.target as IDBOpenDBRequest).error}`);
      };
    });
  }

  private getObjectStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return new Promise(async (resolve, reject) => {
      if (!this.db) {
        await this.initDb();
      }
      const transaction = this.db.transaction(storeName, mode);
      transaction.onerror = (event) => reject(`Transaction error: ${transaction.error || (event.target as IDBRequest).error}`);
      transaction.onabort = (event) => reject(`Transaction aborted: ${transaction.error || (event.target as IDBRequest).error}`);
      resolve(transaction.objectStore(storeName));
    });
  }

  async saveProject(project: ProjectSchema): Promise<void> {
    const store = await this.getObjectStore('projects', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(project);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Error saving project: ${(event.target as IDBRequest).error}`);
    });
  }

  async loadProject(projectId: string): Promise<ProjectSchema> {
    const store = await this.getObjectStore('projects', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          reject(`Project with ID ${projectId} not found.`);
        }
      };
      request.onerror = (event) => reject(`Error loading project: ${(event.target as IDBRequest).error}`);
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    const store = await this.getObjectStore('projects', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(projectId);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Error deleting project: ${(event.target as IDBRequest).error}`);
    });
  }

  async listProjects(): Promise<ProjectSchema[]> {
    const store = await this.getObjectStore('projects', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(`Error listing projects: ${(event.target as IDBRequest).error}`);
    });
  }

  async saveVideoFile(file: VideoFileSchema, blob: Blob): Promise<void> {
    const fileStore = await this.getObjectStore('videoFiles', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = fileStore.put({ ...file, data: blob }); // Store blob along with metadata
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Error saving video file: ${(event.target as IDBRequest).error}`);
    });
  }

  async loadVideoFile(fileId: string): Promise<Blob> {
    const fileStore = await this.getObjectStore('videoFiles', 'readonly');
    return new Promise((resolve, reject) => {
      const request = fileStore.get(fileId);
      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve(request.result.data);
        } else {
          reject(`Video file with ID ${fileId} not found.`);
        }
      };
      request.onerror = (event) => reject(`Error loading video file: ${(event.target as IDBRequest).error}`);
    });
  }

  async deleteVideoFile(fileId: string): Promise<void> {
    const fileStore = await this.getObjectStore('videoFiles', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = fileStore.delete(fileId);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Error deleting video file: ${(event.target as IDBRequest).error}`);
    });
  }

  async saveThumbnail(fileId: string, thumbnail: string): Promise<void> {
    const store = await this.getObjectStore('thumbnails', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ fileId, thumbnail });
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(`Error saving thumbnail: ${(event.target as IDBRequest).error}`);
    });
  }

  async loadThumbnail(fileId: string): Promise<string> {
    const store = await this.getObjectStore('thumbnails', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(fileId);
      request.onsuccess = () => {
        if (request.result && request.result.thumbnail) {
          resolve(request.result.thumbnail);
        } else {
          reject(`Thumbnail for file ID ${fileId} not found.`);
        }
      };
      request.onerror = (event) => reject(`Error loading thumbnail: ${(event.target as IDBRequest).error}`);
    });
  }

  async clearCache(): Promise<void> {
    const projectStore = await this.getObjectStore('projects', 'readwrite');
    const videoFilesStore = await this.getObjectStore('videoFiles', 'readwrite');
    const thumbnailsStore = await this.getObjectStore('thumbnails', 'readwrite');
    
    return new Promise((resolve, reject) => {
      const clearProjectRequest = projectStore.clear();
      const clearVideoFilesRequest = videoFilesStore.clear();
      const clearThumbnailsRequest = thumbnailsStore.clear();

      clearProjectRequest.onsuccess = clearVideoFilesRequest.onsuccess = clearThumbnailsRequest.onsuccess = () => resolve();
      clearProjectRequest.onerror = clearVideoFilesRequest.onerror = clearThumbnailsRequest.onerror = (event) => reject(`Error clearing cache: ${(event.target as IDBRequest).error}`);
    });
  }
}