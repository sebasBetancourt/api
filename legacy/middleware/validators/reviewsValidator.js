import { body } from "express-validator";
import { validatorFieldsDTO } from "../validatorFieldsDTO.js";

export const reviewsValidator = [
  body("title")
    .notEmpty().withMessage("El titulo es obligatorio")
    .isLength({ min: 1, max: 100 }).withMessage("El titulo debe ser entre 1 y 100 caracteres."),
  body("titleId")
    .notEmpty().withMessage("El ID del título es obligatorio")
    .isMongoId().withMessage("El ID del título debe ser un ObjectId válido"),

  body("score")
    .notEmpty().withMessage("La calificación es obligatoria")
    .isInt({ min: 1, max: 5 }).withMessage("La calificación debe ser un número entero entre 1 y 5"),

  body("comment")
    .optional()
    .isString().withMessage("El comentario debe ser texto")
    .isLength({ max: 500 }).withMessage("El comentario no puede superar los 500 caracteres"),

  validatorFieldsDTO
];
