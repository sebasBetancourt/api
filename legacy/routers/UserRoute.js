import { Router } from "express";
import database from "../config/database.js"
import { ObjectId } from "bson";


const router = Router();


router.get("/list", async function (req, res) {
  try {
    const usuarios = await database.db.collection("usuarios").find().toArray();
    res.status(200).json(usuarios);
  } catch (error) {
    res.error(500).json({ error: "Internal server error" });
  }
});



router.get("/get/:id", async function (req, res) {
  try {
    const idUsuario = parseInt(req.params.id);
    const usuario = await database.db
      .collection("usuarios")
      .findOne({ id: idUsuario });
    if (!usuario) {
      res.status(404).json({ error: "Usuario doesn't exists!" });
    }
    res.status(200).json(usuario);
  } catch (er) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
