/** Shared helpers: photo/video picking via expo-image-picker with validation. */
import * as ImagePicker from 'expo-image-picker';
import { toast } from './toast';
import { validateMediaSize } from '../domain/validation';

export interface PickedMedia {
  uri: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
  fileSize?: number;
}

export async function pickMedia(options: { allowsMultiple?: boolean } = {}): Promise<PickedMedia[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    toast('Photo library access was declined. Enable it in Settings to add media.', 'error');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: !!options.allowsMultiple,
    selectionLimit: options.allowsMultiple ? 6 : 1,
    quality: 0.85,
    videoMaxDuration: 120,
  });
  if (result.canceled) return [];

  const out: PickedMedia[] = [];
  for (const asset of result.assets) {
    const kind = asset.type === 'video' ? 'video' : 'image';
    const sizeCheck = validateMediaSize(asset.fileSize ?? 0, kind);
    if (!sizeCheck.ok) {
      toast(sizeCheck.message, 'error');
      continue;
    }
    out.push({
      uri: asset.uri,
      kind,
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    });
  }
  return out;
}

export async function captureMedia(): Promise<PickedMedia | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    toast('Camera access was declined. Enable it in Settings to capture moments.', 'error');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.85,
    videoMaxDuration: 120,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const kind = asset.type === 'video' ? 'video' : 'image';
  const sizeCheck = validateMediaSize(asset.fileSize ?? 0, kind);
  if (!sizeCheck.ok) {
    toast(sizeCheck.message, 'error');
    return null;
  }
  return { uri: asset.uri, kind, width: asset.width, height: asset.height, fileSize: asset.fileSize };
}
