import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto, OrderPaginationDto, PaidOrderDto } from './dto';
import { OrderStatus, PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { NATS_CLIENT } from 'src/config';
import { OrderWithProducts } from './interfaces/order-with-products.interface';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  constructor(@Inject(NATS_CLIENT) private readonly client: ClientProxy) {
    super();
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const ids = createOrderDto.items.map((item) => item.productId);

      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, ids),
      );

      const total = createOrderDto.items.reduce((acc, orderItem) => {
        const price =
          products.find((p) => p.id === orderItem.productId)?.price ??
          orderItem.price;
        return acc + price * orderItem.quantity;
      }, 0);
      const totalItems = createOrderDto.items.reduce(
        (acc, orderItem) => acc + orderItem.quantity,
        0,
      );

      const order = await this.order.create({
        data: {
          totalAmount: total,
          totalItems,
          orderItems: {
            createMany: {
              data: createOrderDto.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price:
                  products.find((p) => p.id === item.productId)?.price ??
                  item.price,
                subtotal:
                  item.quantity *
                    products.find((p) => p.id === item.productId)?.price ??
                  item.price,
              })),
            },
          },
        },
        include: {
          orderItems: {
            select: {
              productId: true,
              quantity: true,
              price: true,
              subtotal: true,
            },
          },
        },
      });

      return {
        ...order,
        orderItems: order.orderItems.map((orderItem) => ({
          ...orderItem,
          productName: products.find((p) => p.id === orderItem.productId)?.name,
        })),
      };
    } catch (error) {
      throw new RpcException(error);
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const { page, limit, status } = orderPaginationDto;

    const totalPages = await this.order.count({ where: { status } });
    const lastPage = Math.ceil(totalPages / limit);
    return {
      data: await this.order.findMany({
        skip: limit * (page - 1),
        take: limit,
        where: { status },
      }),
      meta: {
        total: totalPages,
        lastPage,
        page,
      },
    };
  }

  async findOne(id: string) {
    try {
      const order = await this.order.findUnique({
        where: {
          id,
        },
        include: {
          orderItems: {
            select: {
              productId: true,
              quantity: true,
              price: true,
              subtotal: true,
            },
          },
        },
      });
      if (!order)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Order with id: ${id} not found`,
        });

      const ids = order.orderItems.map((item) => item.productId);
      const products = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, ids),
      );
      return {
        ...order,
        orderItems: order.orderItems.map((orderItem) => ({
          ...orderItem,
          productName: products.find((p) => p.id === orderItem.productId)?.name,
        })),
      };
    } catch (error) {
      throw new RpcException(error);
    }
  }

  async changeStatus(id: string, status: OrderStatus) {
    const order = await this.findOne(id);

    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });
  }

  async createPaymentSession(order: OrderWithProducts) {
    try {
      const paymentSession = await firstValueFrom(
        this.client.send('create.payment.session', {
          orderId: order.id,
          currency: 'usd',
          items: order.orderItems.map((item) => ({
            name: item.productName,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      );

      return paymentSession;
    } catch (error) {
      throw new RpcException(error);
    }
  }

  async paidOrder(paidOrderDto: PaidOrderDto) {
    await this.order.update({
      where: {
        id: paidOrderDto.orderId,
      },
      data: {
        status: 'PAID',
        paid: true,
        paidAt: new Date(),
        stripeChargeId: paidOrderDto.stripePaymentId,

        orderReceipt: {
          create: {
            receiptUrl: paidOrderDto.receiptUrl,
          },
        },
      },
    });
  }
}
