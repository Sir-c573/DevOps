import { OnModuleInit } from "@nestjs/common";
export declare const menu: readonly [{
    readonly id: "espresso";
    readonly name: "Espresso";
    readonly description: "Rich and bold, served straight.";
    readonly price: 2.5;
}, {
    readonly id: "latte";
    readonly name: "Vanilla Latte";
    readonly description: "Espresso, steamed milk, and vanilla.";
    readonly price: 4.5;
}, {
    readonly id: "cold-brew";
    readonly name: "Cold Brew";
    readonly description: "Slow-steeped and refreshingly smooth.";
    readonly price: 4;
}, {
    readonly id: "cappuccino";
    readonly name: "Cappuccino";
    readonly description: "A classic with a cloud of milk foam.";
    readonly price: 4;
}];
type Drink = (typeof menu)[number];
type CoffeeOrder = {
    id: number;
    item: Drink;
    message: string;
};
export declare class AppService implements OnModuleInit {
    private readonly ordersFile;
    private orders;
    private writeQueue;
    onModuleInit(): Promise<void>;
    getMenu(): readonly [{
        readonly id: "espresso";
        readonly name: "Espresso";
        readonly description: "Rich and bold, served straight.";
        readonly price: 2.5;
    }, {
        readonly id: "latte";
        readonly name: "Vanilla Latte";
        readonly description: "Espresso, steamed milk, and vanilla.";
        readonly price: 4.5;
    }, {
        readonly id: "cold-brew";
        readonly name: "Cold Brew";
        readonly description: "Slow-steeped and refreshingly smooth.";
        readonly price: 4;
    }, {
        readonly id: "cappuccino";
        readonly name: "Cappuccino";
        readonly description: "A classic with a cloud of milk foam.";
        readonly price: 4;
    }];
    createOrder(itemId: string): Promise<CoffeeOrder>;
}
export {};
