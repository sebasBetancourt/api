import database from "../config/database.js";

export const Health = async function (req, res) {
    try {
      const adminDb = database.client.db().admin();
      const serverStatus = await adminDb.serverStatus();
      const dbStats = await database.db.stats();
      
      res.status(200).json({ 
        status: 'OK', 
        database: {
          connected: database.isConnected,
          host: serverStatus.host,
          version: serverStatus.version,
          db: dbStats.db,
          collections: dbStats.collections,
          objects: dbStats.objects
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'ERROR', 
        database: {
          connected: false,
          error: error.message
        }
      });
    }
};

export const listCollections = async function (req, res) {
    try {
        const collections = await database.db.listCollections().toArray();
        res.json({
          success: true,
          collections: collections.map(col => col.name)
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
        }
}

export const testOperations = async function (req, res){
    try {
        const testCollection = database.db.collection('test_connection');
        
        // Crear documento
        const insertResult = await testCollection.insertOne({
          test: 'Conexión exitosa',
          timestamp: new Date(),
          randomId: Math.random().toString(36).substring(7)
        });
        
        // Leer documento
        const document = await testCollection.findOne({ _id: insertResult.insertedId });
        
        // Contar documentos
        const count = await testCollection.countDocuments();
        
        // Limpiar prueba
        await testCollection.deleteMany({ test: 'Conexión exitosa' });
        
        
        res.json({
          success: true,
          operations: {
            insert: insertResult.acknowledged,
            read: document !== null,
            count: count,
            delete: true
          },
          document: document
          
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
}


export const statsDB = async function (req, res){
    try {
        const stats = await database.db.stats();
        res.json({
          success: true,
          stats: {
            db: stats.db,
            collections: stats.collections,
            views: stats.views,
            objects: stats.objects,
            avgObjSize: stats.avgObjSize,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes,
            indexSize: stats.indexSize
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error.message
        });
      } 
};

export const testConnectionDB = async function (req, res){
    try {
        const usersCollection = database.getCollection('users');
        const userCount = await usersCollection.countDocuments();
        
        res.json({
          database: database.isConnected ? 'connected' : 'disconnected',
          userCount: userCount,
          message: 'Conexión a la base de datos verificada correctamente'
        });
      } catch (error) {
        res.status(500).json({
          error: 'Error conectando a la base de datos',
          details: error.message
        });
      } 
};