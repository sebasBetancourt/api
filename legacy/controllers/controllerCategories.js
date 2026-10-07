import CategoriesModel from '../models/classes/CategoriesModel.js';
import CategoriesDTO from '../models/dto/CategoriesDTO.js';



export class CategoriesController {


  async create(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo los administradores pueden crear categorias' });
      }

      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Faltan campos obligatorios, Nombre de la categoria' });
      }


      const existingCategoria = await CategoriesModel.findByName(name);
      if (existingCategoria) {
        console.log('Categoria ya existe:', title);
        return res.status(400).json({ message: 'La categoria ya existe, escoge otro nombre' });
      }


      const categor = await CategoriesDTO.createFromDataCategories({
          name,
          createdAt: new Date()
        }); 

      console.log('Creando Categoria:', categor);
      await CategoriesModel.create(categor);
      console.log(id);
      res.status(201).json({ message: 'Categoria creada exitosamente', categor });
    } catch (err) {
      res.status(500).json({ message: 'Error al crear categoria', error: err.message });
    }
  }

  async list(req, res) {
    try {
      const { skip, limit } = req.query;
      const Categorias = await CategoriesModel.findAll(
        parseInt(skip) || 0,
        parseInt(limit) || 10
      );
      res.json(Categorias);
    } catch (err) {
      res.status(500).json({ message: 'Error al listar Categorias', error: err.message });
    }
  }
  async getById(req, res) {
    try {
      const { id } = req.params;
      const name = await CategoriesModel.findById(id);
    
      if (!name) return res.status(404).json({ message: "Categoria no encontrada" });
      res.json(name);
    } catch (err) {
      res.status(500).json({ message: "Error al obtener categoria", error: err.message });
    }
  }

  async getByName(req, res) {
    try {
      const { name } = req.params;
      const nombre = await CategoriesModel.findByName(name);
    
      if (!nombre) return res.status(404).json({ message: "Categoria no encontrada" });
      res.json(nombre);
    } catch (err) {
      res.status(500).json({ message: "Error al obtener categoria", error: err.message });
    }
  }

  async delete(req, res) {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Solo los administradores pueden eliminar Categorias' });
      }

      const deleted = await CategoriesModel.delete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Categoria no encontrada' });

      res.json({ message: 'Categoria eliminada' });
    } catch (err) {
      res.status(500).json({ message: 'Error al eliminar categoria', error: err.message });
    }
  }
}

export default CategoriesController;
