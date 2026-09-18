import { processData } from '../services/dataProcessorService.js';

export async function handleProcessData(req, res) {
  try {
    const payload = req.body || {};
    const result = await processData(payload);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
