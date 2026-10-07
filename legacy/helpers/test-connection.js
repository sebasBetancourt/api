// test-connection.js
import dotenv from 'dotenv';
dotenv.config();
import database from '../config/database.js';

async function testConnection() {
  try {
    console.log('🔌 Probando conexión a MongoDB Atlas...');
    
    await database.connect(process.env.MONGODB_URI, process.env.DB_NAME);
    
    console.log('✅ Conexión exitosa!');
    console.log('📊 Realizando operaciones de prueba...');
    
    // Prueba una operación simple
    const usersCollection = database.getCollection('users');
    const count = await usersCollection.countDocuments();
    console.log(`👥 Usuarios en la base de datos: ${count}`);
    
    // Listar colecciones
    const collections = await database.db.listCollections().toArray();
    console.log('📋 Colecciones encontradas:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    await database.disconnect();
    console.log('✅ Todas las pruebas pasaron!');
    
  } catch (error) {
    console.error('❌ Error en la prueba:');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();