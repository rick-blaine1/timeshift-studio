import { VideoFile } from '@/types/editor';

export const sampleFiles: VideoFile[] = [
  {
    id: '1',
    name: 'beach_sunset.mp4',
    duration: 12,
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=120&fit=crop',
    resolution: '1920x1080',
    size: 24500000,
    status: 'ready',
  },
  {
    id: '2',
    name: 'city_timelapse.mp4',
    duration: 45,
    thumbnail: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=200&h=120&fit=crop',
    resolution: '1920x1080',
    size: 89000000,
    status: 'ready',
  },
  {
    id: '3',
    name: 'workshop_build.mp4',
    duration: 120,
    thumbnail: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebb6122?w=200&h=120&fit=crop',
    resolution: '1280x720',
    size: 156000000,
    status: 'ready',
  },
  {
    id: '4',
    name: 'clouds_moving.mp4',
    duration: 30,
    thumbnail: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=200&h=120&fit=crop',
    resolution: '1920x1080',
    size: 62000000,
    status: 'ready',
  },
  {
    id: '5',
    name: 'traffic_night.mp4',
    duration: 60,
    thumbnail: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200&h=120&fit=crop',
    resolution: '1920x1080',
    size: 98000000,
    status: 'ready',
  },
];

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}
