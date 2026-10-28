const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");

const compose = (...args) =>
  new Promise((resolve, reject) => {
    const child = spawn("docker", ["compose", "-p", "coffee-smoke", ...args], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`docker compose ${args[0]} exited with code ${code}`));
    });
  });

async function waitForApi() {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:8080/api/health", {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) return;
      lastError = new Error(`Health check returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error("The Compose app did not become healthy within 60 seconds", {
    cause: lastError,
  });
}

async function getJson(path, options) {
  const response = await fetch(`http://127.0.0.1:8080${path}`, options);
  return { response, body: await response.json() };
}

async function smokeTest() {
  await waitForApi();

  const page = await fetch("http://127.0.0.1:8080");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Coffee Corner/);

  const { response: healthResponse, body: health } =
    await getJson("/api/health");
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(health, { status: "ok" });

  const { response: menuResponse, body: menu } = await getJson("/api/menu");
  assert.equal(menuResponse.status, 200);
  assert.ok(menu.some((drink) => drink.id === "espresso"));

  const placeOrder = () =>
    getJson("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "espresso" }),
    });

  const { response: firstResponse, body: firstOrder } = await placeOrder();
  assert.equal(firstResponse.status, 201);
  assert.equal(firstOrder.id, 1);

  await compose("restart", "api");
  await waitForApi();

  const { response: secondResponse, body: secondOrder } = await placeOrder();
  assert.equal(secondResponse.status, 201);
  assert.equal(secondOrder.id, 2);
}

async function main() {
  try {
    await compose("up", "--build", "--detach");
    await smokeTest();
    console.log("Compose smoke test passed.");
  } finally {
    await compose("down", "--volumes", "--remove-orphans");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
