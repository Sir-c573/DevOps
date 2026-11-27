const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { menu } = require("../dist/menu/menu.data");
const { MenuService } = require("../dist/menu/menu.service");
const { OrdersRepository } = require("../dist/orders/orders.repository");
const { OrdersService } = require("../dist/orders/orders.service");

// Builds the service the same way Nest's dependency injection would.
function createOrdersService() {
  return new OrdersService(new MenuService(), new OrdersRepository());
}

async function withTemporaryService(run) {
  const directory = await mkdtemp(join(tmpdir(), "coffee-service-"));
  const previousFile = process.env.ORDERS_FILE;
  const ordersFile = join(directory, "orders.json");
  process.env.ORDERS_FILE = ordersFile;

  try {
    const service = createOrdersService();
    await service.onModuleInit();
    await run(service, ordersFile);
  } finally {
    if (previousFile === undefined) {
      delete process.env.ORDERS_FILE;
    } else {
      process.env.ORDERS_FILE = previousFile;
    }
    await rm(directory, { recursive: true, force: true });
  }
}

test("returns the coffee menu", () => {
  const menuService = new MenuService();
  assert.deepEqual(menuService.findAll(), menu);
  assert.ok(menuService.findAll().length > 0);
  assert.equal(menuService.findById("espresso"), menu[0]);
  assert.equal(menuService.findById("tea"), undefined);
});

test("creates and persists an order for a menu item", async () => {
  await withTemporaryService(async (service, ordersFile) => {
    assert.deepEqual(await service.createOrder("espresso"), {
      id: 1,
      item: menu[0],
      message: "Your Espresso is on its way!",
    });

    const [secondOrder, thirdOrder] = await Promise.all([
      service.createOrder("latte"),
      service.createOrder("cold-brew"),
    ]);
    assert.deepEqual([secondOrder.id, thirdOrder.id], [2, 3]);

    const storedOrders = JSON.parse(await readFile(ordersFile, "utf8"));
    assert.equal(storedOrders.length, 3);
    assert.equal(storedOrders[0].item.id, "espresso");

    const restartedService = createOrdersService();
    await restartedService.onModuleInit();
    assert.equal((await restartedService.createOrder("cappuccino")).id, 4);
  });
});

test("starts with orders saved under an older menu", async () => {
  const directory = await mkdtemp(join(tmpdir(), "coffee-service-"));
  const previousFile = process.env.ORDERS_FILE;
  const ordersFile = join(directory, "orders.json");
  process.env.ORDERS_FILE = ordersFile;

  try {
    await writeFile(
      ordersFile,
      JSON.stringify([
        {
          id: 1,
          item: {
            id: "mocha",
            name: "Mocha",
            description: "Discontinued.",
            price: 3.75,
          },
          message: "Your Mocha is on its way!",
        },
      ]),
    );

    const service = createOrdersService();
    await service.onModuleInit();
    assert.equal((await service.createOrder("espresso")).id, 2);
  } finally {
    if (previousFile === undefined) {
      delete process.env.ORDERS_FILE;
    } else {
      process.env.ORDERS_FILE = previousFile;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects items that are not on the menu", async () => {
  await withTemporaryService((service) => {
    assert.throws(() => service.createOrder("tea"), {
      status: 404,
      message: "That drink is not on the menu.",
    });
  });
});
