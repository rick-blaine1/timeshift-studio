import { IndexedDBStorageService } from './StorageService';

// Create singleton instance of storage service
export const storageService = new IndexedDBStorageService();

// Export types and classes
export * from './StorageService';