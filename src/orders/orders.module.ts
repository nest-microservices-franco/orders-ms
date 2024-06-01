import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs } from 'src/config/envs';
import { PRODUCT_SERVICE } from 'src/config';

@Module({
  imports: [ClientsModule.register([{
    name: PRODUCT_SERVICE,
    transport: Transport.TCP,
    options: {
      host: envs.productMsHost,
      port: envs.productMsPort,
    },
  }])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
