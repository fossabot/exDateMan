import { Inventory } from "./inventory";
import { InventoryUserAccess } from "./inventory-user-access.enum";

export class InventoryUser {
  inventory: Inventory;

  user: User;

  InventoryUserAccessRights: InventoryUserAccess;
}
