import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';

/**
 * Clase Database
 * -----------------------------
 * Maneja la conexión con MongoDB y operaciones comunes.
 * Optimizado para MongoDB Atlas con configuración mejorada.
 * 
 * Funcionalidades principales:
 *  - Conectar y desconectar de la base de datos.
 *  - Configurar colecciones e índices al iniciar.
 *  - Operaciones CRUD y transaccionales (ej. reseñas + actualización de rating).
 *  - Métodos de utilidad como crear usuarios y buscar títulos.
 */
class Database {
  constructor() {
    this.client = null;       // Cliente de MongoDB
    this.db = null;           // Instancia de la base de datos
    this.isConnected = false; // Estado de conexión
  }

  /**
   * Conecta a MongoDB Atlas y configura colecciones.
   * @param {string} uri - URI de conexión de MongoDB Atlas.
   * @param {string} dbName - Nombre de la base de datos.
   */
  async connect(uri, dbName) {
    try {
      console.log('Intentando conectar a MongoDB Atlas...');
      if (!uri) {
        throw new Error('MONGODB_URI is undefined. Set MONGODB_URI in your .env file');
      }
      console.log('URI:', String(uri).replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')); // Oculta credenciales

      this.client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
      });

      await this.client.connect();
      this.db = this.client.db(dbName);
      this.isConnected = true;

      console.log('✅ Conectado exitosamente a MongoDB Atlas');
      console.log('📊 Base de datos:', dbName);

      // Mostrar información del cluster
      try {
        const adminDb = this.client.db().admin();
        const serverInfo = await adminDb.serverInfo();
        console.log('🔧 Versión de MongoDB:', serverInfo.version);
        console.log('🖥️ Host:', serverInfo.host);
      } catch (infoError) {
        console.log('ℹ️ Info adicional no disponible:', infoError.message);
      }

      // Configurar colecciones e índices
      await this.setupCollections();

      return this;
    } catch (error) {
      console.error('❌ Error conectando a MongoDB Atlas:', error.message);
      throw error;
    }
  }

  /**
   * Cierra la conexión con MongoDB.
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.close();
      this.isConnected = false;
      this.db = null;
      console.log('Desconectado de MongoDB');
    }
  }

  /**
   * Obtiene una colección por nombre.
   * @param {string} collectionName - Nombre de la colección.
   * @returns {Collection} Instancia de la colección MongoDB.
   */
  getCollection(collectionName) {
    if (!this.isConnected || !this.db) {
      throw new Error('Base de datos no conectada. Llama a connect() primero.');
    }
    return this.db.collection(collectionName);
  }

  /**
   * Configura todas las colecciones necesarias para la app.
   */
  async setupCollections() {
    await this.setupUsersCollection();
    await this.setupTitlesCollection();
    await this.setupCategoriesCollection();
    await this.setupReviewsCollection();
    await this.setupReviewReactionsCollection();
    await this.setupListsCollection();
    await this.setupTokensCollection();
    await this.setupExportsJobsCollection();
    await this.setupAuditLogsCollection();
    console.log('Colecciones e índices configurados correctamente');
  }

  /**
   * Configura la colección de usuarios con índices y validaciones.
   */
  async setupUsersCollection() {
    const usersCollection = this.getCollection('users');

    // Crear índices
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ role: 1 });
    await usersCollection.createIndex({ createdAt: 1 });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'users',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['email', 'passwordHash', 'role', 'createdAt', 'name', 'banned', 'preferences', 'lists'],
            properties: {
              _id: { bsonType: 'objectId' },
              email: {
                bsonType: 'string',
                pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                description: 'Debe ser un email válido y es requerido'
              },
              passwordHash: { bsonType: 'string', description: 'Debe ser un string y es requerido' },
              role: { enum: ['user', 'admin'], description: 'Debe ser "user" o "admin"' },
              name: { bsonType: 'string', description: 'Debe ser un string' },
              phone: { bsonType: ['string', 'null'], description: 'Debe ser un string o null' },
              country: { bsonType: ['string', 'null'], description: 'Debe ser un string o null' },
              avatarUrl: { bsonType: ['string', 'null'], description: 'Debe ser un string o null' },
              createdAt: { bsonType: 'date', description: 'Debe ser una fecha y es requerido' },
              lastLoginAt: { bsonType: ['date', 'null'], description: 'Debe ser una fecha o null' },
              banned: { bsonType: 'bool', description: 'Debe ser un booleano' },
              preferences: {
                bsonType: 'object',
                required: ['marketingEmails', 'personalizedRecs', 'shareAnonymized'],
                properties: {
                  marketingEmails: { bsonType: 'bool' },
                  personalizedRecs: { bsonType: 'bool' },
                  shareAnonymized: { bsonType: 'bool' },
                  dataRetentionMonths: { bsonType: ['int', 'null'], description: 'Debe ser un número o null' }
                }
              },
              lists: { bsonType: 'array', items: { bsonType: 'objectId' } }
            }
          }
        },
        validationLevel: 'strict',
        validationAction: 'error'
      });
      console.log('Esquema de la colección users configurado correctamente');
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de users:', error.message);
    }
  }

  /**
   * Configura la colección de títulos (películas/series) con índices y validaciones.
   */
  async setupTitlesCollection() {
    const titlesCollection = this.getCollection('titles');

    // Crear índices
    await titlesCollection.createIndex(
      { title: "text", description: "text" },
      { name: "TextIndex" }
    );
    await titlesCollection.createIndex({ type: 1, status: 1, createdAt: -1 });
    await titlesCollection.createIndex({ genres: 1 });
    await titlesCollection.createIndex({ tmdb_id: 1 }, { unique: true, sparse: true });
    await titlesCollection.createIndex({ imdb_id: 1 }, { unique: true, sparse: true });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'titles',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['type', 'title',  'description', 'status', 'createdAt'],
            properties: {
              type: { bsonType: "string", enum: ['movie', 'tv', 'anime'] },//
              title: { bsonType: 'string' },//
              description: { bsonType: 'string' },//
              author: { bsonType: 'string' },
              year: { bsonType: 'number' },
              temps: { bsonType: 'int'},
              epds: { bsonType: 'int' },
              categoriesIds: { bsonType: 'array', items: { bsonType: 'objectId' } },
              posterUrl: { bsonType: 'string' },
              images: { bsonType: 'array', items: { bsonType: 'string' } },
              status: { bsonType: "string", enum: ['pending', 'approved', 'rejected'] },//
              ratingAvg: { bsonType: 'number', minimum: 0, maximum: 10 },
              ratingCount: { bsonType: 'number', minimum: 0 },
              likes: { bsonType: 'number', minimum: 0 },
              dislikes: { bsonType: 'number', minimum: 0 },
              createdBy: { bsonType: 'objectId' },
              createdAt: { bsonType: 'date' }//
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de titles:', error.message);
    }
  }

  /**
   * Configura la colección de categorías con índices y validaciones.
   */
  async setupCategoriesCollection() {
    const categoriesCollection = this.getCollection('categories');

    // Crear índices
    await categoriesCollection.createIndex({ name: 1 }, { unique: true });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'categories',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'createdAt'],
            properties: {
              name: { bsonType: 'string' },
              createdAt: { bsonType: 'date' }
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de categories:', error.message);
    }
  }

  /**
   * Configura la colección de reseñas con índices y validaciones.
   */
  async setupReviewsCollection() {
    const reviewsCollection = this.getCollection('reviews');

    // Crear índices
    await reviewsCollection.createIndex({ titleId: 1 });
    await reviewsCollection.createIndex({ userId: 1 });
    await reviewsCollection.createIndex({ createdAt: -1 });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'reviews',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['titleId', 'userId', 'score', 'createdAt'],
            properties: {
              titleId: { bsonType: 'objectId' },
              userId: { bsonType: 'objectId' },
              title: { bsonType: 'string' },
              comment: { bsonType: 'string' },
              score: { bsonType: 'number', minimum: 1, maximum: 5 },
              likesCount: { bsonType: 'number', minimum: 0 },
              dislikesCount: { bsonType: 'number', minimum: 0 },
              createdAt: { bsonType: 'date' }
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de reviews:', error.message);
    }
  }

  /**
   * Configura la colección de reacciones a reseñas con índices y validaciones.
   */
  async setupReviewReactionsCollection() {
    const reviewReactionsCollection = this.getCollection('review_reactions');

    // Crear índices
    await reviewReactionsCollection.createIndex(
      { reviewId: 1, userId: 1 },
      { unique: true }
    );

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'review_reactions',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['reviewId', 'userId', 'type', 'createdAt'],
            properties: {
              reviewId: { bsonType: 'objectId' },
              userId: { bsonType: 'objectId' },
              type: { enum: ['like', 'dislike'] },
              createdAt: { bsonType: 'date' }
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de review_reactions:', error.message);
    }
  }

  /**
   * Configura la colección de listas de usuarios con índices y validaciones.
   */
  async setupListsCollection() {
    const listsCollection = this.getCollection('lists');

    // Crear índices
    await listsCollection.createIndex({ userId: 1 });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'lists',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['userId', 'name', 'createdAt'],
            properties: {
              userId: { bsonType: 'objectId' },
              name: { bsonType: 'string' },
              items: {
                bsonType: 'array',
                items: {
                  bsonType: 'object',
                  required: ['itemId', 'type', 'addedAt'],
                  properties: {
                    itemId: { bsonType: 'objectId' },
                    type: { bsonType: 'string' },
                    addedAt: { bsonType: 'date' },
                    meta: {
                      bsonType: 'object',
                      properties: {
                        title: { bsonType: 'string' },
                        posterUrl: { bsonType: 'string' }
                      }
                    }
                  }
                }
              },
              createdAt: { bsonType: 'date' },
              updatedAt: { bsonType: 'date' }
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de lists:', error.message);
    }
  }

  /**
   * Configura la colección de tokens de sesión con índices y validaciones.
   */
  async setupTokensCollection() {
    const tokensCollection = this.getCollection('tokens');

    // Crear índices
    await tokensCollection.createIndex({ userId: 1 });
    await tokensCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'tokens',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['userId', 'hash', 'createdAt', 'expiresAt'],
            properties: {
              userId: { bsonType: 'objectId' },
              hash: { bsonType: 'string' },
              deviceInfo: { bsonType: 'string' },
              ip: { bsonType: 'string' },
              createdAt: { bsonType: 'date' },
              expiresAt: { bsonType: 'date' },
              revoked: { bsonType: 'bool' }
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de tokens:', error.message);
    }
  }

  /**
   * Configura la colección de trabajos de exportación con índices y validaciones.
   */
  async setupExportsJobsCollection() {
    const exportsJobsCollection = this.getCollection('exports_jobs');

    // Crear índices
    await exportsJobsCollection.createIndex({ userId: 1 });
    await exportsJobsCollection.createIndex({ status: 1 });
    await exportsJobsCollection.createIndex({ createdAt: 1 });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'exports_jobs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['userId', 'status', 'createdAt'],
            properties: {
              userId: { bsonType: 'objectId' },
              status: { enum: ['pending', 'processing', 'done', 'failed'] },
              url: { bsonType: ['string', 'null'] },
              createdAt: { bsonType: 'date' },
              completedAt: { bsonType: 'date' },
              meta: { bsonType: 'object' }
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de exports_jobs:', error.message);
    }
  }

  /**
   * Configura la colección de logs de auditoría (opcional) con índices.
   */
  async setupAuditLogsCollection() {
    const auditLogsCollection = this.getCollection('audit_logs');

    // Crear índices
    await auditLogsCollection.createIndex({ actorId: 1 });
    await auditLogsCollection.createIndex({ targetType: 1, targetId: 1 });
    await auditLogsCollection.createIndex({ createdAt: -1 });

    // Validación de esquema
    try {
      await this.db.command({
        collMod: 'audit_logs',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['actorId', 'action', 'createdAt'],
            properties: {
              actorId: { bsonType: 'objectId' },
              action: { bsonType: 'string' },
              targetType: { bsonType: 'string' },
              targetId: { bsonType: ['objectId', 'string'] },
              details: { bsonType: 'object' },
              createdAt: { bsonType: 'date' }
            }
          }
        }
      });
    } catch (error) {
      console.log('Nota: Error al configurar el esquema de audit_logs:', error.message);
    }
  }

  /**
   * Ejemplo de operación transaccional: Crear reseña y actualizar rating.
   */
  async createReviewWithTransaction(reviewData) {
    const session = this.client.startSession();

    try {
      return await session.withTransaction(async () => {
        const reviewsCollection = this.getCollection('reviews');
        const result = await reviewsCollection.insertOne(reviewData, { session });

        const titlesCollection = this.getCollection('titles');
        const titleReviews = await reviewsCollection.find(
          { titleId: reviewData.titleId },
          { session }
        ).toArray();

        const totalScore = titleReviews.reduce((sum, review) => sum + review.score, 0);
        const ratingAvg = totalScore / titleReviews.length;
        const ratingCount = titleReviews.length;

        await titlesCollection.updateOne(
          { _id: reviewData.titleId },
          { 
            $set: { 
              ratingAvg: parseFloat(ratingAvg.toFixed(1)),
              ratingCount,
              updatedAt: new Date()
            }
          },
          { session }
        );

        return result;
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Actualizar una reseña y recalcular el rating (transaccional).
   */
  async updateReviewWithTransaction(reviewId, updates) {
    const session = this.client.startSession();

    try {
      return await session.withTransaction(async () => {
        const reviewsCollection = this.getCollection('reviews');
        const titlesCollection = this.getCollection('titles');

        const currentReview = await reviewsCollection.findOne(
          { _id: new ObjectId(reviewId) },
          { session }
        );

        if (!currentReview) {
          throw new Error('Reseña no encontrada');
        }

        const result = await reviewsCollection.updateOne(
          { _id: new ObjectId(reviewId) },
          { $set: { ...updates, updatedAt: new Date() } },
          { session }
        );

        if (updates.score && updates.score !== currentReview.score) {
          const titleReviews = await reviewsCollection.find(
            { titleId: currentReview.titleId },
            { session }
          ).toArray();

          const totalScore = titleReviews.reduce((sum, review) => {
            return sum + (review._id.toString() === reviewId ? updates.score : review.score);
          }, 0);

          const ratingAvg = totalScore / titleReviews.length;
          const ratingCount = titleReviews.length;

          await titlesCollection.updateOne(
            { _id: currentReview.titleId },
            { 
              $set: { 
                ratingAvg: parseFloat(ratingAvg.toFixed(1)),
                ratingCount,
                updatedAt: new Date()
              }
            },
            { session }
          );
        }

        return result;
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Eliminar una reseña y recalcular el rating (transaccional).
   */
  async deleteReviewWithTransaction(reviewId) {
    const session = this.client.startSession();

    try {
      return await session.withTransaction(async () => {
        const reviewsCollection = this.getCollection('reviews');
        const titlesCollection = this.getCollection('titles');

        const reviewToDelete = await reviewsCollection.findOne(
          { _id: new ObjectId(reviewId) },
          { session }
        );

        if (!reviewToDelete) {
          throw new Error('Reseña no encontrada');
        }

        await reviewsCollection.deleteOne(
          { _id: new ObjectId(reviewId) },
          { session }
        );

        const titleReviews = await reviewsCollection.find(
          { titleId: reviewToDelete.titleId },
          { session }
        ).toArray();

        let ratingAvg = 0;
        let ratingCount = titleReviews.length;

        if (ratingCount > 0) {
          const totalScore = titleReviews.reduce((sum, review) => sum + review.score, 0);
          ratingAvg = totalScore / ratingCount;
        }

        await titlesCollection.updateOne(
          { _id: reviewToDelete.titleId },
          { 
            $set: { 
              ratingAvg: parseFloat(ratingAvg.toFixed(1)),
              ratingCount,
              updatedAt: new Date()
            }
          },
          { session }
        );

        return { deletedCount: 1 };
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * Devuelve un usuario buscado por su email.
   * @param {string} email 
   * @returns {Object|null}
   */
  async getUserByEmail(email) {
    return await this.getCollection('users').findOne({ email: email.toLowerCase() });
  }

  /**
   * Crea un usuario en la colección "users".
   */
  async createUser(userData) {
    const usersCollection = this.getCollection('users');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(userData.password, saltRounds);

    const userDocument = {
      email: userData.email.toLowerCase(),
      passwordHash,
      role: userData.role || 'user',
      name: userData.name || '',
      phone: userData.phone || null,
      country: userData.country || null,
      avatarUrl: userData.avatarUrl || null,
      createdAt: new Date(),
      lastLoginAt: null,
      banned: false,
      preferences: {
        marketingEmails: userData.preferences?.marketingEmails || false,
        personalizedRecs: userData.preferences?.personalizedRecs || true,
        shareAnonymized: userData.preferences?.shareAnonymized || false,
        dataRetentionMonths: userData.preferences?.dataRetentionMonths || null
      },
      lists: []
    };

    return await usersCollection.insertOne(userDocument);
  }

  /**
   * Busca títulos aplicando filtros y paginación.
   */
  async searchTitles(query, filters = {}) {
    const titlesCollection = this.getCollection('titles');
    const searchFilter = { status: 'approved' };

    if (query) {
      searchFilter.$text = { $search: query };
    }

    if (filters.type) searchFilter.type = filters.type;
    if (filters.genres && filters.genres.length > 0) {
      searchFilter.genres = { $in: filters.genres };
    }
    if (filters.year) searchFilter.year = filters.year;

    const options = {
      limit: filters.limit || 20,
      skip: filters.skip || 0,
      sort: query ? { score: { $meta: 'textScore' } } : { createdAt: -1 }
    };

    return await titlesCollection.find(searchFilter, options).toArray();
  }
}

// Exportar una instancia única (singleton)
const database = new Database();
export default database;