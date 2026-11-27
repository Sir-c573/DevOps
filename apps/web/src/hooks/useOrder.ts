import { useState } from "react";
import { placeOrder } from "../api";
import type { Drink, Notice } from "../types";

export function useOrder() {
  // ID of the drink being ordered; null when no order is in flight.
  const [ordering, setOrdering] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function order(drink: Drink) {
    setOrdering(drink.id);
    setNotice(null);
    try {
      setNotice({ kind: "success", text: await placeOrder(drink.id) });
    } catch (error) {
      setNotice({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not place your order.",
      });
    } finally {
      setOrdering(null);
    }
  }

  return { ordering, notice, order };
}
