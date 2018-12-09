import { log } from "util";
import { Request, Response, Application } from "express";
import App from "./server/app";

const PORT: number = parseInt(process.env.PORT, 2) || 420;

const app: App = new App(__dirname);

app.app.listen(PORT, () => {
  log("Express server listening on port " + PORT);
});

/*
https://itnext.io/building-restful-web-apis-with-node-js-express-mongodb-and-typescript-part-2-98c34e3513a2
https://itnext.io/building-restful-web-apis-with-node-js-express-mongodb-and-typescript-part-3-d545b243541e
https://itnext.io/building-restful-web-apis-with-node-js-express-mongodb-and-typescript-part-4-954c8c059cd4
https://itnext.io/building-restful-web-apis-with-node-js-express-mongodb-and-typescript-part-5-a80e5a7f03db

https://www.typescriptlang.org/docs/handbook/basic-types.html
http://docs.sequelizejs.com/
https://medium.freecodecamp.org/a-comparison-of-the-top-orms-for-2018-19c4feeaa5f
*/
