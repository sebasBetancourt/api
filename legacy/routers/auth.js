import { Router } from 'express';
import AuthController from '../controllers/controllerAuth.js';
import { registerValidator, loginValidator } from '../middleware/validators/userValidator.js';

const router = Router();
const authController = new AuthController();

router.post('/register', registerValidator, authController.register);
router.post('/login', loginValidator, authController.login);
router.get("/verify", authController.verify, (req, res) => {
  res.json({ message: "Token válido", user: req.user });
});

export default router;