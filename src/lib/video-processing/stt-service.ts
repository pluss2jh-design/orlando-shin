import { VideoTranscript, TranscriptSegment, SttProvider } from '@/types/video-processing';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export class WhisperSttProvider implements SttProvider {
  name = 'OpenAI Whisper';

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<VideoTranscript> {
    try {
      const uint8Array = new Uint8Array(audioBuffer);
      const file = new File([uint8Array], 'audio.mp3', { type: mimeType });
      
      const response = await openai.audio.transcriptions.create({
        file: file,
        model: 'whisper-1',
        language: 'ko',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      const segments: TranscriptSegment[] = response.segments?.map((segment, index) => ({
        id: `segment-${index}`,
        startTime: segment.start,
        endTime: segment.end,
        text: segment.text.trim(),
        confidence: segment.avg_logprob ? Math.exp(segment.avg_logprob) : 0.9,
      })) || [];

      const fullText = segments.map(s => s.text).join(' ');

      return {
        fileId: '',
        fileName: '',
        segments,
        fullText,
        duration: segments.length > 0 ? segments[segments.length - 1].endTime : 0,
        processedAt: new Date(),
      };
    } catch (error) {
      console.error('STT transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }
}

export class MockSttProvider implements SttProvider {
  name = 'Mock STT';

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<VideoTranscript> {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockSegments: TranscriptSegment[] = [
      {
        id: 'segment-0',
        startTime: 0,
        endTime: 5.2,
        text: '안녕하세요. 오늘은 주식 투자의 기본 개념에 대해 알아보겠습니다.',
        confidence: 0.95,
      },
      {
        id: 'segment-1',
        startTime: 5.2,
        endTime: 12.8,
        text: '우선 PER이라는 지표를 보시면, 이는 주가를 주당순이익으로 나눈 값입니다.',
        confidence: 0.92,
      },
      {
        id: 'segment-2',
        startTime: 12.8,
        endTime: 20.5,
        text: '현재 삼성전자의 PER은 15배 수준으로, 업계 평균보다 낮은 수준입니다.',
        confidence: 0.88,
      },
      {
        id: 'segment-3',
        startTime: 20.5,
        endTime: 28.3,
        text: '이 차트에서 보시는 것처럼, 반도체 시장은 점진적인 회복세를 보이고 있습니다.',
        confidence: 0.91,
      },
    ];

    return {
      fileId: '',
      fileName: '',
      segments: mockSegments,
      fullText: mockSegments.map(s => s.text).join(' '),
      duration: 28.3,
      processedAt: new Date(),
    };
  }
}

export function getSttProvider(): SttProvider {
  if (process.env.OPENAI_API_KEY) {
    return new WhisperSttProvider();
  }
  return new MockSttProvider();
}
