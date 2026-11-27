import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@Body("itemId") itemId: unknown) {
    if (typeof itemId !== "string" || itemId.trim() === "") {
      throw new BadRequestException("itemId must be a non-empty string.");
    }
    return this.ordersService.createOrder(itemId);
  }
}
