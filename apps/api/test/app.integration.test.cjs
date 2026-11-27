const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { after, before, test } = require("node:test");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");

let app;
let baseUrl;
let directory;
const previousFile = process.env.ORDERS_FILE;

async function startApi() {
  const api = await NestFactory.create(AppModule, { logger: false });
  api.setGlobalPrefix("api");
  await api.listen(0, "127.0.0.1");
  return api;
}

before(async () => {
  directory = await mkdtemp(join(tmpdir(), "coffee-api-"));
  process.env.ORDERS_FILE = join(directory, "orders.json");
  app = await startApi();
  baseUrl = await app.getUrl();
});

after(async () => {
  await app?.close();
  if (previousFile === undefined) {
    delete process.env.ORDERS_FILE;
  } else {
    process.env.ORDERS_FILE = previousFile;
  }
  await rm(directory, { recursive: true, force: true });
});

test("serves health, menu, and order endpoints and keeps orders after restart", async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: "ok" });

  const menuResponse = await fetch(`${baseUrl}/api/menu`);
  assert.equal(menuResponse.status, 200);
  const menu = await menuResponse.json();
  assert.ok(menu.some((drink) => drink.id === "espresso"));

  const orderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId: "espresso" }),
  });
  assert.equal(orderResponse.status, 201);
  const order = await orderResponse.json();
  assert.equal(order.id, 1);
  assert.equal(order.item.id, "espresso");
  assert.equal(order.message, "Your Espresso is on its way!");

  const invalidOrderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId: "tea" }),
  });
  assert.equal(invalidOrderResponse.status, 404);

  const storedOrders = JSON.parse(
    await readFile(process.env.ORDERS_FILE, "utf8"),
  );
  assert.equal(storedOrders.length, 1);

  await app.close();
  app = await startApi();
  baseUrl = await app.getUrl();

  const afterRestartResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId: "latte" }),
  });
  assert.equal(afterRestartResponse.status, 201);
  assert.equal((await afterRestartResponse.json()).id, 2);
});
