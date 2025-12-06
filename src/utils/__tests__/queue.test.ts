import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createQueue } from '../queue';

describe('Video Processing Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes tasks in order', async () => {
    const queue = createQueue();
    const mockTask1 = vi.fn().mockResolvedValue('result1');
    const mockTask2 = vi.fn().mockResolvedValue('result2');

    const promise1 = queue.add(mockTask1);
    const promise2 = queue.add(mockTask2);

    const results = await Promise.all([promise1, promise2]);

    expect(mockTask1).toHaveBeenCalled();
    expect(mockTask2).toHaveBeenCalled();
    expect(results).toEqual(['result1', 'result2']);
  });

  it('handles task failures', async () => {
    const queue = createQueue();
    const mockTask1 = vi.fn().mockRejectedValue(new Error('Task failed'));
    const mockTask2 = vi.fn().mockResolvedValue('result2');

    const promise1 = queue.add(mockTask1);
    const promise2 = queue.add(mockTask2);

    await expect(promise1).rejects.toThrow('Task failed');
    await expect(promise2).resolves.toBe('result2');
  });

  it('limits concurrent tasks', async () => {
    const queue = createQueue(2);
    const mockTask1 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result1'), 100)));
    const mockTask2 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result2'), 100)));
    const mockTask3 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result3'), 100)));

    const startTime = Date.now();
    const promise1 = queue.add(mockTask1);
    const promise2 = queue.add(mockTask2);
    const promise3 = queue.add(mockTask3);

    await Promise.all([promise1, promise2, promise3]);
    const duration = Date.now() - startTime;

    // Should take around 200ms because 2 tasks run concurrently
    expect(duration).toBeGreaterThanOrEqual(190);
    expect(duration).toBeLessThan(300);
  });

  it('processes tasks sequentially when concurrency is 1', async () => {
    const queue = createQueue(1);
    const mockTask1 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result1'), 100)));
    const mockTask2 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result2'), 100)));
    const mockTask3 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result3'), 100)));

    const startTime = Date.now();
    const promise1 = queue.add(mockTask1);
    const promise2 = queue.add(mockTask2);
    const promise3 = queue.add(mockTask3);

    await Promise.all([promise1, promise2, promise3]);
    const duration = Date.now() - startTime;

    // Should take around 300ms because tasks run sequentially
    expect(duration).toBeGreaterThanOrEqual(290);
    expect(duration).toBeLessThan(400);
  });

  it('returns task results in order of completion', async () => {
    const queue = createQueue();
    const mockTask1 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result1'), 200)));
    const mockTask2 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result2'), 100)));

    const promise1 = queue.add(mockTask1);
    const promise2 = queue.add(mockTask2);

    const results = await Promise.all([promise1, promise2]);
    expect(results).toEqual(['result1', 'result2']);
  });

  it('handles task cancellation', async () => {
    const queue = createQueue();
    const mockTask1 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result1'), 200)));
    const mockTask2 = vi.fn(() => new Promise(resolve => setTimeout(() => resolve('result2'), 100)));

    const promise1 = queue.add(mockTask1);
    const promise2 = queue.add(mockTask2);

    // Cancel the first task
    queue.cancel(promise1);

    await expect(promise1).rejects.toThrow('Task cancelled');
    await expect(promise2).resolves.toBe('result2');
  });
});