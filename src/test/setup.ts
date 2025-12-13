import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';


// Mock IndexedDB for Vitest environment
if (typeof window !== 'undefined') {
  if (!window.indexedDB) {
    const createMockIDBRequest = () => {
      const request: IDBRequest = {
        result: undefined,
        error: null,
        source: null,
        transaction: null,
        readyState: 'done',
        onsuccess: null,
        onerror: null,
        _listeners: {},
        addEventListener(type, listener) {
          if (!this._listeners[type]) {
            this._listeners[type] = [];
          }
          this._listeners[type].push(listener);
        },
        removeEventListener(type, listener) {
          if (this._listeners[type]) {
            this._listeners[type] = this._listeners[type].filter((l: any) => l !== listener);
          }
        },
        dispatchEvent(event) {
          if (this._listeners[event.type]) {
            this._listeners[event.type].forEach((listener: any) => listener.call(this, event));
          }
          return true;
        },
      } as unknown as IDBRequest;

      // Simulate asynchronous success
      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess.call(request, { target: { result: {} } } as any);
        }
        (request as any).dispatchEvent({ type: 'success', target: { result: {} } });
      }, 0);
      return request;
    };

    const createMockIDBOpenDBRequest = () => {
      const request = createMockIDBRequest() as IDBOpenDBRequest;
      request.onupgradeneeded = null;
      request.onblocked = null;
      return request;
    };

    window.indexedDB = {
      open: vi.fn(createMockIDBOpenDBRequest) as any,
      deleteDatabase: vi.fn(createMockIDBOpenDBRequest) as any,
      cmp: vi.fn((a, b) => (a < b ? -1 : a > b ? 1 : 0)) as any,
      databases: vi.fn().mockResolvedValue([]),
    };
  }

  // Mock OffscreenCanvas
  if (!window.OffscreenCanvas) {
    window.OffscreenCanvas = vi.fn(() => ({
      getContext: vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: [] })),
        toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
      })),
      convertToBlob: vi.fn().mockResolvedValue(new Blob()),
    })) as any;
  }
}