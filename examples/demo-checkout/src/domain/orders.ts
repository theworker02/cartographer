/**
 * Mini checkout service fixture — used to prove graph reconstruction.
 */

export type Order = {
  id: string;
  total: number;
};

export class OrderRepository {
  save(order: Order): Order {
    return order;
  }

  find(id: string): Order | null {
    return id ? { id, total: 0 } : null;
  }
}

export class OrderService {
  constructor(private readonly repo: OrderRepository) {}

  createOrder(total: number): Order {
    const order = { id: `ord_${Date.now()}`, total };
    return this.repo.save(order);
  }
}

export function buildService(): OrderService {
  return new OrderService(new OrderRepository());
}
