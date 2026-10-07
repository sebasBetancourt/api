import { AppError } from "../../libs/appError.js";
import { adminRepository } from "../../repositories/admin.repository.js";
import { titleRepository } from "../../repositories/title.repository.js";
import { userAdminRepository } from "../../repositories/user.repository.js";
import type { RoleName } from "../../constants/globalConstants.js";

export const getMetricsService = () => adminRepository.metrics();

export const listAllTitlesService = (f: Parameters<typeof titleRepository.findPage>[0]) =>
  titleRepository.findPage(f);

export const listUsersService = (skip: number, limit: number, search?: string) =>
  userAdminRepository.list(skip, limit, search);

function assertNotSelf(adminId: string, targetId: string) {
  if (adminId === targetId) throw new AppError(400, "No puedes aplicar esta acción sobre tu propia cuenta");
}

async function assertExists(id: string) {
  if (!(await userAdminRepository.findPublicById(id))) throw new AppError(404, "Usuario no encontrado");
}

export async function setUserRoleService(adminId: string, id: string, role: RoleName) {
  assertNotSelf(adminId, id);
  await assertExists(id);
  const user = await userAdminRepository.update(id, { role });
  await adminRepository.audit(adminId, "user.role", "user", id, { role });
  return user;
}

export async function setUserBannedService(adminId: string, id: string, banned: boolean) {
  assertNotSelf(adminId, id);
  await assertExists(id);
  const user = await userAdminRepository.update(id, { banned });
  await adminRepository.audit(adminId, banned ? "user.ban" : "user.unban", "user", id);
  return user;
}

export async function deleteUserService(adminId: string, id: string) {
  assertNotSelf(adminId, id);
  await assertExists(id);
  await userAdminRepository.delete(id);
  await adminRepository.audit(adminId, "user.delete", "user", id);
}
