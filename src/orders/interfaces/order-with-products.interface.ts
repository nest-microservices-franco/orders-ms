import { OrderStatus } from '@prisma/client';

export interface OrderWithProducts {
  orderItems: {
    productName: any;
    productId: number;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
  id: string;
  totalAmount: number;
  totalItems: number;
  status: OrderStatus;
  paid: boolean;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
