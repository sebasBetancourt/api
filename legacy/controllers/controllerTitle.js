import TitleModel from '../models/classes/titleModel.js';
import database from '../config/database.js';
import { ObjectId } from 'mongodb';


const db = database.db;

export class TitleController {


  async create(req, res) {
    try {
      const { title, description, type, year, categoriesIds, posterUrl, author, temps, eps } = req.body;

      // Validación de campos obligatorios
      if (!title || !type || !description || !year || !categoriesIds || !author) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
      } 

      // Revisar si ya existe el título
      const existingTitle = await TitleModel.findByName(title);
      if (existingTitle) {
        console.log('Título ya existe:', title);
        return res.status(400).json({ message: 'El título ya existe, escoge otro nombre' });
      }

      // Preparar datos comunes
      const titleData = {
        title,
        description,
        type,
        year,
        createdBy: new ObjectId(req.user._id),
        categoriesIds: categoriesIds.map(id => new ObjectId(id)),
        posterUrl: posterUrl || "",
        author,
        createdAt: new Date(),
        likes: 0,
        dislikes: 0,
        ratingAvg: 0,
        ratingCount: 0,
        status: "pending"
      };

      // Agregar campos extra según tipo
      if (type === 'tv' || type === 'anime') {
        titleData.temps = temps || 1;
        titleData.eps = eps || 1;
      }

      // Insertar en DB
      const insertedId = await TitleModel.create(titleData);
      console.log('Creando título:', insertedId);

      // Responder
      res.status(201).json({ message: 'Título creado exitosamente', id: insertedId });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error al crear título', error: err.message });
    }
  }


  async list(req, res) {
    try {
      const { skip = 0, limit = 30, categoriesId = null, type = null, search = null } = req.query;

      const titles = await TitleModel.findAll({
        skip: parseInt(skip),
        limit: parseInt(limit),
        categoryId: categoriesId,
        type,
        search: search ? search.trim() : null
      });

      res.json(titles);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error al listar títulos', error: err.message });
    }
  }


  async listColeccion(req, res) {
    try {
      const { skip = 0, limit = 30, type } = req.query;

      const titles = await TitleModel.findTitlesInUserLists({
        userId: new ObjectId(req.user._id),
        skip: parseInt(skip),
        limit: parseInt(limit),
        type
      });

      res.json(titles);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error al listar títulos de mi lista', error: err.message });
    }
  }



  async getById(req, res) {
    try {
      const { id } = req.params;
      const title = await TitleModel.findById(id);
    
      if (!title) return res.status(404).json({ message: "Título no encontrado" });
      res.json(title);
    } catch (err) {
      res.status(500).json({ message: "Error al obtener título", error: err.message });
    }
  }
  async detail(req, res) {
    try {
      const title = await TitleModel.findById(req.params.id);
      if (!title) return res.status(404).json({ message: 'Título no encontrado' });
      res.json(title);
    } catch (err) {
      res.status(500).json({ message: 'Error al obtener título', error: err.message });
    }
  }

  async approve(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo los administradores pueden aprobar títulos' });
      }

      const updated = await TitleModel.update(req.params.id, { status: 'approved' });
      if (!updated) return res.status(404).json({ message: 'Título no encontrado' });

      res.json({ message: 'Título aprobado' });
    } catch (err) {
      res.status(500).json({ message: 'Error al aprobar título', error: err.message });
    }
  }

  async delete(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo los administradores pueden eliminar títulos' });
      }

      const deleted = await TitleModel.delete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Título no encontrado' });

      res.json({ message: 'Título eliminado' });
    } catch (err) {
      res.status(500).json({ message: 'Error al eliminar título', error: err.message });
    }
  }
}

export default TitleController;
