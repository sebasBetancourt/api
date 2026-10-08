import type { FastifyReply, FastifyRequest, RouteGenericInterface } from "fastify";
import {
  changePasswordService, deleteAccountService, exportMyDataService, getMeService,
  updateMeService, updatePreferencesService,
} from "../services/me/meServices.js";
import { AppError } from "../libs/appError.js";
import { removeAvatarService, setAvatarFromFileService, setAvatarFromUrlService } from "../services/me/avatarServices.js";
import type { PreferencesInput, UpdateMeInput } from "../schemas/user.schema.js";

type Req<T extends RouteGenericInterface = RouteGenericInterface> = FastifyRequest<T>;

export const meController = {
  get: (req: Req) => getMeService(req.user.id),
  update: (req: Req<{ Body: UpdateMeInput }>) => updateMeService(req.user.id, req.body),
  preferences: (req: Req<{ Body: PreferencesInput }>) => updatePreferencesService(req.user.id, req.body),
  async password(req: Req<{ Body: { currentPassword: string; newPassword: string } }>) {
    await changePasswordService(req.user.id, req.body.currentPassword, req.body.newPassword);
    return { message: "Contraseña actualizada" };
  },
  async setAvatar(req: Req) {
    const file = await req.file();
    if (!file) throw new AppError(400, "Falta el archivo de la imagen");
    let buffer: Buffer;
    try {
      buffer = await file.toBuffer(); // lanza si supera el límite de tamaño
    } catch {
      throw new AppError(413, "La imagen supera los 2 MB");
    }
    return { avatarUrl: await setAvatarFromFileService(req.user.id, buffer) };
  },
  async setAvatarUrl(req: Req<{ Body: { url: string } }>) {
    return { avatarUrl: await setAvatarFromUrlService(req.user.id, req.body.url) };
  },
  async removeAvatar(req: Req) {
    await removeAvatarService(req.user.id);
    return { avatarUrl: null };
  },
  async export(req: Req, reply: FastifyReply) {
    const data = await exportMyDataService(req.user.id);
    return reply
      .header("Content-Disposition", 'attachment; filename="mis-datos.json"')
      .send(data);
  },
  async delete(req: Req<{ Body: { password: string } }>) {
    await deleteAccountService(req.user.id, req.body.password);
    return { message: "Cuenta eliminada" };
  },
};
