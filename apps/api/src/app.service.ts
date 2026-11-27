import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const menu = [
  {
    id: "espresso",
    name: "Espresso",
    description: "Rich and bold, served straight.",
    price: 2.5,
  },
  {
    id: "latte",
    name: "Vanilla Latte",
    description: "Espresso, steamed milk, and vanilla.",
    price: 4.5,
  },
  {
    id: "cold-brew",
    name: "Cold Brew",
    description: "Slow-steeped and refreshingly smooth.",
    price: 4,
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    description: "A classic with a cloud of milk foam.",
    price: 4,
  },
] as const;

// A snapshot of the drink at order time; it may differ from the current menu.
type OrderedDrink = {
  id: string;
  name: string;
  description: string;
  price: number;
};

type CoffeeOrder = {
  id: number;
  item: OrderedDrink;
  message: string;
};

@Injectable()
export class AppService implements OnModuleInit {
  private readonly ordersFile =
    process.env.ORDERS_FILE ?? join(process.cwd(), "data", "orders.json");
  private orders: CoffeeOrder[] = [];
  private writeQueue: Promise<void> = Promise.resolve();

  async onModuleInit() {
    try {
      const contents = await readFile(this.ordersFile, "utf8");
      const parsed: unknown = JSON.parse(contents);
      if (!Array.isArray(parsed) || !parsed.every(isCoffeeOrder)) {
        throw new Error(`Invalid order data in ${this.ordersFile}`);
      }
      this.orders = parsed;
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") {
        throw error;
      }

      await mkdir(dirname(this.ordersFile), { recursive: true });
      await writeFile(this.ordersFile, "[]\n", { flag: "wx" }).catch(
        async (writeError: unknown) => {
          if (!isNodeError(writeError) || writeError.code !== "EEXIST") {
            throw writeError;
          }
          const contents = await readFile(this.ordersFile, "utf8");
          const parsed: unknown = JSON.parse(contents);
          if (!Array.isArray(parsed) || !parsed.every(isCoffeeOrder)) {
            throw new Error(`Invalid order data in ${this.ordersFile}`);
          }
          this.orders = parsed;
        },
      );
    }
  }

  getMenu() {
    return menu;
  }

  createOrder(itemId: string): Promise<CoffeeOrder> {
    const item = menu.find((drink) => drink.id === itemId);
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
      const temporaryFile = `${this.ordersFile}.${process.pid}.tmp`;

      await mkdir(dirname(this.ordersFile), { recursive: true });
      await writeFile(
        temporaryFile,
        `${JSON.stringify(nextOrders, null, 2)}\n`,
      );
      await rename(temporaryFile, this.ordersFile);
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

// Checks the shape of a stored order only. Saved orders are a historical record,
// so they must stay valid after the menu changes (a new price, a renamed or
// removed drink); otherwise the API would refuse to start on existing data.
function isCoffeeOrder(value: unknown): value is CoffeeOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  const item = order.item as Record<string, unknown> | null | undefined;
  if (!item || typeof item !== "object") return false;

  return (
    Number.isSafeInteger(order.id) &&
    Number(order.id) > 0 &&
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.price === "number" &&
    typeof order.message === "string"
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
