import express from "express";
import passport from "passport";

const router = express.Router();

router.get(
  "/profile",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    res.json({
      message: "Perfil del usuario",
      user: {
        id: req.user._id,
        email: req.user.email,
      },
    });
  }
);

export default router;

