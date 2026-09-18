import { calculateDiscount } from '../../src/services/discountService.js';

describe('Discount Logic Parameterized Edge Cases Integration Test', () => {
  const validEdgeCases = [
    {
      description: 'Zero total with 0% discount',
      totalAmount: 0,
      discountRate: 0,
      expectedDiscount: 0,
      expectedFinal: 0,
    },
    {
      description: 'Zero total with 50% discount',
      totalAmount: 0,
      discountRate: 50,
      expectedDiscount: 0,
      expectedFinal: 0,
    },
    {
      description: 'Standard total with 0% discount (returns original total)',
      totalAmount: 125.75,
      discountRate: 0,
      expectedDiscount: 0,
      expectedFinal: 125.75,
    },
    {
      description: 'Standard total with 100% discount (returns 0)',
      totalAmount: 899.99,
      discountRate: 100,
      expectedDiscount: 899.99,
      expectedFinal: 0,
    },
    {
      description: 'Fractional discount rate (12.5%)',
      totalAmount: 200,
      discountRate: 12.5,
      expectedDiscount: 25.00,
      expectedFinal: 175.00,
    },
    {
      description: 'Odd pennies requiring banker/half-up precision',
      totalAmount: 19.99,
      discountRate: 33,
      // 19.99 * 0.33 = 6.5967 -> 6.60
      expectedDiscount: 6.60,
      expectedFinal: 13.39,
    },
    {
      description: 'Very large transaction amount',
      totalAmount: 1000000.00,
      discountRate: 15,
      expectedDiscount: 150000.00,
      expectedFinal: 850000.00,
    },
    {
      description: 'Minimal boundary discount rate (0.01%)',
      totalAmount: 10000,
      discountRate: 0.01,
      expectedDiscount: 1.00,
      expectedFinal: 9999.00,
    },
    {
      description: 'High boundary discount rate (99.99%)',
      totalAmount: 100,
      discountRate: 99.99,
      expectedDiscount: 99.99,
      expectedFinal: 0.01,
    },
  ];

  test.each(validEdgeCases)(
    '$description: total=$totalAmount, rate=$discountRate%',
    ({ totalAmount, discountRate, expectedDiscount, expectedFinal }) => {
      const result = calculateDiscount(totalAmount, discountRate);
      expect(result.discountAmount).toBeCloseTo(expectedDiscount, 2);
      expect(result.finalAmount).toBeCloseTo(expectedFinal, 2);
      expect(result.totalAmount).toBe(totalAmount);
      expect(result.discountRate).toBe(discountRate);
    }
  );

  const errorEdgeCases = [
    {
      description: 'Negative total amount (-50)',
      totalAmount: -50,
      discountRate: 10,
      expectedError: RangeError,
    },
    {
      description: 'Negative discount rate (-1%)',
      totalAmount: 100,
      discountRate: -1,
      expectedError: RangeError,
    },
    {
      description: 'Excessive discount rate (101%)',
      totalAmount: 100,
      discountRate: 101,
      expectedError: RangeError,
    },
    {
      description: 'Non-numeric string total amount',
      totalAmount: 'invalid',
      discountRate: 10,
      expectedError: TypeError,
    },
    {
      description: 'Non-numeric string discount rate',
      totalAmount: 100,
      discountRate: 'twenty',
      expectedError: TypeError,
    },
    {
      description: 'Null total amount',
      totalAmount: null,
      discountRate: 10,
      expectedError: TypeError,
    },
    {
      description: 'NaN discount rate',
      totalAmount: 100,
      discountRate: NaN,
      expectedError: TypeError,
    },
  ];

  test.each(errorEdgeCases)(
    'should throw error for $description',
    ({ totalAmount, discountRate, expectedError }) => {
      expect(() => calculateDiscount(totalAmount, discountRate)).toThrow(expectedError);
    }
  );
});
