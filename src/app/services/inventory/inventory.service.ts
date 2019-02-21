import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Inventory } from "../../models/inventory";
import { environment } from "../../../environments/environment";
import { User } from "../../models/user";

@Injectable({
  providedIn: "root"
})
export class InventoryService {
  private baseUrl: string = environment.baseUrl;

  constructor(private http: HttpClient) {}

  async getInventories(): Promise<Inventory[]> {
    const response: GetInventoriesResponse = await this.http
      .get<GetInventoriesResponse>(this.baseUrl + "/inv")
      .toPromise();

    // Convert the date strings to dates
    for (const inventory of response.inventories) {
      inventory.InventoryCreatedOn = new Date(
        (inventory.InventoryCreatedOn as unknown) as string
      );
    }
    return response.inventories;
  }

  async newInventory(
    name: string,
    admins?: User[],
    writeables?: User[],
    readables?: User[]
  ): Promise<Inventory> {
    console.log("Creating inventory " + name);

    const adminIds: number[] = [];
    const writeableIds: number[] = [];
    const readableIds: number[] = [];

    // Copy ids
    if (admins) {
      for (const admin of admins) {
        adminIds.push(admin.userId);
      }
    }

    if (writeables) {
      for (const writable of writeables) {
        writeableIds.push(writable.userId);
      }
    }

    if (readables) {
      for (const readable of readables) {
        readableIds.push(readable.userId);
      }
    }

    console.log("Survived");

    // Request & Response
    const response: NewInventoryResponse = await this.http
      .post<NewInventoryResponse>(this.baseUrl + "/inv", {
        name,
        admins: adminIds,
        writeables: writeableIds,
        readables: readableIds
      } as NewInventoryRequest)
      .toPromise();

    return response.inventory;
  }
}

interface GetInventoriesResponse {
  status: number;
  message: string;
  inventories: Inventory[];
}

interface NewInventoryRequest {
  name: string;
  admins: number[];
  writeables: number[];
  readables: number[];
}

interface NewInventoryResponse {
  message: string;
  inventory: Inventory;
}
