import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "../../constants/globalConstants.js";
import { AppError } from "../../libs/appError.js";
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
  await assertPassword(id, current);
  await userAdminRepository.updatePassword(id, await bcrypt.hash(next, BCRYPT_ROUNDS));
}

export async function deleteAccountService(id: string, password: string) {
  await assertPassword(id, password);
  await userAdminRepository.delete(id);
}

export const exportMyDataService = (id: string) => userAdminRepository.exportData(id);
