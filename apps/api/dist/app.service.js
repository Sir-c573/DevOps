"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = exports.menu = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
exports.menu = [
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
let AppService = class AppService {
    constructor() {
        this.ordersFile = process.env.ORDERS_FILE ?? (0, node_path_1.join)(process.cwd(), "data", "orders.json");
        this.orders = [];
        this.writeQueue = Promise.resolve();
    }
    async onModuleInit() {
        try {
            const contents = await (0, promises_1.readFile)(this.ordersFile, "utf8");
            const parsed = JSON.parse(contents);
            if (!Array.isArray(parsed) || !parsed.every(isCoffeeOrder)) {
                throw new Error(`Invalid order data in ${this.ordersFile}`);
            }
            this.orders = parsed;
        }
        catch (error) {
            if (!isNodeError(error) || error.code !== "ENOENT") {
                throw error;
            }
            await (0, promises_1.mkdir)((0, node_path_1.dirname)(this.ordersFile), { recursive: true });
            await (0, promises_1.writeFile)(this.ordersFile, "[]\n", { flag: "wx" }).catch(async (writeError) => {
                if (!isNodeError(writeError) || writeError.code !== "EEXIST") {
                    throw writeError;
                }
                const contents = await (0, promises_1.readFile)(this.ordersFile, "utf8");
                const parsed = JSON.parse(contents);
                if (!Array.isArray(parsed) || !parsed.every(isCoffeeOrder)) {
                    throw new Error(`Invalid order data in ${this.ordersFile}`);
                }
                this.orders = parsed;
            });
        }
    }
    getMenu() {
        return exports.menu;
    }
    createOrder(itemId) {
        const item = exports.menu.find((drink) => drink.id === itemId);
        if (!item) {
            throw new common_1.NotFoundException("That drink is not on the menu.");
        }
        const saveOrder = async () => {
            const order = {
                id: Math.max(0, ...this.orders.map(({ id }) => id)) + 1,
                item,
                message: `Your ${item.name} is on its way!`,
            };
            const nextOrders = [...this.orders, order];
            const temporaryFile = `${this.ordersFile}.${process.pid}.tmp`;
            await (0, promises_1.mkdir)((0, node_path_1.dirname)(this.ordersFile), { recursive: true });
            await (0, promises_1.writeFile)(temporaryFile, `${JSON.stringify(nextOrders, null, 2)}\n`);
            await (0, promises_1.rename)(temporaryFile, this.ordersFile);
            this.orders = nextOrders;
            return order;
        };
        const pendingOrder = this.writeQueue.then(saveOrder, saveOrder);
        this.writeQueue = pendingOrder.then(() => undefined, () => undefined);
        return pendingOrder;
    }
};
exports.AppService = AppService;
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)()
], AppService);
function isCoffeeOrder(value) {
    if (!value || typeof value !== "object")
        return false;
    const order = value;
    const itemData = order.item;
    if (!itemData || typeof itemData !== "object")
        return false;
    const itemId = itemData.id;
    const item = exports.menu.find((drink) => drink.id === itemId);
    return (Number.isSafeInteger(order.id) &&
        Number(order.id) > 0 &&
        !!item &&
        JSON.stringify(itemData) === JSON.stringify(item) &&
        order.message === `Your ${item.name} is on its way!`);
}
function isNodeError(error) {
    return error instanceof Error && "code" in error;
}
//# sourceMappingURL=app.service.js.map