import { 
  VideoProcessingResult, 
  VideoProcessingOptions,
  VideoTranscript,
  VideoFrame,
  KeyMoment,
} from '@/types/video-processing';
import { getSttProvider } from './stt-service';
import { frameCaptureService } from './frame-service';
import { promises as fs } from 'fs';
import path from 'path';
import { generateId } from '../stock-analysis/utils';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const VIDEOS_DIR = path.join(UPLOAD_DIR, 'videos');

class VideoProcessingService {
  private processingJobs = new Map<string, VideoProcessingResult>();

  async processVideo(
    fileBuffer: Buffer,
    fileName: string,
    options: VideoProcessingOptions
  ): Promise<string> {
    const fileId = generateId();
    
    await fs.mkdir(VIDEOS_DIR, { recursive: true });
    const videoPath = path.join(VIDEOS_DIR, `${fileId}.mp4`);
    await fs.writeFile(videoPath, fileBuffer);

    const result: VideoProcessingResult = {
      fileId,
      fileName,
      status: 'pending',
      progress: 0,
    };

    this.processingJobs.set(fileId, result);

    this.processAsync(fileId, videoPath, options);

    return fileId;
  }

  private async processAsync(
    fileId: string,
    videoPath: string,
    options: VideoProcessingOptions
  ): Promise<void> {
    const result = this.processingJobs.get(fileId);
    if (!result) return;

    try {
      result.status = 'processing';
      this.updateProgress(fileId, 10);

      let transcript: VideoTranscript | undefined;
      let frames: VideoFrame[] | undefined;
      let keyMoments: KeyMoment[] = [];

      if (options.performStt && options.extractAudio) {
        this.updateProgress(fileId, 20);
        const audioPath = path.join(UPLOAD_DIR, 'audio', `${fileId}.mp3`);
        await fs.mkdir(path.dirname(audioPath), { recursive: true });
        
        await frameCaptureService.extractAudio(videoPath, audioPath);
        this.updateProgress(fileId, 40);

        const audioBuffer = await fs.readFile(audioPath);
        const sttProvider = getSttProvider();
        transcript = await sttProvider.transcribe(audioBuffer, 'audio/mpeg');
        transcript.fileId = fileId;
        transcript.fileName = result.fileName;
        
        const speechKeyMoments = transcript.segments.map(segment => ({
          timestamp: segment.startTime,
          description: segment.text.substring(0, 100) + (segment.text.length > 100 ? '...' : ''),
          type: 'speech' as const,
          transcriptSegmentId: segment.id,
        }));
        
        keyMoments.push(...speechKeyMoments);
        this.updateProgress(fileId, 60);
      }

      if (options.captureFrames) {
        frames = await frameCaptureService.captureFrames(videoPath, fileId, {
          interval: options.frameInterval || 5,
        });
        this.updateProgress(fileId, 80);

        const visualKeyMoments = frameCaptureService.detectKeyMoments(frames);
        keyMoments.push(...visualKeyMoments);
      }

      keyMoments.sort((a, b) => a.timestamp - b.timestamp);

      result.status = 'completed';
      result.transcript = transcript;
      result.frames = frames;
      result.keyMoments = keyMoments;
      result.processedAt = new Date();
      result.progress = 100;

      this.processingJobs.set(fileId, result);

    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.progress = 0;
      this.processingJobs.set(fileId, result);
    }
  }

  private updateProgress(fileId: string, progress: number): void {
    const result = this.processingJobs.get(fileId);
    if (result) {
      result.progress = progress;
      this.processingJobs.set(fileId, result);
    }
  }

  getProcessingResult(fileId: string): VideoProcessingResult | undefined {
    return this.processingJobs.get(fileId);
  }

  getAllResults(): VideoProcessingResult[] {
    return Array.from(this.processingJobs.values());
  }

  async searchInTranscript(fileId: string, query: string): Promise<{ segmentId: string; timestamp: number; text: string }[]> {
    const result = this.processingJobs.get(fileId);
    if (!result?.transcript) return [];

    const matches = result.transcript.segments.filter(segment => 
      segment.text.toLowerCase().includes(query.toLowerCase())
    );

    return matches.map(segment => ({
      segmentId: segment.id,
      timestamp: segment.startTime,
      text: segment.text,
    }));
  }

  async getFramesAtTimestamp(fileId: string, timestamp: number, tolerance: number = 2): Promise<VideoFrame[]> {
    const result = this.processingJobs.get(fileId);
    if (!result?.frames) return [];

    return result.frames.filter(frame => 
      Math.abs(frame.timestamp - timestamp) <= tolerance
    );
  }
}

export const videoProcessingService = new VideoProcessingService();
