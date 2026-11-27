import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { MenuService } from "../menu/menu.service";
import { CoffeeOrder } from "./order.types";
import { OrdersRepository } from "./orders.repository";

@Injectable()
export class OrdersService implements OnModuleInit {
  private orders: CoffeeOrder[] = [];
  // Orders are saved one at a time so concurrent requests get unique IDs and
  // never overwrite each other's writes.
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly menuService: MenuService,
    private readonly repository: OrdersRepository,
  ) {}

  async onModuleInit() {
    this.orders = await this.repository.load();
  }

  createOrder(itemId: string): Promise<CoffeeOrder> {
    const item = this.menuService.findById(itemId);
    if (!item) {
      throw new NotFoundException("That drink is not on the menu.");
    }

    const saveOrder = async () => {
      const order: CoffeeOrder = {
        id: Math.max(0, ...this.orders.map(({ id }) => id)) + 1,
        item,
        message: `Your ${item.name} is on its way!`,
      };
      const nextOrders = [...this.orders, order];
      await this.repository.save(nextOrders);
      this.orders = nextOrders;
      return order;
    };

    const pendingOrder = this.writeQueue.then(saveOrder, saveOrder);
    this.writeQueue = pendingOrder.then(
      () => undefined,
      () => undefined,
    );
    return pendingOrder;
  }
}
