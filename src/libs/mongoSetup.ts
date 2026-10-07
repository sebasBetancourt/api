import type { mongo } from "mongoose";
type Db = mongo.Db;

/**
 * Índices y validadores `$jsonSchema` de las colecciones, portados de legacy/config/database.js.
 * Sirve para crear una BD nueva (p. ej. la de tests). NO se ejecuta al arrancar la API.
 */
const objectId = { bsonType: "objectId" };
const date = { bsonType: "date" };

interface CollectionSpec {
  name: string;
  schema: Record<string, unknown>;
  indexes: { key: Record<string, 1 | -1 | "text">; options?: Record<string, unknown> }[];
}

const specs: CollectionSpec[] = [
  {
    name: "users",
    schema: {
      bsonType: "object",
      required: ["email", "passwordHash", "role", "createdAt", "name", "banned", "preferences", "lists"],
      properties: {
        _id: objectId,
        email: { bsonType: "string" },
        passwordHash: { bsonType: "string" },
        role: { enum: ["user", "admin"] },
        name: { bsonType: "string" },
        phone: { bsonType: ["string", "null"] },
        country: { bsonType: ["string", "null"] },
        avatarUrl: { bsonType: ["string", "null"] },
        createdAt: date,
        lastLoginAt: { bsonType: ["date", "null"] },
        banned: { bsonType: "bool" },
        preferences: {
          bsonType: "object",
          required: ["marketingEmails", "personalizedRecs", "shareAnonymized"],
          properties: {
            marketingEmails: { bsonType: "bool" },
            personalizedRecs: { bsonType: "bool" },
            shareAnonymized: { bsonType: "bool" },
            dataRetentionMonths: { bsonType: ["int", "null"] },
          },
        },
        lists: { bsonType: "array", items: objectId },
      },
    },
    indexes: [{ key: { email: 1 }, options: { unique: true } }, { key: { role: 1 } }, { key: { createdAt: 1 } }],
  },
  {
    name: "titles",
    schema: {
      bsonType: "object",
      required: ["type", "title", "description", "status", "createdAt"],
      properties: {
        type: { bsonType: "string", enum: ["movie", "tv", "anime"] },
        title: { bsonType: "string" },
        description: { bsonType: "string" },
        author: { bsonType: "string" },
        year: { bsonType: "number" },
        temps: { bsonType: "int" },
        epds: { bsonType: "int" },
        categoriesIds: { bsonType: "array", items: objectId },
        posterUrl: { bsonType: "string" },
        images: { bsonType: "array", items: { bsonType: "string" } },
        status: { bsonType: "string", enum: ["pending", "approved", "rejected"] },
        ratingAvg: { bsonType: "number", minimum: 0, maximum: 10 },
        ratingCount: { bsonType: "number", minimum: 0 },
        likes: { bsonType: "number", minimum: 0 },
        dislikes: { bsonType: "number", minimum: 0 },
        createdBy: objectId,
        createdAt: date,
      },
    },
    indexes: [
      { key: { title: "text", description: "text" }, options: { name: "TextIndex" } },
      { key: { type: 1, status: 1, createdAt: -1 } },
      { key: { tmdb_id: 1 }, options: { unique: true, sparse: true } },
      { key: { imdb_id: 1 }, options: { unique: true, sparse: true } },
    ],
  },
  {
    name: "categories",
    schema: {
      bsonType: "object",
      required: ["name", "createdAt"],
      properties: { name: { bsonType: "string" }, createdAt: date },
    },
    indexes: [{ key: { name: 1 }, options: { unique: true } }],
  },
  {
    name: "reviews",
    schema: {
      bsonType: "object",
      required: ["titleId", "userId", "score", "createdAt"],
      properties: {
        titleId: objectId,
        userId: objectId,
        title: { bsonType: "string" },
        comment: { bsonType: "string" },
        score: { bsonType: "number", minimum: 1, maximum: 5 },
        likesCount: { bsonType: "number", minimum: 0 },
        dislikesCount: { bsonType: "number", minimum: 0 },
        createdAt: date,
      },
    },
    indexes: [{ key: { titleId: 1 } }, { key: { userId: 1 } }, { key: { createdAt: -1 } }],
  },
  {
    name: "review_reactions",
    schema: {
      bsonType: "object",
      required: ["reviewId", "userId", "type", "createdAt"],
      properties: { reviewId: objectId, userId: objectId, type: { enum: ["like", "dislike"] }, createdAt: date },
    },
    indexes: [{ key: { reviewId: 1, userId: 1 }, options: { unique: true } }],
  },
  {
    name: "audit_logs",
    schema: {
      bsonType: "object",
      required: ["actorId", "action", "createdAt"],
      properties: {
        actorId: objectId,
        action: { bsonType: "string" },
        targetType: { bsonType: "string" },
        targetId: { bsonType: ["objectId", "string"] },
        details: { bsonType: "object" },
        createdAt: date,
      },
    },
    indexes: [{ key: { actorId: 1 } }, { key: { targetType: 1, targetId: 1 } }, { key: { createdAt: -1 } }],
  },
  {
    // Tokens de un solo uso (recuperación de contraseña). Solo se guarda el hash; el TTL los borra al vencer.
    name: "tokens",
    schema: {
      bsonType: "object",
      required: ["userId", "hash", "createdAt", "expiresAt"],
      properties: {
        userId: objectId,
        hash: { bsonType: "string" },
        purpose: { bsonType: "string" },
        deviceInfo: { bsonType: "string" },
        ip: { bsonType: "string" },
        createdAt: date,
        expiresAt: date,
        revoked: { bsonType: "bool" },
      },
    },
    indexes: [
      { key: { userId: 1 } },
      { key: { hash: 1 } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },
];

export async function setupCollections(db: Db) {
  for (const { name, schema, indexes } of specs) {
    const validator = { $jsonSchema: schema };
    const exists = (await db.listCollections({ name }).toArray()).length > 0;
    if (exists) await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
    else await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
    for (const { key, options } of indexes) await db.collection(name).createIndex(key, options);
  }
}
