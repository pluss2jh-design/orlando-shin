import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';

const GOOGLE_DRIVE_FOLDER_ID = '1ODcnaY0yQgeFUWYUGOkxVxGKTXsB3t56';
const DATA_DIR = process.env.UPLOAD_DIR || './uploads';
const GDRIVE_DIR = path.join(DATA_DIR, 'gdrive');

interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
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
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
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
): Promise<string> {
  const drive = getGoogleDriveClient();

  await fs.mkdir(GDRIVE_DIR, { recursive: true });

  const outputPath = path.join(GDRIVE_DIR, fileName);

  const existingStat = await fs.stat(outputPath).catch(() => null);
  if (existingStat) return outputPath;

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  await fs.writeFile(outputPath, Buffer.from(response.data as ArrayBuffer));
  return outputPath;
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

export async function syncAllFiles(): Promise<SyncResult> {
  const syncResult = await listDriveFiles();

  await fs.mkdir(GDRIVE_DIR, { recursive: true });

  const syncInfoPath = path.join(GDRIVE_DIR, 'sync-info.json');
  await fs.writeFile(syncInfoPath, JSON.stringify(syncResult, null, 2));

  return syncResult;
}

export async function getSyncInfo(): Promise<SyncResult | null> {
  const syncInfoPath = path.join(GDRIVE_DIR, 'sync-info.json');
  try {
    const data = await fs.readFile(syncInfoPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export { GOOGLE_DRIVE_FOLDER_ID, GDRIVE_DIR };
export type { DriveFileInfo, SyncResult };
