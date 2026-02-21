import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

const GOOGLE_DRIVE_FOLDER_ID = '1ODcnaY0yQgeFUWYUGOkxVxGKTXsB3t56';

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
    return { files: [], totalCount: 0, syncedAt: new Date() };
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

export const driveStatus = {
  isSyncing: false,
  cache: null as SyncResult | null,
};

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
  return driveStatus.cache;
}

export function getDriveSyncStatus(): boolean {
  return driveStatus.isSyncing;
}

export { GOOGLE_DRIVE_FOLDER_ID };
export type { DriveFileInfo, SyncResult };
