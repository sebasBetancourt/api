import { body } from "express-validator";
import { validatorFieldsDTO } from "../validatorFieldsDTO.js";

export const titleValidator = [
  body("title")
    .notEmpty().withMessage("El título es obligatorio")
    .isString().withMessage("El título debe ser texto")
    .isLength({ min: 1, max: 100 }).withMessage("El título debe tener entre 1 y 100 caracteres"),
  
  body("description")
    .notEmpty().withMessage("La descripción es obligatoria")
    .isString().withMessage("La descripción debe ser texto")
    .isLength({ max: 500 }).withMessage("La descripción no debe exceder los 500 caracteres"),
  
  body("type")
    .notEmpty().withMessage("El tipo es obligatorio")
    .isIn(["movie", "tv", "anime"]).withMessage("El tipo debe ser movie, tv o anime"),

  body("temps")
    .optional()
    .isInt({ min: 1 }).withMessage("La cantidad de temporadas debe ser un número entero"),

  body("eps")
    .optional()
    .isInt({ min: 1 }).withMessage("La cantidad de episodios debe ser un número entero"),

  body("year")
    .notEmpty().withMessage("El año es obligatorio")
    .isInt({ min: 1800, max: new Date().getFullYear() }).withMessage(`El año debe estar entre 1800 y ${new Date().getFullYear()}`),

  body("categoriesIds")
    .notEmpty().withMessage("Las categorias son obligatorias")
    .isArray({ min: 1 }).withMessage("Debe proporcionar al menos una categoría"),

  body("author")
    .notEmpty().withMessage("El autor es obligatorio")
    .isString().withMessage("El autor debe ser texto")
    .isLength({ min: 1, max: 100 }).withMessage("El autor no debe exceder los 100 caracteres"),

  validatorFieldsDTO
  ];
