'use client';

import { useState, useCallback } from 'react';
import { VideoProcessingResult, VideoProcessingOptions } from '@/types/video-processing';

interface UseVideoProcessingReturn {
  processVideo: (file: File, options?: Partial<VideoProcessingOptions>) => Promise<string>;
  getStatus: (fileId: string) => Promise<VideoProcessingResult | null>;
  searchTranscript: (fileId: string, query: string) => Promise<{ segmentId: string; timestamp: number; text: string }[]>;
  getFrames: (fileId: string, timestamp: number, tolerance?: number) => Promise<{ frames: { id: string; timestamp: number; imageUrl: string }[] }>;
  isProcessing: boolean;
  error: string | null;
}

export function useVideoProcessing(): UseVideoProcessingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processVideo = useCallback(async (
    file: File,
    options: Partial<VideoProcessingOptions> = {}
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('extractAudio', String(options.extractAudio ?? true));
      formData.append('performStt', String(options.performStt ?? true));
      formData.append('captureFrames', String(options.captureFrames ?? true));
      formData.append('frameInterval', String(options.frameInterval ?? 5));
      formData.append('keyMomentDetection', String(options.keyMomentDetection ?? true));

      const response = await fetch('/api/video/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process video');
      }

      const data = await response.json();
      return data.fileId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const getStatus = useCallback(async (fileId: string): Promise<VideoProcessingResult | null> => {
    try {
      const response = await fetch(`/api/video/process?fileId=${fileId}`);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.result;
    } catch (err) {
      console.error('Failed to get status:', err);
      return null;
    }
  }, []);

  const searchTranscript = useCallback(async (
    fileId: string,
    query: string
  ): Promise<{ segmentId: string; timestamp: number; text: string }[]> => {
    try {
      const response = await fetch(`/api/video/search?fileId=${fileId}&query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.matches;
    } catch (err) {
      console.error('Failed to search transcript:', err);
      return [];
    }
  }, []);

  const getFrames = useCallback(async (
    fileId: string,
    timestamp: number,
    tolerance?: number
  ): Promise<{ frames: { id: string; timestamp: number; imageUrl: string }[] }> => {
    try {
      const url = `/api/video/frames?fileId=${fileId}&timestamp=${timestamp}${tolerance ? `&tolerance=${tolerance}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return { frames: [] };
      }

      const data = await response.json();
      return { frames: data.frames };
    } catch (err) {
      console.error('Failed to get frames:', err);
      return { frames: [] };
    }
  }, []);

  return {
    processVideo,
    getStatus,
    searchTranscript,
    getFrames,
    isProcessing,
    error,
  };
}
