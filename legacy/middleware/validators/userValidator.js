import { body } from 'express-validator';
import { validatorFieldsDTO } from '../validatorFieldsDTO.js';

export const registerValidator = [
  body('email').isEmail().withMessage('El email no es válido').trim().toLowerCase(),
  body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
  body('name').optional().isString().withMessage('El nombre debe ser un string'),
  body('phone').optional().isString().withMessage('El teléfono debe ser un string'),
  body('country').optional().isString().withMessage('El país debe ser un string'),
  body('avatarUrl').optional().isString().withMessage('El avatarUrl debe ser un string'),
  validatorFieldsDTO
];

export const loginValidator = [
  body('email').isEmail().withMessage('El email no es válido').trim().toLowerCase(),
  body('password').notEmpty().withMessage('La contraseña es requerida'),
  validatorFieldsDTO
];