import { body } from "express-validator";
import { validatorFieldsDTO } from "../validatorFieldsDTO.js";

export const categoriesValidator = [
  body("name")
    .notEmpty().withMessage("El nombre de la categoria es obligatorio")
    .isString().withMessage("El nombre debe ser texto")
    .isLength({ min: 3, max: 100 }).withMessage("El nombre debe tener entre 3 y 100 caracteres"),
  
  body("createdAt")
    .notEmpty().withMessage("La fecha de creación es obligatoria")
    .isISO8601().withMessage("La fecha de creación debe ser una fecha válida"),
  validatorFieldsDTO
  ];
