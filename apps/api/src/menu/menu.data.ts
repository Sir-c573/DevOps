export type Drink = {
  id: string;
  name: string;
  description: string;
  price: number;
};

export const menu: readonly Drink[] = [
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
];
