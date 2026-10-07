import { oid } from "../libs/mongoHelpers.js";
import { AuditLogModel } from "../models/auditLog.model.js";
import { ReviewModel } from "../models/review.model.js";
import { TitleModel } from "../models/title.model.js";
import { UserModel } from "../models/user.model.js";

export const adminRepository = {
  async metrics() {
    const [users, titles, reviews, pending] = await Promise.all([
      UserModel.countDocuments(),
      TitleModel.countDocuments(),
      ReviewModel.countDocuments(),
      TitleModel.countDocuments({ status: "pending" }),
    ]);
    return { users, titles, reviews, pending };
  },

  audit: (actorId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) =>
    AuditLogModel.create({
      actorId: oid(actorId), action, targetType, targetId: oid(targetId),
      ...(details && { details }), createdAt: new Date(),
    }),
};
