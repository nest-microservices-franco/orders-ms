import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto, OrderPaginationDto } from './dto';
import { OrderStatus, PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PRODUCT_SERVICE } from 'src/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  constructor(
    @Inject(PRODUCT_SERVICE) private readonly productClient: ClientProxy,
  ) {
    super();
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      const ids = createOrderDto.items.map((item) => item.productId);

      const products = await firstValueFrom(
        this.productClient.send({ cmd: 'validate_products' }, ids),
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
    const order = await this.order.findUnique({
      where: {
        id,
      },
    });

    if (!order)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Order with id: ${id} not found`,
      });

    return order;
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
}
