import bcrypt from "bcryptjs";
import { env } from "../src/libs/env.js";
import { connectMongo, disconnectMongo } from "../src/libs/mongo.js";
import { CategoryModel } from "../src/models/category.model.js";
import { UserModel } from "../src/models/user.model.js";

const CATEGORIES = ["Acción", "Aventura", "Animación", "Ciencia ficción", "Comedia", "Crimen", "Drama", "Fantasía", "Terror", "Romance"];

await connectMongo();
console.log(`Seed sobre "${env.DB_NAME}" (solo agrega lo que falta)`);

for (const name of CATEGORIES) {
  await CategoryModel.updateOne({ name }, { $setOnInsert: { name, createdAt: new Date() } }, { upsert: true });
}

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (email && password) {
  await UserModel.updateOne(
    { email },
    {
      $set: { role: "admin" },
      $setOnInsert: {
        email, name: "Admin", passwordHash: await bcrypt.hash(password, 10), banned: false,
        preferences: { marketingEmails: false, personalizedRecs: true, shareAnonymized: false },
        lists: [], favorites: [], createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  console.log(`Admin listo: ${email}`);
} else {
  console.log("SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD no definidos: se omite el admin.");
}
await disconnectMongo();
