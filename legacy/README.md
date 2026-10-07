<div align="center">
  <img src="https://github.com/user-attachments/assets/4d997c36-e422-4a0d-8e96-e0a813503490" 
       alt="Logo" 
       width="400" 
       height="auto">
</div>



# Descripción del Proyecto
PelixFlix es una aplicación web full-stack diseñada para amantes del cine y series. La plataforma permite a los usuarios descubrir, calificar y reseñar películas y series, así como interactuar con las reseñas de otros usuarios mediante likes y dislikes.##

## Temática: 
Plataforma de reseñas y calificaciones de contenido audiovisual (películas, series, anime) con funcionalidades sociales.

# 🚀 Características Principales
## 🎯 Funcionalidades para Usuarios
- Sistema de Autenticación: Registro e inicio de sesión seguro con JWT

- Gestión de Perfiles: Personalización de perfiles de usuario

- Sistema de Reseñas: Crear, editar y eliminar reseñas con calificaciones (1-10)

- Interacción Social: Like/dislike en reseñas de otros usuarios

- Listados Personalizados: Crear y gestionar listas de favoritos

- Búsqueda Avanzada: Filtrado por categorías, año, rating y popularidad

## ⚡ Funcionalidades para Administradores
- Gestión de Contenido: Aprobar/rechazar nuevos títulos

- Gestión de Categorías: CRUD completo de categorías

- Moderación: Gestionar reportes y contenido inapropiado

- Estadísticas: Dashboard con métricas de la plataforma

# 🛠️ Stack Tecnológico

#Backend
- Node.js + Express.js - Servidor y API REST

- MongoDB - Base de datos NoSQL (con driver nativo)

- JWT - Autenticación y autorización

- bcrypt - Encriptación de contraseñas

- express-validator - Validación de datos

- express-rate-limit - Limitación de peticiones

- passport-jwt - Estrategias de autenticación

- swagger-ui-express - Documentación de API

# Frontend (Repositorio Separado)
- HTML5 + CSS3 + JavaScript vanilla

- Diseño Responsive - Compatible con móviles y desktop

- Consumo de API REST - Comunicación con backend

# 📦 Estructura del Proyecto
```bash

│
├── 📁 config/
│ ├── config.js # Configuración de variables de entorno
│ ├── database.js # Clase de conexión a MongoDB
│ └── passport.js # Configuración de autenticación JWT
│
├── 📁 controllers/ # Lógica de negocio de los endpoints
│ ├── controllerUser.js
│ ├── controllerMoviesSeries.js
│ ├── controllerCategories.js
│ └── controllerRankingsReview.js
│
├── 📁 middleware/ # Middlewares personalizados
│ ├── auth.js # Autenticación y autorización
│ ├── limiter.js # Rate limiting
│ └── validatorFieldsDTO.js # Validación de datos
│
├── 📁 models/ # Modelos de datos y DTOs
│ ├── 📁 classes/ # Clases de modelos
│ └── 📁 dto/ # Data Transfer Objects
│
├── 📁 repositories/ # Acceso a base de datos
│ ├── UserRepository.js
│ ├── MovieSeriesRepository.js
│ └── CategoriesRepository.js
│
├── 📁 services/ # Lógica de negocio
│ ├── UserServices.js
│ ├── MovieSeriesService.js
│ └── CategoriesService.js
│
├── 📁 routers/ # Definición de rutas
│ ├── auth.js
│ ├── UserRoute.js
│ ├── MovieSeriesRoute.js
│ └── CategoriesRoute.js
│
├── 📁 helpers/ # Utilidades y helpers
│ └── server.js # Inicialización del servidor
│
├── 📁 data/ # Datos de prueba y seeds
│ └── dataset.js
│
├── .env # Variables de entorno (NO COMMITTEAR)
├── .gitignore # Archivos ignorados por git
├── app.js # Aplicación principal Express
├── package.json # Dependencias y scripts
└── README.md # Este archivo
```
# 🚀 Instalación y Configuración
## Prerrequisitos
- Node.js v18 o superior

- MongoDB Atlas o MongoDB local

- npm o yarn como gestor de paquetes

# 1. Clonar el Repositorio
``` bash
git clone https://github.com/sebasBetancourt/Pelixflix--backend
cd Pelixflix--backend
```
# 2. Instalar Dependencias
```bash
npm install
```
# 3. Configurar Variables de Entorno

```Crear archivo .env en la raíz del proyecto:```

# env
## Server
```bash
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173


# MongoDB Atlas

MONGODB_URI=mongodb+srv://usuario:password@cluster0.xxxxx.mongodb.net/
DB_NAME=netflix-reviews-db

# JWT
JWT_SECRET=tu-jwt-super-secreto-aqui-cambiar-en-produccion
JWT_EXPIRES_IN=24h

# Rate Limiting
API_RATE_LIMIT=100
API_RATE_LIMIT_WINDOW=900000
4. Inicializar la Base de Datos
bash
# Opcional: Ejecutar script de datos de prueba
node data/seedDatabase.js
5. Ejecutar la Aplicación
bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start

# Solo para pruebas
npm test

```

# 📡 API Endpoints – Pelixflix Backend

## 🔐 Autenticación
| Método | Endpoint        | Descripción              | Auth Required |
|--------|----------------|--------------------------|---------------|
| POST   | `/auth/register` | Registro de nuevo usuario | No            |
| POST   | `/auth/login`    | Inicio de sesión          | No            |
| GET    | `/auth/profile`  | Perfil del usuario actual | Sí (User/Admin) |

---

## 👥 Usuarios
| Método | Endpoint       | Descripción               | Auth Required |
|--------|---------------|---------------------------|---------------|
| GET    | `/users`       | Listar todos los usuarios | Admin         |
| GET    | `/users/:id`   | Obtener usuario específico| Admin         |
| PUT    | `/users/:id`   | Actualizar usuario        | Owner/Admin   |
| DELETE | `/users/:id`   | Eliminar usuario          | Admin         |

---

## 🎬 Títulos (Películas/Series)
| Método | Endpoint                | Descripción             | Auth Required |
|--------|-------------------------|-------------------------|---------------|
| GET    | `/titles`               | Listar títulos con filtros | No         |
| GET    | `/titles/search?q=query`| Buscar títulos          | No            |
| GET    | `/titles/top-rated`     | Top mejor calificados   | No            |
| GET    | `/titles/most-popular`  | Más populares           | No            |
| GET    | `/titles/:id`           | Detalle de título       | No            |
| GET    | `/titles/:id/detail`    | Detalle con reseñas     | No            |
| POST   | `/titles`               | Crear nuevo título      | Admin         |
| PUT    | `/titles/:id`           | Actualizar título       | Admin         |

---

## ⭐ Reseñas
| Método | Endpoint               | Descripción             | Auth Required |
|--------|------------------------|-------------------------|---------------|
| GET    | `/reviews/title/:id`   | Reseñas de un título    | No            |
| POST   | `/reviews`             | Crear reseña            | User          |
| PUT    | `/reviews/:id`         | Editar reseña           | Owner         |
| DELETE | `/reviews/:id`         | Eliminar reseña         | Owner/Admin   |
| POST   | `/reviews/:id/like`    | Dar like a reseña       | User          |
| POST   | `/reviews/:id/dislike` | Dar dislike a reseña    | User          |

---

## 🏷️ Categorías
| Método | Endpoint          | Descripción         | Auth Required |
|--------|------------------|---------------------|---------------|
| GET    | `/categories`    | Listar categorías   | No            |
| POST   | `/categories`    | Crear categoría     | Admin         |
| PUT    | `/categories/:id`| Actualizar categoría| Admin         |
| DELETE | `/categories/:id`| Eliminar categoría  | Admin         |

---

## 🔐 Autenticación y Roles
### Roles de Usuario
- **Usuario (user):** Puede crear reseñas, dar likes/dislikes, gestionar su perfil.  
- **Administrador (admin):** Tiene todas las funcionalidades + gestión de contenido.

### Tokens JWT
La autenticación se realiza mediante tokens JWT incluidos en el header:

```http
Authorization: Bearer <token>
```

# 🗄️ Estructura de la Base de Datos
## Colecciones Principales

- users → Información de usuarios y autenticación

- titles → Películas, series y contenido audiovisual

- reviews → Reseñas y calificaciones de usuarios

- categories → Categorías y géneros

- review_reactions → Likes/dislikes de reseñas

- lists → Listas personalizadas de usuarios

## Índices Implementados

- Índice único en email de usuarios

- Índice de texto en títulos para búsqueda

- Índices para optimizar consultas frecuentes

- Índices TTL para tokens expirables

# 🧪 Testing
## Ejecutar Tests
```
# Todos los tests
npm test

# Tests con watch mode
npm run test:watch

# Tests de integración
npm run test:integration

Coverage de Tests
# Generar reporte de coverage
npm run test:coverage
```

# 🚀 Despliegue
```
Variables de Entorno (Producción)
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://usuario:password@cluster-prod.xxxxx.mongodb.net/
JWT_SECRET=super-secret-jwt-key-production
FRONTEND_URL=https://tudominio.com

Comandos de Despliegue
# Build para producción
npm run build

# Iniciar en producción
npm start
```

# 📊 Métricas y Monitoreo
```
Health Checks
curl http://localhost:3000/api/health


Response ejemplo:

{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "database": "connected",
  "environment": "production"
}
```
# Logs


- Desarrollo: logs estructurados con Morgan (HTTP requests).

- Producción: logs con Winston para mayor control y persistencia.

  📝 Scripts NPM
  
```json
{
  "start": "node app.js",
  "dev": "nodemon app.js",
  "test": "jest --testTimeout=10000",
  "test:watch": "jest --watch --testTimeout=10000",
  "test:coverage": "jest --coverage",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "seed": "node data/seedDatabase.js"
}
```
# 🆘 Troubleshooting
Problemas Comunes
- Error de conexión a MongoDB

- Verificar la URI de conexión

- Revisar whitelist de IPs en MongoDB Atlas

- Error de puerto en uso

``` bash
lsof -ti:3000 | xargs kill
```
## Variables de entorno no cargadas

- Asegurar que el archivo .env existe

- Verificar que esté en la raíz del proyecto

# Logs de Debug
```bash
# Ejecutar con logs detallados
DEBUG=* npm run dev
```


# 👥 Equipo de Desarrollo

- Sebastian Betancourt
- Victor Pabon


# 🔗 Enlaces Importantes
Frontend Repository: [[URL del repositorio frontend]](https://github.com/sebasBetancourt/streaming)

API Documentation: http://localhost:3000/api-docs

Project Board: [URL de GitHub Projects/Trello]

Production URL: [URL de producción]

# 🎯 Próximos Features
- Sistema de recomendaciones

- Integración con APIs de películas (TMDB)

- Notificaciones en tiempo real

- Modo oscuro

- Exportación de datos de usuario

- Sistema de reportes avanzado

- Mobile app nativa



