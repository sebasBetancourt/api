import { Router } from "express";
import CategoriesController from "../controllers/controllerCategories.js";
import {categoriesValidator} from "../middleware/validators/categoriesValidator.js";

const router = Router();
const categoriesController = new CategoriesController();

router.post("/create", categoriesValidator, categoriesController.create);

router.get("/list", categoriesController.list);

router.get("/:id", categoriesController.getById);

router.get("/name/:name", categoriesController.getByName);

router.delete("/:id", categoriesController.delete);

export default router;
