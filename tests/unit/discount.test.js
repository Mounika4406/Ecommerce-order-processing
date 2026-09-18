import { calculateDiscount } from '../../src/services/discountService.js';

describe('Discount Calculator Unit Tests (Legacy & Core)', () => {
  test('should calculate standard discount correctly', () => {
    const result = calculateDiscount(100, 10);
    expect(result.discountAmount).toBe(10);
    expect(result.finalAmount).toBe(90);
    expect(result.totalAmount).toBe(100);
  });

  test('should correctly handle 0% discount (returns original total)', () => {
    const result = calculateDiscount(150, 0);
    expect(result.discountAmount).toBe(0);
    expect(result.finalAmount).toBe(150);
    expect(result.totalAmount).toBe(150);
  });

  test('should correctly handle 100% discount (returns 0)', () => {
    const result = calculateDiscount(250, 100);
    expect(result.discountAmount).toBe(250);
    expect(result.finalAmount).toBe(0);
  });

  test('should throw error for negative input totals', () => {
    expect(() => calculateDiscount(-50, 10)).toThrow(RangeError);
  });

  test('should throw error for discount rates below 0 or above 100', () => {
    expect(() => calculateDiscount(100, -5)).toThrow(RangeError);
    expect(() => calculateDiscount(100, 105)).toThrow(RangeError);
  });

  test('should throw error for invalid non-numeric inputs', () => {
    expect(() => calculateDiscount('one hundred', 10)).toThrow(TypeError);
    expect(() => calculateDiscount(100, 'ten')).toThrow(TypeError);
    expect(() => calculateDiscount(NaN, 10)).toThrow(TypeError);
  });

  test('should accurately handle currency decimal rounding', () => {
    const result = calculateDiscount(99.99, 15);
    // 99.99 * 0.15 = 14.9985 -> rounded to 15.00
    expect(result.discountAmount).toBe(15.00);
    expect(result.finalAmount).toBe(84.99);
  });
});
