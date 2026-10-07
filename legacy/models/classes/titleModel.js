import database from '../../config/database.js';
import { ObjectId } from 'mongodb';
import TitleDTO from "../dto/TitleDTO.js"

class TitleModel {
  static collectionName = 'titles';
  static collectionNameUser = 'users';

  static getDb() {
    if (!database.isConnected || !database.db) {
      throw new Error('Base de datos no inicializada. Asegúrate de llamar a database.connect() primero.');
    }
    return database.db;
  }

  static async create(titleData) {
    try {
      const exists = await this.findByName(titleData.title);
      if (exists) throw new Error("Ya existe un título con ese nombre");

      const dto = TitleDTO.fromRequest(titleData);
      console.log(dto);
      
      const result = await this.getDb().collection(this.collectionName).insertOne(dto);
      return result.insertedId;
    } catch (err) {
      throw new Error(`Error al crear título: ${err.message}`);
    }
  }

  static async findById(id) {
    try {
      const pipeline = [
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from: "categories",
            localField: "categoriesIds",
            foreignField: "_id",
            as: "categories"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "creator"
          }
        },
        {
          $project: {
            _id: 1,
            title: 1,
            description: 1,
            type: 1,
            temps: 1,
            eps: 1,
            year: 1,
            createdAt: 1,
            likes: 1,
            dislikes: 1,
            posterUrl: 1,
            embed_url: 1,
            ratingAvg: 1,
            ratingCount: 1,
            status: 1,
            author: 1,
            categories: { $map: { input: "$categories", as: "cat", in: "$$cat.name" } },
            creator: { $arrayElemAt: ["$creator.name", 0] },
            comments: 1
          }
        }
      ];
    
      return await this.getDb().collection(this.collectionName)
        .aggregate(pipeline).next();
    } catch (err) {
      throw new Error(`Error al obtener título: ${err.message}`);
    }
  }

  static async findByName(name) {
    try {
      return await this.getDb().collection(this.collectionName).findOne({ title: name});
    } catch (error) {
      throw new Error('Formato de Nombre inválido');
    }
  }



  static async findAll({ skip = 0, limit = 30, categoryId = null, status = 'approved', type = null, search = null } = {}) {
    try {
      const pipeline = [];
      const match = {};

      if (categoryId) {
        match.categoriesIds = new ObjectId(categoryId); 
      }

      if (status) match.status = status;
      if (type) match.type = type;

      if (search) {
        // Coincidencia parcial (case-insensitive) en el título
        match.title = { $regex: search, $options: 'i' };
      }

      pipeline.push({ $match: match });

      pipeline.push({
        $lookup: {
          from: 'categories',
          localField: 'categoriesIds',
          foreignField: '_id',
          as: 'categories'
        }
      });

      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator'
        }
      });

      pipeline.push({
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          type: 1,
          temps: 1,
          eps: 1,
          year: 1,
          createdAt: 1,
          likes: 1,
          dislikes: 1,
          posterUrl: 1,
          embed_url: 1,
          ratingAvg: 1,
          ratingCount: 1,
          status: 1,
          author: 1,
          categoriesIds: 1,
          createdBy: 1,
          categories: { $map: { input: "$categories", as: "cat", in: "$$cat.name" } },
          creator: { $arrayElemAt: ["$creator.name", 0] }
        }
      });

      // Paginación
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      return await this.getDb().collection(this.collectionName).aggregate(pipeline).toArray();
    } catch (err) {
      throw new Error(`Error al listar todos los títulos: ${err.message}`);
    }
  }


  static async findTitlesInUserLists({ userId, skip = 0, limit = 30, type } = {}) {
  try {
    const pipeline = [];

    // 1️⃣ Filtrar por usuario
    pipeline.push({ $match: { _id: new ObjectId(userId) } });

    // 2️⃣ Traer solo lists
    pipeline.push({ $project: { lists: 1 } });

    // 3️⃣ Desenrollar listas
    pipeline.push({ $unwind: "$lists" });

    // 4️⃣ Lookup para traer info de titles
    pipeline.push({
      $lookup: {
        from: "titles",
        localField: "lists",
        foreignField: "_id",
        as: "titleInfo"
      }
    });

    // 5️⃣ Desenrollar titleInfo
    pipeline.push({ $unwind: "$titleInfo" });

    // 6️⃣ Filtrar por tipo si se pasó
    if (type) {
      pipeline.push({
        $match: { "titleInfo.type": type }
      });
    }

    // 7️⃣ Proyectar campos que quieres mostrar
    pipeline.push({
      $project: {
        _id: "$titleInfo._id",
        title: "$titleInfo.title",
        description: "$titleInfo.description",
        type: "$titleInfo.type",
        temps: "$titleInfo.temps",
        eps: "$titleInfo.eps",
        year: "$titleInfo.year",
        posterUrl: "$titleInfo.posterUrl",
        createdBy: "$titleInfo.createdBy",
        categoriesIds: "$titleInfo.categoriesIds"
      }
    });

    // 8️⃣ Paginación
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    return await this.getDb().collection("users").aggregate(pipeline).toArray();
  } catch (err) {
    throw new Error(`Error al listar títulos en listas de usuario: ${err.message}`);
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
}

export default TitleModel;
