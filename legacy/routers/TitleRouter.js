import { Router } from "express";
import TitleController from "../controllers/controllerTitle.js";
import { titleValidator } from "../middleware/validators/titlesValidator.js";
import AuthController from "../controllers/controllerAuth.js";

const router = Router();
const titleController = new TitleController();
const authController = new AuthController();

router.post("/create", authController.verify, titleValidator, titleController.create);

router.get("/list", titleController.list);

router.get("/:id", titleController.getById);

router.get("/list/collection", authController.verify,titleController.listColeccion);

export default router;
