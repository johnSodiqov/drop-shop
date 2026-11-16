import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [OrdersModule, ProductsModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
