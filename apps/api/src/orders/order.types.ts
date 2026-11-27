import { Drink } from "../menu/menu.data";

export type CoffeeOrder = {
  id: number;
  // A snapshot of the drink at order time; it may differ from the current menu.
  item: Drink;
  message: string;
};

// Checks the shape of a stored order only. Saved orders are a historical record,
// so they must stay valid after the menu changes (a new price, a renamed or
// removed drink); otherwise the API would refuse to start on existing data.
export function isCoffeeOrder(value: unknown): value is CoffeeOrder {
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
