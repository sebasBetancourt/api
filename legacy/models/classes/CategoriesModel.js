import database from '../../config/database.js';
import { ObjectId } from 'mongodb';

class CategoriesModel {
  static collectionName = 'categories';

  static getDb() {
    if (!database.isConnected || !database.db) {
      throw new Error('Base de datos no inicializada. Asegúrate de llamar a database.connect() primero.');
    }
    return database.db;
  }

  static async create(categoriesData) {
    try {
      console.log(categoriesData);
      console.log(typeof(categoriesData));
      const result = await this.getDb().collection(this.collectionName).insertOne(categoriesData);
      return result.insertedId;
    } catch (err) {
      throw new Error(`Error al crear categoria: ${err.message}`);
    }
  }

  static async findById(id) {
    try {
      return await this.getDb().collection(this.collectionName).findOne({ _id: new ObjectId(id) });
    } catch (error) {
      throw new Error('Formato de ID inválido');
    }
  }
  static async findByName(name) {
    try {
      return await this.getDb().collection(this.collectionName).findOne({ name: name });
    } catch (error) {
      throw new Error('Formato de Name inválido');
    }
  }

  static async update(id, updateData) {
    try {
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
      throw new Error(`Error al listar Categorias: ${err.message}`);
    }
  }
}

export default CategoriesModel;