import { Request, Response, Router, NextFunction } from "express";
import { log } from "util";
import * as jwt from "express-jwt";

import v1Routes from "./v1/v1Routes";

const apiRoutes: Router = Router();

// Simple welcome message
apiRoutes.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to the ExDateMan API!"
  });
});

apiRoutes.use("/v1", v1Routes);

export default apiRoutes;
