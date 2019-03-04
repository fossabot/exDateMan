import { Request, Response, Router, NextFunction } from "express";
import { log } from "util";

import authRoutes from "./authRoutes";
import inventoriesRoutes from "./inventoriesRoutes";
import AuthController from "../../../controllers/authController";

const v1Routes: Router = Router();

// Default welcome message
v1Routes.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Connected to ExDateMan API version 1"
  });
});

// Authenticate and use the inventories routes
v1Routes.use("/inv", AuthController.authenticate, inventoriesRoutes);

// Use authentication routes
v1Routes.use("/auth", AuthController.authenticate, authRoutes);

export default v1Routes;
