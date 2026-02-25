import { VideoTranscript, TranscriptSegment, SttProvider } from '@/types/video-processing';
import { google } from 'googleapis';

function parseServiceAccountKey(key: string): object {
  try {
    return JSON.parse(key);
  } catch {
    try {
      return JSON.parse(key.replace(/\n/g, '\\n'));
    } catch {
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY 형식이 잘못되었습니다. 유효한 JSON 형식이어야 합니다.'
      );
    }
  }
}

async function getSpeechClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 설정되지 않았습니다.');
  }
  
  const parsedCredentials = parseServiceAccountKey(credentials);
  const auth = new google.auth.GoogleAuth({
    credentials: parsedCredentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  
  return google.speech({ version: 'v1', auth });
}

export class GoogleSpeechSttProvider implements SttProvider {
  name = 'Google Cloud Speech-to-Text';

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<VideoTranscript> {
    try {
      const speechClient = await getSpeechClient();
      
      const base64Audio = audioBuffer.toString('base64');
      
      const response = await speechClient.speech.recognize({
        requestBody: {
          audio: {
            content: base64Audio,
          },
          config: {
            encoding: 'MP3',
            sampleRateHertz: 16000,
            languageCode: 'ko-KR',
            enableWordTimeOffsets: true,
            enableAutomaticPunctuation: true,
            model: 'latest_long',
          },
        },
      });

      const results = response.data.results || [];
      const segments: TranscriptSegment[] = [];

      results.forEach((result, resultIndex) => {
        const alternatives = result.alternatives || [];
        if (alternatives.length > 0) {
          const alternative = alternatives[0];
          const words = alternative.words || [];
          
          if (words.length > 0) {
            const firstWord = words[0] as any;
            const lastWord = words[words.length - 1] as any;
            const startTime = Number(firstWord.startTime?.seconds || 0) + (firstWord.startTime?.nanos || 0) / 1e9;
            const endTime = Number(lastWord.endTime?.seconds || 0) + (lastWord.endTime?.nanos || 0) / 1e9;
            
            segments.push({
              id: `segment-${resultIndex}`,
              startTime,
              endTime,
              text: alternative.transcript || '',
              confidence: alternative.confidence || 0.9,
            });
          }
        }
      });

      const fullText = segments.map(s => s.text).join(' ');
      const duration = segments.length > 0 ? segments[segments.length - 1].endTime : 0;

      return {
        fileId: '',
        fileName: '',
        segments,
        fullText,
        duration,
        processedAt: new Date(),
      };
    } catch (error) {
      console.error('Google Speech-to-Text transcription error:', error);
      throw new Error('Failed to transcribe audio with Google Speech-to-Text');
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
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return new GoogleSpeechSttProvider();
  }
  return new MockSttProvider();
}
