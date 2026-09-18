/**
 * Pure function to calculate discounts on order amounts.
 * Accurately handles edge cases such as 0%, 100%, and negative inputs.
 *
 * @param {number} totalAmount - Original order total amount before discount
 * @param {number} discountRate - Discount percentage between 0 and 100
 * @returns {{ totalAmount: number, discountRate: number, discountAmount: number, finalAmount: number }}
 */
export function calculateDiscount(totalAmount, discountRate = 0) {
  if (typeof totalAmount !== 'number' || Number.isNaN(totalAmount)) {
    throw new TypeError('Total amount must be a valid number');
  }

  if (totalAmount < 0) {
    throw new RangeError('Total amount cannot be negative');
  }

  if (typeof discountRate !== 'number' || Number.isNaN(discountRate)) {
    throw new TypeError('Discount rate must be a valid number');
  }

  if (discountRate < 0 || discountRate > 100) {
    throw new RangeError('Discount rate must be between 0 and 100');
  }

  if (discountRate === 0) {
    return {
      totalAmount,
      discountRate: 0,
      discountAmount: 0,
      finalAmount: totalAmount,
    };
  }

  if (discountRate === 100) {
    return {
      totalAmount,
      discountRate: 100,
      discountAmount: totalAmount,
      finalAmount: 0,
    };
  }

  const rawDiscount = totalAmount * (discountRate / 100);
  const discountAmount = Math.round((rawDiscount + Number.EPSILON) * 100) / 100;
  const finalAmount = Math.round((totalAmount - discountAmount + Number.EPSILON) * 100) / 100;

  return {
    totalAmount,
    discountRate,
    discountAmount,
    finalAmount,
  };
}
