import database from '../../config/database.js';
import { ObjectId } from 'mongodb';
import UserDTO from '../dto/UserDTO.js';

class UserModel {
  static collectionName = 'users';

  static getDb() {
    if (!database.isConnected || !database.db) {
      throw new Error('Base de datos no inicializada. Asegúrate de llamar a database.connect() primero.');
    }
    return database.db;
  }

  static async create(userData) {
    try {
      console.log(userData);
      console.log(typeof(userData));
      const result = await this.getDb().collection(this.collectionName).insertOne(userData);
      return result.insertedId;
    } catch (err) {
      throw new Error(`Error al crear usuario: ${err.message}`);
    }
  }

  static async findByEmail(email) {
    try {
      return await this.getDb().collection(this.collectionName).findOne({ email: email.toLowerCase() });
    } catch (err) {
      throw new Error(`Error al buscar usuario por email: ${err.message}`);
    }
  }

  static async findById(id) {
    try {
      return await this.getDb().collection(this.collectionName).findOne({ _id: new ObjectId(id) });
    } catch (error) {
      throw new Error('Formato de ID inválido');
    }
  }

  static async update(id, updateData) {
    try {
      updateData.lastLoginAt = new Date();
      const result = await this.getDb().collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      return result.modifiedCount;
    } catch (error) {
      throw new Error('Formato de ID inválido');
    }
  }

  static async delete(id) {
    try {
      const result = await this.getDb().collection(this.collectionName).deleteOne({
        _id: new ObjectId(id)
      });
      return result.deletedCount;
    } catch (error) {
      throw new Error('Formato de ID inválido');
    }
  }

  static async findAll(skip = 0, limit = 10) {
    try {
      return await this.getDb().collection(this.collectionName)
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
    } catch (err) {
      throw new Error(`Error al listar usuarios: ${err.message}`);
    }
  }
}

export default UserModel;