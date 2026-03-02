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


export function getSttProvider(): SttProvider {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return new GoogleSpeechSttProvider();
  }
  return new GoogleSpeechSttProvider();
}
