import { processCheckout, getOrders } from '../services/orderService.js';

export async function createOrder(req, res) {
  try {
    const { customerName, productId, quantity, discountRate, items } = req.body;

    // Normalize input whether passed as flat { productId, quantity } or { items: [...] }
    const pId = productId || (items && items[0] && items[0].productId);
    const qty = quantity !== undefined ? quantity : (items && items[0] && items[0].quantity) || 1;

    const order = await processCheckout({
      customerName: customerName || 'Anonymous Customer',
      productId: pId,
      quantity: qty,
      discountRate: discountRate !== undefined ? Number(discountRate) : 0,
    });

    return res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message,
    });
  }
}

export async function listOrders(req, res) {
  try {
    const orders = await getOrders();
    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
