// backend/generateHash.js
import bcrypt from 'bcrypt';

const password = 'admin123'; // Contraseña temporal para el admin
bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error al generar hash:', err);
    return;
  }
  console.log('Hash generado:', hash);
});