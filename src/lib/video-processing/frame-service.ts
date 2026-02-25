import ffmpeg from 'fluent-ffmpeg';
import { VideoFrame, KeyMoment } from '@/types/video-processing';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const FRAMES_DIR = path.join(UPLOAD_DIR, 'frames');

export interface FrameCaptureOptions {
  interval?: number;
  width?: number;
  height?: number;
  quality?: number;
}

export class FrameCaptureService {
  async captureFrames(
    videoPath: string,
    fileId: string,
    options: FrameCaptureOptions = {}
  ): Promise<VideoFrame[]> {
    const {
      interval = 5,
      width = 1280,
      height = 720,
      quality = 80,
    } = options;

    const framesDir = path.join(FRAMES_DIR, fileId);
    await fs.mkdir(framesDir, { recursive: true });

    const duration = await this.getVideoDuration(videoPath);
    const frames: VideoFrame[] = [];
    const timestamps: number[] = [];

    for (let time = 0; time <= duration; time += interval) {
      timestamps.push(time);
    }

    await Promise.all(
      timestamps.map(async (timestamp, index) => {
        const frameId = `frame-${index}`;
        const outputPath = path.join(framesDir, `frame-${index}.jpg`);
        
        await this.extractFrame(videoPath, timestamp, outputPath, {
          width,
          height,
          quality,
        });

        const frame: VideoFrame = {
          id: frameId,
          fileId,
          timestamp,
          imageUrl: `/api/frames/${fileId}/frame-${index}.jpg`,
        };

        frames.push(frame);
      })
    );

    return frames.sort((a, b) => a.timestamp - b.timestamp);
  }

  private extractFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string,
    options: { width: number; height: number; quality: number }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamp)
        .frames(1)
        .outputOptions([
          `-vf scale=${options.width}:${options.height}`,
          `-q:v ${Math.round((100 - options.quality) / 10)}`,
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  private getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(metadata.format.duration || 0);
      });
    });
  }

  async extractAudio(videoPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  detectKeyMoments(frames: VideoFrame[]): KeyMoment[] {
    const keyMoments: KeyMoment[] = [];

    frames.forEach((frame, index) => {
      if (index % 6 === 0) {
        keyMoments.push({
          timestamp: frame.timestamp,
          description: `프레임 캡처 - ${this.formatTimestamp(frame.timestamp)}`,
          type: 'visual',
          frameIds: [frame.id],
        });
      }
    });

    return keyMoments;
  }

  private formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

export const frameCaptureService = new FrameCaptureService();
