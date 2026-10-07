import mongoose, { type Model, type Types } from "mongoose";

const { model, models, Schema } = mongoose;

export interface AuditLogDoc {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  action: string;
  targetType?: string;
  targetId?: Types.ObjectId | string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const schema = new Schema<AuditLogDoc>(
  {
    actorId: { type: Schema.Types.ObjectId, required: true },
    action: { type: String, required: true },
    targetType: String,
    targetId: Schema.Types.Mixed,
    details: Schema.Types.Mixed,
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "audit_logs", versionKey: false },
);

export const AuditLogModel = (models.AuditLog as Model<AuditLogDoc>) ?? model<AuditLogDoc>("AuditLog", schema);
