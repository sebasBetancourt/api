import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../../constants/globalConstants.js";
import { AppError } from "../../libs/appError.js";
import { adminRepository } from "../../repositories/admin.repository.js";
import { avatarRepository } from "../../repositories/avatar.repository.js";
import { userAdminRepository, userRepository } from "../../repositories/user.repository.js";
import type { PreferencesInput, UpdateMeInput } from "../../schemas/user.schema.js";

export async function getMeService(id: string) {
  const user = await userAdminRepository.findPublicById(id);
  if (!user) throw new AppError(404, "Usuario no encontrado");
  return user;
}

export const updateMeService = (id: string, data: UpdateMeInput) => userAdminRepository.update(id, data);

export async function updatePreferencesService(id: string, input: PreferencesInput) {
  await getMeService(id);
  return userAdminRepository.update(id, { preferences: input });
}

async function assertPassword(id: string, password: string) {
  const user = await userRepository.findById(id);
  if (!user) throw new AppError(404, "Usuario no encontrado");
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError(401, "Contraseña incorrecta");
  }
}

export async function changePasswordService(id: string, current: string, next: string) {
  if (current === next) throw new AppError(400, "La nueva contraseña debe ser distinta a la actual");
  await assertPassword(id, current);
  await userAdminRepository.updatePassword(id, await bcrypt.hash(next, BCRYPT_ROUNDS));
  await adminRepository.audit(id, "user.password_change", "user", id);
}

export async function deleteAccountService(id: string, password: string) {
  await assertPassword(id, password);
  const user = await userRepository.findById(id);
  if (user?.role === "admin" && (await userRepository.countAdmins()) <= 1) {
    throw new AppError(409, "Eres el único administrador: nombra a otro antes de eliminar tu cuenta");
  }
  await adminRepository.audit(id, "user.delete", "user", id);
  await avatarRepository.delete(id);
  await userAdminRepository.delete(id);
}

export const exportMyDataService = (id: string) => userAdminRepository.exportData(id);
