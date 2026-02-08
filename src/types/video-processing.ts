export interface VideoTranscript {
  fileId: string;
  fileName: string;
  segments: TranscriptSegment[];
  fullText: string;
  duration: number;
  processedAt: Date;
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
}

export interface VideoFrame {
  id: string;
  fileId: string;
  timestamp: number;
  imageUrl: string;
  thumbnailUrl?: string;
  ocrText?: string;
  detectedObjects?: string[];
}

export interface VideoProcessingResult {
  fileId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  transcript?: VideoTranscript;
  frames?: VideoFrame[];
  keyMoments?: KeyMoment[];
  error?: string;
  progress: number;
  processedAt?: Date;
}

export interface KeyMoment {
  timestamp: number;
  description: string;
  type: 'speech' | 'visual' | 'both';
  transcriptSegmentId?: string;
  frameIds?: string[];
}

export interface VideoProcessingOptions {
  extractAudio: boolean;
  performStt: boolean;
  captureFrames: boolean;
  frameInterval?: number;
  keyMomentDetection?: boolean;
  ocrEnabled?: boolean;
}

export interface SttProvider {
  name: string;
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<VideoTranscript>;
}
