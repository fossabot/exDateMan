import { Request, Response, NextFunction } from "express";
import UserController from "./userController";
import * as jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import { User } from "../models/userModel";
import * as expressJwt from "express-jwt";
import { log } from "util";
import { hash, compareSync, hashSync, genSaltSync } from "bcrypt";
import {
  InventoryUserAccessRightsEnum,
  InventoryUser,
  compareInventoryUserAccessRights
} from "../models/inventoryUserModel";
import { Inventory } from "./../models/inventoryModel";
import InventoryController from "./inventoryController";
import { EntityManager, getManager } from "typeorm";
import { totp, generateSecret, GeneratedSecret } from "speakeasy";

/**
 * The private key either as a string or a buffer
 */
const RSA_PRIVATE_KEY: string | Buffer =
  process.env.EDM_RSA_PRIVATE_KEY_VAL ||
  readFileSync(process.env.EDM_RSA_PRIVATE_KEY);

/**
 * The public key either as a string or a buffer
 */
const PUBLIC_KEY: string | Buffer =
  process.env.EDM_PUBLIC_KEY_VAL || readFileSync(process.env.EDM_PUBLIC_KEY);

export default class AuthController {
  /**
   * Generates and adds 2FA TOTP data to a user
   *
   * @param user The actingUser
   */
  static async addNewSecretToUser(user: User): Promise<any> {
    const secret: GeneratedSecret = generateSecret({
      name: "ExDateMan (" + user.email + ")",
      length: 32
    });

    user.tfaSecret = secret.base32;
    user.tfaUrl = secret.otpauth_url;

    // Save the generated result to the db
    await UserController.saveUser(user);
  }

  /**
   * Responds with all non-sensitive user data.
   * If 2FA is disabled and no secret exists, one will be created.
   */
  static async getAuthDetails(req: Request, res: Response): Promise<void> {
    const actingUser: User = res.locals.actingUser;

    // Check if the user has 2FA enabled
    if (actingUser.tfaEnabled) {
      // If the user has 2FA enabled, hide the 2FA data
      delete actingUser.tfaSecret;
      delete actingUser.tfaUrl;
    } else {
      // If the user lacks 2FA data, generate it
      if (actingUser.tfaSecret == null || actingUser.tfaUrl == null) {
        await AuthController.addNewSecretToUser(actingUser);
      }
    }

    // Hide the users inventories
    delete actingUser.inventoryUsers;

    // Hide salted & hashed password
    delete actingUser.saltedPwdHash;

    res.status(200).json({
      status: "Authenticated",
      user: actingUser
    });
  }

  /**
   * Checks if a user is allowed to do something in a given inventory
   *
   * @returns true if the acting user may access a inventory
   */
  public static async isAuthorized(
    user: User,
    inventory: Inventory,
    desiredAccess: InventoryUserAccessRightsEnum
  ): Promise<boolean> {
    /**
     * The inventoryUser to check permissions for
     */
    let inventoryUser: InventoryUser;
    try {
      // Get the TypeORM entity manager
      const entityManager: EntityManager = getManager();

      // Try to get an inventoryUser matching both the user and the inventory specified
      inventoryUser = await entityManager.findOneOrFail(InventoryUser, {
        where: {
          user: user,
          inventory: inventory
        }
      });
    } catch (error) {
      return false;
    }

    // Needs to have the same access level (0) or higher (1)
    return (
      -1 <
      compareInventoryUserAccessRights(
        inventoryUser.InventoryUserAccessRights,
        desiredAccess
      )
    );
  }

  /**
   * Registers a new user
   */
  public static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    /**
     * The number of rounds the passwords hash will be salted for
     */
    const saltRounds: number = 10 as number;

    /**
     * The user to be added to the db
     */
    const newUser: User = new User();

    newUser.email = req.body.email;

    // The current date
    newUser.createdOn = new Date(new Date().setHours(0, 0, 0, 0));

    // The name of the new user
    newUser.name = req.body.name;

    // Calculate and set the hash
    const hashValue: string = hashSync(req.body.pwd, saltRounds);

    try {
      // Add the user to the db
      newUser.saltedPwdHash = hashValue;
      await UserController.addNewUserOrFail(newUser);
    } catch (error) {
      res.status(400).json({
        status: 400,
        error: "Email already in use or user data incomplete"
      });
      return;
    }

    // Login the new user
    let jwtBearerToken: string;
    try {
      jwtBearerToken = jwt.sign({}, RSA_PRIVATE_KEY, {
        algorithm: "RS256",
        expiresIn: "10h",
        subject: newUser.id + ""
      });
    } catch (error) {
      console.error(error);
    }

    res
      .status(201)
      .cookie("JWT", jwtBearerToken, { httpOnly: true })
      .json({
        status: 201,
        message: "Created new user",
        email: newUser.email,
        id: newUser.id
      });
  }

  /**
   * Login using JWT
   *
   * This method handles the login process and
   * provides JWTs for the authenticated users
   */
  public static async login(req: Request, res: Response): Promise<void> {
    /**
     * The email address provided in the login request
     */
    const email: string = req.body.email;

    /**
     * The password provided in the login request
     */
    const password: string = req.body.pwd;

    /**
     * The 2FA TOTP code provided in the login request (may be undefined)
     */
    const tfa: string | undefined = req.body.tfa;

    /**
     * Try to get the acting user (the one making the request) from the db
     * Returns a 400 status code when the user couldn't be found
     */
    let actingUser: User;
    try {
      actingUser = await UserController.findUserByEmailOrFail(email);
    } catch (error) {
      res.status(400).json({
        status: 400,
        error: "Couldn't find email address"
      });
      return;
    }

    // Credential validation, return 401 on invalid credentials
    if (!compareSync(password, actingUser.saltedPwdHash)) {
      res.status(401).json({
        error: "Invalid credentials"
      });
      return;
    }

    // Check for 2FA
    if (actingUser.tfaEnabled) {
      if (
        !totp.verify({
          token: tfa,
          encoding: "base32",
          secret: actingUser.tfaSecret
        })
      ) {
        // On failed TOTP authentication
        res.status(401).json({
          error: "Invalid TOTP token"
        });
        return;
      }
      // On successful TOTP authentication
    }

    // Generate a JWT
    let jwtBearerToken: string;
    try {
      jwtBearerToken = jwt.sign({}, RSA_PRIVATE_KEY, {
        algorithm: "RS256",
        expiresIn: "10h",
        subject: actingUser.id + ""
      });
    } catch (error) {
      console.error(error);
    }

    // Send the token back to the user
    res
      .status(200)
      .cookie("JWT", jwtBearerToken, {
        httpOnly: true,
        secure: process.env.EDM_MODE !== "development"
      })
      .json({
        status: 200,
        user: actingUser.name
      });
  }

  /**
   * Authenticates a user's JWT and extracts the userId into res.locals.actingUser
   */
  public static async authenticate(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Decode and verify the JWT
    let decoded: any;
    try {
      decoded = jwt.verify(req.cookies["JWT"], PUBLIC_KEY);
    } catch (e) {
      // If the token is invalid
      res.status(401).json({
        status: 401,
        error: "Invalid credentials (need valid JWT as cookie)"
      });
      return;
    }

    // Load the user form the db
    try {
      res.locals.actingUser = await UserController.getUserByIdOrFail(
        decoded.sub as number
      );
    } catch (error) {
      // If the user couldn't be found
      res
        .status(401)
        .clearCookie("JWT")
        .json({
          status: 401,
          error: "Account doesn't exist; token invalid"
        });
      return;
    }

    // If the token is valid and the user was loaded
    next();
  }

  /**
   * Checks for authorization in the current inventory for the acting user
   *
   * @static
   * @param {Response} res The Express response object
   * @param {InventoryUserAccessRightsEnum} accessRights
   * @returns {Promise<void>}
   * @memberof AuthController
   */
  public static async authOrError(
    res: Response,
    accessRights: InventoryUserAccessRightsEnum
  ): Promise<void> {
    if (
      !(await AuthController.isAuthorized(
        res.locals.actingUser,
        res.locals.inventory as Inventory,
        accessRights
      ))
    ) {
      res.status(403).json({
        status: 403,
        error:
          "Requestor doesn't have the " +
          accessRights +
          " role or higher for this inventory."
      });
      return;
    }
  }

  /**
   * This method alters a users account
   * @param req
   * @param res
   * @param next
   */
  public static async changeUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {}

  public static async enable2FA(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    totp;
  }

  public static async get2FA(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {}
}
