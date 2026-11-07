const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const { AppService, menu } = require("../dist/app.service");

async function withTemporaryService(run) {
  const directory = await mkdtemp(join(tmpdir(), "coffee-service-"));
  const previousFile = process.env.ORDERS_FILE;
  const ordersFile = join(directory, "orders.json");
  process.env.ORDERS_FILE = ordersFile;

  try {
    const service = new AppService();
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

test("returns the coffee menu", async () => {
  await withTemporaryService((service) => {
    assert.deepEqual(service.getMenu(), menu);
    assert.ok(service.getMenu().length > 0);
  });
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

    const restartedService = new AppService();
    await restartedService.onModuleInit();
    assert.equal((await restartedService.createOrder("cappuccino")).id, 4);
  });
});

test("rejects items that are not on the menu", async () => {
  await withTemporaryService((service) => {
    assert.throws(() => service.createOrder("tea"), {
      status: 404,
      message: "That drink is not on the menu.",
    });
  });
});
