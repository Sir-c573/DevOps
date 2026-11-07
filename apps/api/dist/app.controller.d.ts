import { AppService } from "./app.service";
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHealth(): {
        status: string;
    };
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
    createOrder(itemId: string): Promise<{
        id: number;
        item: {
            readonly id: "espresso";
            readonly name: "Espresso";
            readonly description: "Rich and bold, served straight.";
            readonly price: 2.5;
        } | {
            readonly id: "latte";
            readonly name: "Vanilla Latte";
            readonly description: "Espresso, steamed milk, and vanilla.";
            readonly price: 4.5;
        } | {
            readonly id: "cold-brew";
            readonly name: "Cold Brew";
            readonly description: "Slow-steeped and refreshingly smooth.";
            readonly price: 4;
        } | {
            readonly id: "cappuccino";
            readonly name: "Cappuccino";
            readonly description: "A classic with a cloud of milk foam.";
            readonly price: 4;
        };
        message: string;
    }>;
}
