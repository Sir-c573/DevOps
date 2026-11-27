import type { Drink } from "./types";

// All requests use relative /api paths: Vite (dev) and Nginx (Docker) proxy
// them to the API, so the frontend never needs to know the API's address.

export async function fetchMenu(signal?: AbortSignal): Promise<Drink[]> {
  const response = await fetch("/api/menu", { signal });
  if (!response.ok) throw new Error("The menu is unavailable right now.");

  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(isDrink)) {
    throw new Error("The menu is unavailable right now.");
  }
  return data;
}

export async function placeOrder(itemId: string): Promise<string> {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  });
  // A proxy error (e.g. 502 from Nginx) returns HTML, not JSON.
  const result = (await response.json().catch(() => ({}))) as {
    message?: unknown;
  };
  const message = typeof result.message === "string" ? result.message : null;

  if (!response.ok) throw new Error(message ?? "Could not place your order.");
  return message ?? "Order placed!";
}

function isDrink(value: unknown): value is Drink {
  if (!value || typeof value !== "object") return false;
  const drink = value as Record<string, unknown>;
  return (
    typeof drink.id === "string" &&
    typeof drink.name === "string" &&
    typeof drink.description === "string" &&
    typeof drink.price === "number"
  );
}
