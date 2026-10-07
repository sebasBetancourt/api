import { buildApp } from "./app.js";
import { env } from "./libs/env.js";
import { connectMongo, disconnectMongo } from "./libs/mongo.js";

const conn = await connectMongo();
console.log(`MongoDB conectado: ${conn.host}/${conn.name}`);

const app = await buildApp();
app.addHook("onClose", async () => {
  await disconnectMongo();
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => void app.close().then(() => process.exit(0)));
}
await app.listen({ port: env.PORT, host: "0.0.0.0" });
