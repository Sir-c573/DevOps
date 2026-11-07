import { Body, Controller, Get, Post } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  getHealth() {
    return { status: "ok" };
  }

  @Get("menu")
  getMenu() {
    return this.appService.getMenu();
  }

  @Post("orders")
  createOrder(@Body("itemId") itemId: string) {
    return this.appService.createOrder(itemId);
  }
}
