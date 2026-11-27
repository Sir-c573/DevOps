export type Drink = {
  id: string;
  name: string;
  description: string;
  price: number;
};

export type Notice = {
  kind: "success" | "error";
  text: string;
};
