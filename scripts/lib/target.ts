import { env } from "../../src/libs/env.js";

/**
 * BD sobre la que trabaja un script de datos (por defecto DB_NAME_TEST) y si escribe (`--apply`).
 * Escribir en la BD de producción exige además `--allow-prod`.
 */
export function parseTarget(args = process.argv.slice(2)) {
  const dbName = args.includes("--db") ? args[args.indexOf("--db") + 1] : env.DB_NAME_TEST;
  const apply = args.includes("--apply");
  if (!dbName) {
    console.error("Falta el nombre de la BD tras --db.");
    process.exit(1);
  }
  if (apply && dbName === env.DB_NAME && !args.includes("--allow-prod")) {
    console.error(`Rechazado: "${dbName}" es la BD de producción. Usa --allow-prod si es lo que quieres.`);
    process.exit(1);
  }
  return { dbName, apply };
}
