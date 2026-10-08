import { API_PREFIX } from "../../constants/globalConstants.js";
import { AppError } from "../../libs/appError.js";
import { MAX_AVATAR_BYTES, processAvatar } from "../../libs/imageProcessor.js";
import { safeDownload } from "../../libs/safeFetch.js";
import { avatarRepository } from "../../repositories/avatar.repository.js";
import { userAdminRepository } from "../../repositories/user.repository.js";

/** URL pública y versionada: al cambiar la foto cambia `v`, así la caché larga nunca muestra la anterior. */
export const avatarPublicUrl = (userId: string, etag: string) => `${API_PREFIX}/avatars/${userId}?v=${etag}`;

async function saveAvatar(userId: string, raw: Buffer) {
  const processed = await processAvatar(raw);
  await avatarRepository.upsert(userId, processed);
  const user = await userAdminRepository.update(userId, { avatarUrl: avatarPublicUrl(userId, processed.etag) });
  return user.avatarUrl;
}

export const setAvatarFromFileService = (userId: string, file: Buffer) => saveAvatar(userId, file);

export async function setAvatarFromUrlService(userId: string, url: string) {
  return saveAvatar(userId, await safeDownload(url, MAX_AVATAR_BYTES));
}

export async function removeAvatarService(userId: string) {
  await avatarRepository.delete(userId);
  await userAdminRepository.update(userId, { avatarUrl: null });
}

export async function getAvatarService(userId: string) {
  const avatar = await avatarRepository.findByUserId(userId);
  if (!avatar) throw new AppError(404, "Sin foto de perfil");
  return avatar;
}
