import { processCheckout, getOrders, getOrderById, cancelOrder } from '../services/orderService.js';

export async function createOrder(req, res) {
  try {
    const { userId, customerName, productId, quantity, discountRate, items, paymentMethod, paymentToken } = req.body;

    // Normalize input whether passed as flat { productId, quantity } or { items: [...] }
    const pId = productId || (items && items[0] && items[0].productId);
    const qty = quantity !== undefined ? quantity : (items && items[0] && items[0].quantity) || 1;

    const order = await processCheckout({
      userId: userId || null,
      customerName: customerName || 'Anonymous Customer',
      productId: pId,
      quantity: qty,
      discountRate: discountRate !== undefined ? Number(discountRate) : 0,
      paymentMethod,
      paymentToken,
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

export async function getOrderDetails(req, res) {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const order = await getOrderById(orderId);
    return res.status(200).json(order);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ error: error.message });
  }
}

export async function cancelOrderHandler(req, res) {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const result = await cancelOrder(orderId);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ error: error.message });
  }
}
