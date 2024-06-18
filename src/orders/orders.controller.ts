import { Controller, ParseUUIDPipe } from '@nestjs/common';
import {
  EventPattern,
  MessagePattern,
  Payload,
  RpcException,
} from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeStatusDto, OrderPaginationDto, PaidOrderDto } from './dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @MessagePattern({ cmd: 'createOrder' })
  async create(@Payload() createOrderDto: CreateOrderDto) {
    try {
      const order = await this.ordersService.create(createOrderDto);
      const paymentSession =
        await this.ordersService.createPaymentSession(order);
      return { order, paymentSession };
    } catch (error) {
      throw new RpcException(error);
    }
  }

  @MessagePattern({ cmd: 'findAllOrders' })
  findAll(@Payload() orderPaginationDto: OrderPaginationDto) {
    return this.ordersService.findAll(orderPaginationDto);
  }

  @MessagePattern({ cmd: 'findOneOrder' })
  findOne(@Payload(ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  @MessagePattern({ cmd: 'changeOrderStatus' })
  changeOrderStatus(@Payload() changeStatusDto: ChangeStatusDto) {
    return this.ordersService.changeStatus(
      changeStatusDto.id,
      changeStatusDto.status,
    );
  }

  @EventPattern('payment.succeeded')
  async paymentSucceeded(@Payload() paidOrderDto: PaidOrderDto) {
    await this.ordersService.paidOrder(paidOrderDto);
  }
}
