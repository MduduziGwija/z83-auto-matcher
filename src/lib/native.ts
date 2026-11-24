import { Capacitor } from '@capacitor/core';

/** True inside the Android / iPhone app, false in a normal browser. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(blob);
  });

const cleanName = (n: string) => n.replace(/[\\/:*?"<>|]+/g, '-');

/** Writes a file to the app's cache and returns where it is. */
async function writeCache(blob: Blob, name: string): Promise<{ uri: string; path: string }> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const res = await Filesystem.writeFile({ path: cleanName(name), data: await toBase64(blob), directory: Directory.Cache, recursive: true });
  return { uri: res.uri, path: res.uri.replace(/^file:\/\//, '') };
}

/** "Download" inside the app: the phone's share list lets the person save it to Files / Drive or send it anywhere. */
export async function saveFileNative(blob: Blob, name: string): Promise<void> {
  const { Share } = await import('@capacitor/share');
  const { uri } = await writeCache(blob, name);
  await Share.share({ title: name, files: [uri], dialogTitle: 'Save or share' });
}

/** Opens a PDF in the phone's own viewer. */
export async function previewPdfNative(blob: Blob, name: string): Promise<void> {
  const { FileViewer } = await import('@capacitor/file-viewer');
  const { uri } = await writeCache(blob, name);
  await FileViewer.openDocumentFromLocalPath({ path: uri });
}

export type ComposeResult = 'composer' | 'share';

/**
 * Opens the phone's email composer with the address, subject, message and PDF all filled in.
 * Falls back to the share list when no email account is set up (iPhone Mail not configured).
 */
export async function composeEmailNative(opts: { to: string; subject: string; body: string; fileName: string; blob: Blob }): Promise<ComposeResult> {
  const { path, uri } = await writeCache(opts.blob, opts.fileName);
  try {
    const { EmailComposer } = await import('capacitor-email-composer');
    if (Capacitor.getPlatform() === 'ios') {
      const { hasAccount } = await EmailComposer.hasAccount();
      if (!hasAccount) throw new Error('no-account');
    }
    await EmailComposer.open({ to: opts.to ? [opts.to] : [], subject: opts.subject, body: opts.body, attachments: [{ type: 'absolute', path }] });
    return 'composer';
  } catch {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: opts.subject, text: opts.body, files: [uri], dialogTitle: 'Send with' });
    return 'share';
  }
}
