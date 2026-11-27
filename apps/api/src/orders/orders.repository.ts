import { Injectable } from "@nestjs/common";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CoffeeOrder, isCoffeeOrder } from "./order.types";

// Stores orders in a JSON file. Writes go to a temporary file first and are
// then renamed over the real one, so a crash never leaves a half-written file.
@Injectable()
export class OrdersRepository {
  private readonly file =
    process.env.ORDERS_FILE ?? join(process.cwd(), "data", "orders.json");

  async load(): Promise<CoffeeOrder[]> {
    try {
      return await this.read();
    } catch (error) {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    }

    await mkdir(dirname(this.file), { recursive: true });
    try {
      // "wx" fails if another process created the file in the meantime.
      await writeFile(this.file, "[]\n", { flag: "wx" });
      return [];
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") throw error;
      return this.read();
    }
  }

  async save(orders: CoffeeOrder[]): Promise<void> {
    const temporaryFile = `${this.file}.${process.pid}.tmp`;
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(temporaryFile, `${JSON.stringify(orders, null, 2)}\n`);
    await rename(temporaryFile, this.file);
  }

  private async read(): Promise<CoffeeOrder[]> {
    const parsed: unknown = JSON.parse(await readFile(this.file, "utf8"));
    if (!Array.isArray(parsed) || !parsed.every(isCoffeeOrder)) {
      throw new Error(`Invalid order data in ${this.file}`);
    }
    return parsed;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
