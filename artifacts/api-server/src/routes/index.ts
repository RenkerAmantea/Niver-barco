import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guestsRouter from "./guests";
import postsRouter from "./posts";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(guestsRouter);
router.use(postsRouter);
router.use(statsRouter);

export default router;
