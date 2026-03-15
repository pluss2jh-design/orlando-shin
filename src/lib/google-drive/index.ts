import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

// .env에서 폴더 ID를 가져오거나 기본값을 사용합니다.
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  durationMillis?: string;
}

interface SyncResult {
  files: DriveFileInfo[];
  totalCount: number;
  syncedAt: Date;
}

function parseServiceAccountKey(key: string): any {
  console.log('[Drive] Attempting to parse service account key...');
  try {
    // 1. 기본적인 JSON 파싱 시도
    let parsed = JSON.parse(key);

    if (parsed && typeof parsed.private_key === 'string') {
      // 모든 형태의 \n 이스케이프가 실제 개행으로 변환되지 않았을 경우를 위해 2중 처리
      // 특히 .env에서 이중 백슬래시로 들어오는 경우를 완벽히 해결합니다.
      const originalKey = parsed.private_key;
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');

      if (originalKey !== parsed.private_key) {
        console.log('[Drive] Fixed private_key escaping (replaced \\n with actual newlines)');
      }

      // PEM 형식 체크 (디버깅용)
      if (!parsed.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
        console.warn('[Drive] private_key does not contain BEGIN marker');
      }
      if (!parsed.private_key.includes('-----END PRIVATE KEY-----')) {
        console.warn('[Drive] private_key does not contain END marker');
      }
    }

    return parsed;
  } catch (error: any) {
    console.warn(`[Drive] First JSON.parse attempt failed: ${error.message}`);
    try {
      // 2. 입력값 자체가 이미 깨진 경우(줄바꿈 누락 등) 대비
      let sanitizedKey = key.trim();
      // 만약 시작과 끝에 따옴표가 있다면 제거
      if ((sanitizedKey.startsWith('"') && sanitizedKey.endsWith('"')) ||
        (sanitizedKey.startsWith("'") && sanitizedKey.endsWith("'"))) {
        sanitizedKey = sanitizedKey.substring(1, sanitizedKey.length - 1);
      }

      let parsed = JSON.parse(sanitizedKey);
      if (parsed && typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e: any) {
      console.error(`[Drive] Both JSON.parse attempts failed. Error: ${e.message}`);
      // 원본 데이터가 너무 길어 로그가 넘칠 수 있으므로 일부만 출력
      console.log(`[Drive] Raw key snippet: ${key.substring(0, 50)}...`);
      throw new Error(
        'GOOGLE_SERVICE_ACCOUNT_KEY 형식이 잘못되었습니다. 유효한 JSON 형식이어야 합니다. (ERR: ' + e.message + ')'
      );
    }
  }
}



function getGoogleDriveClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (credentials) {
    const parsedCredentials = parseServiceAccountKey(credentials);
    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  }


  throw new Error(
    'GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 필요합니다.'
  );
}

export async function listDriveFiles(
  folderId: string = GOOGLE_DRIVE_FOLDER_ID,
  depth: number = 0
): Promise<SyncResult> {
  if (depth > 5) return { files: [], totalCount: 0, syncedAt: new Date() };

  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY 환경변수가 없습니다.');
  }
  const parsed = parseServiceAccountKey(credentials);
  console.log(`[Drive] Listing files using service account: ${parsed.client_email}`);

  const drive = getGoogleDriveClient();
  const allFiles: DriveFileInfo[] = [];
  let nextPageToken: string | undefined = undefined;

  try {
    console.log(`[Drive] Fetching files from folder: ${folderId} (Depth: ${depth})`);

    do {
      const response: any = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, videoMediaMetadata)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        pageToken: nextPageToken,
        // 공유 드라이브(Shared Drive) 지원을 위해 추가
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const driveFiles = response.data.files || [];
      console.log(`[Drive] Found ${driveFiles.length} items in folder ${folderId}`);

      for (const f of driveFiles) {
        console.log(`  - [${f.mimeType}] ${f.name} (ID: ${f.id})`);
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          const subFiles = await listDriveFiles(f.id!, depth + 1);
          allFiles.push(...subFiles.files);
        } else {
          allFiles.push({
            id: f.id || '',
            name: f.name || '',
            mimeType: f.mimeType || '',
            size: f.size || '0',
            modifiedTime: f.modifiedTime || '',
            durationMillis: f.videoMediaMetadata?.durationMillis,
          });
        }
      }
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    if (depth === 0) {
      console.log(`[Drive] Total files discovered across all subfolders: ${allFiles.length}`);
    }
    return {
      files: allFiles,
      totalCount: allFiles.length,
      syncedAt: new Date(),
    };
  } catch (error: any) {
    console.error(`[Drive] Error listing files for folder ${folderId}:`, error.message);
    if (error.errors) {
      console.error('[Drive] Google API Errors:', JSON.stringify(error.errors));
    }
    throw error;
  }
}


export async function downloadDriveFile(
  fileId: string,
  fileName: string
): Promise<Buffer> {
  const drive = getGoogleDriveClient();

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data as ArrayBuffer);
}

export async function downloadTextContent(fileId: string): Promise<string> {
  const drive = getGoogleDriveClient();

  const fileInfo = await drive.files.get({
    fileId,
    fields: 'mimeType, name',
  });

  const mimeType = fileInfo.data.mimeType || '';

  if (mimeType === 'application/vnd.google-apps.document') {
    const exported = await drive.files.export({
      fileId,
      mimeType: 'text/plain',
    });
    return exported.data as string;
  }

  if (
    mimeType === 'application/vnd.google-apps.spreadsheet'
  ) {
    const exported = await drive.files.export({
      fileId,
      mimeType: 'text/csv',
    });
    return exported.data as string;
  }

  if (mimeType === 'text/plain' || mimeType.startsWith('text/')) {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );
    return response.data as string;
  }

  if (mimeType === 'application/pdf') {
    try {
      const exported = await drive.files.export({
        fileId,
        mimeType: 'text/plain',
      });
      return exported.data as string;
    } catch (error) {
      console.error('PDF export error:', error);
      return '';
    }
  }

  return '';
}

const globalForDrive = globalThis as unknown as {
  driveStatus?: { isSyncing: boolean; cache: SyncResult | null };
};

export const driveStatus = globalForDrive.driveStatus || {
  isSyncing: false,
  cache: null as SyncResult | null,
};

if (process.env.NODE_ENV !== 'production') globalForDrive.driveStatus = driveStatus;

export async function syncAllFiles(): Promise<SyncResult> {
  if (driveStatus.isSyncing) {
    return driveStatus.cache || { files: [], totalCount: 0, syncedAt: new Date() };
  }

  driveStatus.isSyncing = true;
  try {
    const syncResult = await listDriveFiles();
    driveStatus.cache = syncResult;
    return syncResult;
  } finally {
    driveStatus.isSyncing = false;
  }
}

export async function getSyncInfo(): Promise<SyncResult | null> {
  // 캐시가 있으면 반환, 동기화 중이거나 캐시가 없으면 그냥 null (자동 동기화 방지)
  if (driveStatus.cache) {
    return driveStatus.cache;
  }
  return null;
}

export function getDriveSyncStatus(): boolean {
  return driveStatus.isSyncing;
}

export { GOOGLE_DRIVE_FOLDER_ID };
export type { DriveFileInfo, SyncResult };
