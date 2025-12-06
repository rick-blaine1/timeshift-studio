import { VideoFileSchema, VideoFileStatus } from '@/types/schema/VideoFile';

export const sampleFiles: VideoFileSchema[] = [
  {
    id: '1',
    name: 'beach_sunset.mp4',
    duration: 12,
    width: 1920,
    height: 1080,
    framerate: 30,
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&h=120&fit=crop',
    thumbnailTimestamp: 0,
    size: 24500000,
    type: 'video/mp4',
    lastModified: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: VideoFileStatus.READY,
  },
  {
    id: '2',
    name: 'city_timelapse.mp4',
    duration: 45,
    width: 1920,
    height: 1080,
    framerate: 30,
    thumbnail: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=200&h=120&fit=crop',
    thumbnailTimestamp: 0,
    size: 89000000,
    type: 'video/mp4',
    lastModified: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: VideoFileStatus.READY,
  },
  {
    id: '3',
    name: 'workshop_build.mp4',
    duration: 120,
    width: 1280,
    height: 720,
    framerate: 30,
    thumbnail: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebb6122?w=200&h=120&fit=crop',
    thumbnailTimestamp: 0,
    size: 156000000,
    type: 'video/mp4',
    lastModified: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: VideoFileStatus.READY,
  },
  {
    id: '4',
    name: 'clouds_moving.mp4',
    duration: 30,
    width: 1920,
    height: 1080,
    framerate: 30,
    thumbnail: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=200&h=120&fit=crop',
    thumbnailTimestamp: 0,
    size: 62000000,
    type: 'video/mp4',
    lastModified: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: VideoFileStatus.READY,
  },
  {
    id: '5',
    name: 'traffic_night.mp4',
    duration: 60,
    width: 1920,
    height: 1080,
    framerate: 30,
    thumbnail: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200&h=120&fit=crop',
    thumbnailTimestamp: 0,
    size: 98000000,
    type: 'video/mp4',
    lastModified: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: VideoFileStatus.READY,
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
