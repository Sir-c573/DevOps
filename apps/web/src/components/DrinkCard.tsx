import type { Drink } from "../types";

const icons: Record<string, string> = {
  espresso: "☕",
  latte: "🥛",
  "cold-brew": "🧊",
  cappuccino: "☕",
};

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type DrinkCardProps = {
  drink: Drink;
  index: number;
  isOrdering: boolean;
  disabled: boolean;
  onOrder: (drink: Drink) => void;
};

export function DrinkCard({
  drink,
  index,
  isOrdering,
  disabled,
  onOrder,
}: DrinkCardProps) {
  return (
    <article className="drink-card">
      <div className={`drink-art drink-art-${index % 4}`}>
        <span>{icons[drink.id] ?? "☕"}</span>
        <span className="drink-number">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="drink-info">
        <div className="drink-title">
          <h3>{drink.name}</h3>
          <span>{priceFormat.format(drink.price)}</span>
        </div>
        <p>{drink.description}</p>
        <button
          type="button"
          onClick={() => onOrder(drink)}
          disabled={disabled}
        >
          {isOrdering ? "Adding…" : "Order this"}{" "}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </article>
  );
}
