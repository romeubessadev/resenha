import { supabase } from './supabase';

const BUCKET = 'avatares-grupo';

export function getGroupAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function uploadGroupAvatar(
  groupId: string,
  uri: string,
  mimeType: string,
  previousPath?: string | null,
): Promise<string> {
  const arrayBuffer = await fetch(uri).then(res => res.arrayBuffer());
  const ext = mimeType.split('/')[1]?.split('+')[0] ?? 'jpg';
  const path = `${groupId}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, { contentType: mimeType });
  if (error) throw error;

  if (previousPath) {
    await supabase.storage.from(BUCKET).remove([previousPath]);
  }

  return path;
}

export async function deleteGroupAvatar(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
