import database from "../config/database.js";
import config from "../config/config.js";


export async function startServer(app) {
  try {
    // Conectar a la base de datos
    await database.connect(config.mongodb.uri , config.mongodb.dbName);
    console.log('Base de datos conectada correctamente');
    
    // Iniciar servidor
    app.listen(config.port, () => {
      console.log(`Servidor ejecutándose en http://localhost:${config.port}`);
      console.log(`Documentación API disponible en http://localhost:${config.port}/api-docs`);
      console.log(`Health check disponible en http://localhost:${config.port}/health`);
      console.log(`Modo: ${config.environment}`);
    });
    
    // Manejo graceful de shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\nRecibido ${signal}, cerrando servidor gracefulmente...`);
      
      // Cerrar servidor
      process.exit(0);
    };
    
    // Manejadores para señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('Error iniciando servidor:', error);
    process.exit(1);
  }
}


