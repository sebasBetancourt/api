import { Router } from "express";
import { ReviewController } from "../controllers/controllerReviews.js";
import { reviewsValidator } from "../middleware/validators/reviewsValidator.js";
import AuthController from "../controllers/controllerAuth.js";

const router = Router();
const reviewController = new ReviewController();
const authController = new AuthController();

router.post("/create", authController.verify, reviewsValidator,reviewController.create);

router.get("/list", reviewController.list);

router.get("/:id", reviewController.getById);

router.put("/:id", authController.verify, reviewsValidator,reviewController.update);

router.delete("/:id", reviewController.delete);

router.put("/like/:id", authController.verify, reviewController.like);

router.put("/dislike/:id", authController.verify, reviewController.dislike);

router.get("/ranking/:titleId", ReviewController.calculateRanking);


router.get("/CSV", reviewController.generateCSV);

export default router;
