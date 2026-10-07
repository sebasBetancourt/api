import { Router } from "express";
import {
  Health,
  listCollections,
  testOperations,
  statsDB,
  testConnectionDB
} from "../controllers/controllerTest.js"


const router = Router();


//endpoints de Test

router.get('/health', Health);
router.get('/test/collections', listCollections);
router.get('/test/db-operations', testOperations);
router.get('/test/db-stats', statsDB);
router.get('/test-db', testConnectionDB);




export default router;