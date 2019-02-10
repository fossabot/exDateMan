import { EntityManager, getManager } from "typeorm";
import { User } from "../models/userModel";
import { log } from "util";

/**
 * Contains db handling code for User-class operations
 *
 * All operations involving the User-class and a db connection
 * should be implemented here.
 */
export default class UserController {
  /**
   * Finds and returns a user form the db
   * based on the email or throws an exception
   *
   * @param email The email address of the user to be returned
   */
  public static async findUserByEmailOrFail(email: string): Promise<User> {
    const entityManager: EntityManager = getManager();
    const user: User = await entityManager.findOneOrFail(User, {
      where: {
        Email: email
      }
    });
    return user;
  }

  /**
   * Finds and returns a user form the db
   * based on the userId or fails
   *
   * @param userId The id of the user to be returned
   */
  public static async getUserByIdOrFail(userId: number): Promise<User> {
    const entityManager: EntityManager = getManager();
    const user: User = await entityManager.findOneOrFail(User, {
      where: {
        UserId: userId
      }
    });
    return user;
  }

  public static async addNewUserOrFail(user: User): Promise<void> {
    const entityManager: EntityManager = getManager();
    // Check if the user already exists
    try {
      await entityManager.findOneOrFail(User, { where: { Email: user.Email } });
    } catch (error) {
      // When the user doesn't already exist
      entityManager.save(user);
      return;
    }
    // When the user already exists
    throw new Error("duplicate/unique");
  }
}