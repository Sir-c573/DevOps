import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { MenuModule } from "./menu/menu.module";
import { OrdersModule } from "./orders/orders.module";

@Module({
  imports: [HealthModule, MenuModule, OrdersModule],
})
export class AppModule {}
