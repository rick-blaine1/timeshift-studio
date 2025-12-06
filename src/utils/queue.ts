type Task<T> = () => Promise<T>;

interface QueueTask<T> {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

export function createQueue(concurrency: number = 1) {
  const queue: QueueTask<any>[] = [];
  let running = 0;

  const run = async () => {
    if (running >= concurrency || queue.length === 0) {
      return;
    }

    running++;
    const { task, resolve, reject } = queue.shift()!;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      running--;
      run();
    }
  };

  const add = <T>(task: Task<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      run();
    });
  };

  const cancel = <T>(promise: Promise<T>) => {
    const index = queue.findIndex(item => item.resolve === (promise as any).resolve);
    if (index !== -1) {
      const [task] = queue.splice(index, 1);
      task.reject(new Error('Task cancelled'));
    }
  };

  return {
    add,
    cancel,
  };
}