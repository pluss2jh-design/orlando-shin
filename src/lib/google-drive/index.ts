import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

// .env에서 폴더 ID를 가져오거나 기본값을 사용합니다.
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1ODcnaY0yQgeFUWYUGOkxVxGKTXsB3t56';

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
      // 이미 파싱된 상태에서 \n (백슬래시+n) 문자열이 남아있을 수 있으므로 처리
      // JSON.parse가 제대로 처리했다면 실제 개행문자가 들어있겠지만, 
      // 이중 이스케이프 된 경우 literal '\n'이 들어있을 수 있음
      if (parsed.private_key.includes('\\n')) {
        console.log('[Drive] Found literal \\n in private_key, replacing with actual newlines.');
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
    }
    
    return parsed;
  } catch (error: any) {
    console.warn(`[Drive] First JSON.parse attempt failed: ${error.message}`);
    try {
      // 2. 개행 문자열 처리 후 재시도
      // .env 로더에서 실제 개행문자가 포함되어 JSON 구조가 깨진 경우를 대비
      let sanitizedKey = key.replace(/\n/g, '\\n');
      let parsed = JSON.parse(sanitizedKey);
      
      if (parsed && typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e: any) {
      console.error(`[Drive] Both JSON.parse attempts failed. Error: ${e.message}`);
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

  const drive = getGoogleDriveClient();
  const allFiles: DriveFileInfo[] = [];
  let nextPageToken: string | undefined = undefined;

  try {
    console.log(`Fetching files from folder: ${folderId}`);

    do {
      const response: any = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, videoMediaMetadata)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        pageToken: nextPageToken,
      });

      const driveFiles = response.data.files || [];
      console.log(`Found ${driveFiles.length} items in folder ${folderId}`);

      for (const f of driveFiles) {
        console.log(`  - ${f.name} (${f.mimeType})`);
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

    console.log(`Total files found: ${allFiles.length}`);
    return {
      files: allFiles,
      totalCount: allFiles.length,
      syncedAt: new Date(),
    };
  } catch (error) {
    console.error(`Error listing files for folder ${folderId}:`, error);
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
