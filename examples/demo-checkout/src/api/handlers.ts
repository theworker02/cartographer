import { Router } from "./fake-express.js";
import { buildService } from "../domain/orders.js";

const service = buildService();
export const router = Router();

router.post("/orders", (req, res) => {
  const total = Number(req.body?.total ?? 0);
  const order = service.createOrder(total);
  res.json(order);
});

router.get("/orders/:id", (req, res) => {
  res.json({ id: req.params.id });
});
