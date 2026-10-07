import ReviewModel from '../models/classes/ReviewsModel.js';
import ReviewDTO from '../models/dto/ReviewsDTO.js';
import database from '../config/database.js';
import { ObjectId } from 'mongodb';
import fs from "fs/promises"

const db = database.db;

export class ReviewController {
  async create(req, res) {
    try {
      const { title, comment, score, titleId } = req.body;

      const reviewData = {
        title,
        comment,
        score,
        titleId: new ObjectId(titleId),
        userId: new ObjectId(req.user._id),
      };

      const reviewDTO = ReviewDTO.createFromData(reviewData);

      const newReview = await ReviewModel.create(reviewDTO);
      res.status(201).json(newReview);
    } catch (err) {
      res.status(500).json({ message: "Error al crear reseña", error: err.message });
    }
  }



  async list(req, res) {
    try {
      const { skip = 0, limit = 10, titleId = null, userId = null } = req.query;

      const reviews = await ReviewModel.findAll({
        skip: parseInt(skip),
        limit: parseInt(limit),
        titleId,
        userId
      });

      res.json(reviews);
    } catch (err) {
      res.status(500).json({ message: "Error al listar reseñas", error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const review = await ReviewModel.findById(id);

      if (!review) return res.status(404).json({ message: "Reseña no encontrada" });
      res.json(review);
    } catch (err) {
      res.status(500).json({ message: "Error al obtener reseña", error: err.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { comment, score } = req.body;

      const review = await ReviewModel.findById(id);
      if (!review) return res.status(404).json({ message: "Reseña no encontrada" });

      if (
        req.user.role !== "admin" &&
        review.userId.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: "No tienes permiso para editar esta reseña" });
      }

      const updateData = {};
      if (comment) updateData.comment = comment;
      if (score) {
        if (score < 1 || score > 5) {
          return res.status(400).json({ message: "La calificación debe estar entre 1 y 5" });
        }
        updateData.score = score;
      }

      const updated = await ReviewModel.update(id, updateData);
      if (!updated) return res.status(400).json({ message: "No se pudo actualizar la reseña" });

      res.json({ message: "Reseña actualizada" });
    } catch (err) {
      res.status(500).json({ message: "Error al actualizar reseña", error: err.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;

      const review = await ReviewModel.findById(id);
      if (!review) return res.status(404).json({ message: "Reseña no encontrada" });

      if (
        req.user.role !== "admin" &&
        review.userId.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: "No tienes permiso para eliminar esta reseña" });
      }

      const deleted = await ReviewModel.delete(id);
      if (!deleted) return res.status(400).json({ message: "No se pudo eliminar la reseña" });

      res.json({ message: "Reseña eliminada" });
    } catch (err) {
      res.status(500).json({ message: "Error al eliminar reseña", error: err.message });
    }
  }

  async like(req, res) {
    try {
      const { id } = req.params;
      const review = await ReviewModel.findById(id);

      if (!review) return res.status(404).json({ message: "Reseña no encontrada" });
      if (review.user.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: "No puedes dar like a tu propia reseña" });
      }

      const updated = await ReviewModel.like(id);

      if (!updated) return res.status(400).json({ message: "No se pudo dar like" });

      res.json({ message: "Like registrado" });
    } catch (err) {
      res.status(500).json({ message: "Error al dar like", error: err.message });
    }
  }

  async dislike(req, res) {
    try {
      const { id } = req.params;
      const review = await ReviewModel.findById(id);

      if (!review) return res.status(404).json({ message: "Reseña no encontrada" });
      if (review.user.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: "No puedes dar dislike a tu propia reseña" });
      }

      const updated = await ReviewModel.dislike(id);

      if (!updated) return res.status(400).json({ message: "No se pudo dar dislike" });

      res.json({ message: "Dislike registrado" });
    } catch (err) {
      res.status(500).json({ message: "Error al dar dislike", error: err.message });
    }
  }
  static async calculateRanking(req, res) {
    try {
      const { titleId } = req.params;
      const ranking = await ReviewModel.calculateRanking(titleId);
      res.json({ titleId, ranking });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }


  async generateCSV(req, res) {
    try {
      const { titleId = null} = req.query;

      const reviews = await ReviewModel.generateCSV({
        titleId
      });

      const ruta = '../exports/reviews.json';

      async function esribir(ruta, reviews) {
        try {
          await fs.writeFileSync(ruta, JSON.stringify(reviews, null, 2));
          console.log("Hecho");
          
        } catch (error) {
          throw new Error("Eror al crear CSV");
          
        }
      }

      esribir(ruta, reviews);

      res.status(200)({ message: "CSV generado exitosamente" });
      res.json(reviews)
    } catch (err) {
      res.status(500).json({ message: "Error al listar reseñas", error: err.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const review = await ReviewModel.findById(id);

      if (!review) return res.status(404).json({ message: "Reseña no encontrada" });
      res.json(review);
    } catch (err) {
      res.status(500).json({ message: "Error al obtener reseña", error: err.message });
    }
  }

}

export default ReviewController;
