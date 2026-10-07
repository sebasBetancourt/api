import dotenv from "dotenv";
import express from "express";
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import cookieParser from "cookie-parser";
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import versionRouter from "./routers/versionRouter.js";
import { limiter } from "./middleware/limiter.js";
import passport from "passport";
import { configurePassport } from "./config/passport.js";
import testRouter from "./routers/testRouter.js"
import userRoutes from "./routers/user.js"
import UserRouter from "./routers/UserRoute.js";
import authRoutes from "./routers/auth.js";
import { startServer } from "./helpers/server.js";
import titleRoutes from "./routers/TitleRouter.js";
import categoriesRoutes from "./routers/CategoriesRoute.js";
import reviewsRoutes from "./routers/ReviewsRoutes.js"


dotenv.config();
const app = express();


app.use(express.json({ limit: '10mb' }));

// Middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL?.split(",") || ["http://localhost:5173"],
  credentials: true,
}));



app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(morgan('combined'));
app.use(express.urlencoded({ extended: true }));

// Passport
app.use(passport.initialize());
configurePassport(passport);

// Limite de Consultas
app.use(limiter);

// Rutas
app.use("/", testRouter)
app.use("/users", UserRouter);
app.use("/version", versionRouter);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/titles", titleRoutes);
app.use("/categories", categoriesRoutes);
app.use("/reviews", reviewsRoutes);


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerPath = path.join(__dirname, "./swagger.json");

if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf-8"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  console.warn("⚠️  No se encontró el archivo swagger.json");
}


// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  
  // Errores de validación
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Error de validación',
      details: err.message
    });
  }
  
  // Errores de base de datos
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      error: 'Error de base de datos',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
    });
  }
  // Error por defecto
  res.status(err.status || 500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal'
  });
});




// Lanzar Servidor
startServer(app).catch(error => {
  console.error('Error crítico al iniciar servidor:', error);
  process.exit(1);
});

export default app;

