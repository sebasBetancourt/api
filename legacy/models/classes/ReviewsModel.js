import database from '../../config/database.js';
import { ObjectId } from 'mongodb';

class ReviewModel {
  static collectionName = 'reviews';

  static getDb() {
    if (!database.isConnected || !database.db) {
      throw new Error('Base de datos no inicializada. Asegúrate de llamar a database.connect() primero.');
    }
    return database.db;
  }

  static async create(reviewData) {
    try {
      const result = await this.getDb().collection(this.collectionName).insertOne(reviewData);
      return result.insertedId;
    } catch (err) {
      throw new Error(`Error al crear reseña: ${err.message}`);
    }
  }

  static async findById(id) {
    try {
      const pipeline = [
        { $match: { _id: new ObjectId(id) } },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $lookup: {
            from: "titles",
            localField: "titleId",
            foreignField: "_id",
            as: "titleCategory"
          }
        },
        {
          $project: {
            _id: 1,
            comment: 1,
            title: 1,
            score: 1,
            likesCount: 1,
            dislikesCount: 1,
            createdAt: 1,
            user: { $arrayElemAt: ["$user", 0] },
            titleCategory: { $arrayElemAt: ["$titleCategory", 0] }
          }
        }
      ];

      return await this.getDb().collection(this.collectionName)
        .aggregate(pipeline).next();
    } catch (err) {
      throw new Error(`Error al obtener reseña: ${err.message}`);
    }
  }

  static async findAll({ skip = 0, limit = 10, titleId = null, userId = null } = {}) {
    try {
      const pipeline = [];
      const match = {};
    
      if (titleId) match.titleId = new ObjectId(titleId);
      if (userId) match.userId = new ObjectId(userId);
    
      pipeline.push({ $match: match });
    
      pipeline.push({
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      });
    
      pipeline.push({
        $lookup: {
          from: "titles",
          localField: "titleId",
          foreignField: "_id",
          as: "titleDoc"
        }
      });
    
      pipeline.push({
        $project: {
          _id: 1,
          title: 1,
          comment: 1,
          score: 1,
          likesCount: 1,
          dislikesCount: 1,
          createdAt: 1,
          userId: 1,
          user: {
            name: { $arrayElemAt: ["$user.name", 0] },
            email: { $arrayElemAt: ["$user.email", 0] }
          },
          titleName: { $arrayElemAt: ["$titleDoc.title", 0] }
        }
      });
    
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
    
      return await this.getDb()
        .collection(this.collectionName)
        .aggregate(pipeline)
        .toArray();
    } catch (err) {
      throw new Error(`Error al listar reseñas: ${err.message}`);
    }
  }


  static async update(id, updateData) {
    try {
      const allowed = {};
      if (updateData.comment) allowed.comment = updateData.comment;
      if (updateData.score) allowed.score = updateData.score;

      const result = await this.getDb().collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $set: allowed }
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

  static async like(id) {
    try {
      const result = await this.getDb().collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $inc: { likesCount: 1 } }
      );
      return result.modifiedCount;
    } catch (err) {
      throw new Error(`Error al dar like: ${err.message}`);
    }
  }

  static async dislike(id) {
    try {
      const result = await this.getDb().collection(this.collectionName).updateOne(
        { _id: new ObjectId(id) },
        { $inc: { dislikesCount: 1 } }
      );
      return result.modifiedCount;
    } catch (err) {
      throw new Error(`Error al dar dislike: ${err.message}`);
    }
  }

  static async calculateRanking(titleId) {
    try {
      const reviews = await this.getDb().collection(this.collectionName).find({ titleId: new ObjectId(titleId) }).toArray();

      if (reviews.length === 0) return 0;

      const now = new Date();
      let total = 0;

      reviews.forEach(r => {
        const ageInDays = (now - r.createdAt) / (1000 * 60 * 60 * 24);
        const decay = Math.max(0.5, 1 - ageInDays / 365); 
        const interactionFactor = 1 + (r.likesCount - r.dislikesCount) * 0.01;
        total += r.score * decay * interactionFactor;
      });

      return total / reviews.length;
    } catch (err) {
      throw new Error(`Error al calcular ranking: ${err.message}`);
    }
  }

  static async generateCSV({ titleId = null } = {}) {
    try {
      const pipeline = [];
      const match = {};
    
      if (titleId) match.titleId = new ObjectId(titleId);
    
      pipeline.push({ $match: match });
    
      pipeline.push({
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      });
    
      pipeline.push({
        $lookup: {
          from: "titles",
          localField: "titleId",
          foreignField: "_id",
          as: "titleDoc"
        }
      });
    
      pipeline.push({
        $project: {
          _id: 1,
          title: 1,
          comment: 1,
          score: 1,
          createdAt: 1,
          userId: 1,
          user: {
            name: { $arrayElemAt: ["$user.name", 0] },
            email: { $arrayElemAt: ["$user.email", 0] }
          },
          titleName: { $arrayElemAt: ["$titleDoc.title", 0] }
        }
      });
    
    
      return await this.getDb()
        .collection(this.collectionName)
        .aggregate(pipeline)
        .toArray();
    } catch (err) {
      throw new Error(`Error al generar CSV reseñas: ${err.message}`);
    }
  }

}

export default ReviewModel;
