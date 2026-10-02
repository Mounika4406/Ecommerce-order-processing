import * as productModel from '../models/productModel.js';

export async function listProducts(req, res) {
  try {
    const products = await productModel.getAllProducts();
    return res.status(200).json(products);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
