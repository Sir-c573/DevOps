import { Injectable } from "@nestjs/common";
import { Drink, menu } from "./menu.data";

@Injectable()
export class MenuService {
  findAll(): readonly Drink[] {
    return menu;
  }

  findById(id: string): Drink | undefined {
    return menu.find((drink) => drink.id === id);
  }
}
