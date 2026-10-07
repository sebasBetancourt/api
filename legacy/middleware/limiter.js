import rateLimit from "express-rate-limit";

//Limitador
export const limiter = rateLimit({
  windowMs: 60 * 2000,
  max: 900,
  message: "Demasiadas solicitudes, intenta de nuevo en 2 minutos. "
});