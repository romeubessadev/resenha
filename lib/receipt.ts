import { supabase } from './supabase';

const BUCKET = 'comprovantes';

export async function uploadReceipt(
  groupId: string,
  uri: string,
  mimeType: string,
  previousPath?: string | null,
): Promise<string> {
  const arrayBuffer = await fetch(uri).then(res => res.arrayBuffer());
  const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg';
  const path = `${groupId}/comprovante-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, { contentType: mimeType });
  if (error) throw error;

  if (previousPath) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  return path;
}

export async function deleteReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
