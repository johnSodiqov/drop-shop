import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const pricing = new PricingService();
  const base = {
    cost: new Prisma.Decimal('50000'),
    minimum: new Prisma.Decimal('60000'),
    recommended: new Prisma.Decimal('70000'),
    maximumMarkup: new Prisma.Decimal('30000'),
    allowAgentPriceChange: true,
  };

  it('calculates agent profit from server-side cost and requested price', () => {
    const result = pricing.forAgent({ ...base, requested: '75000' });
    expect(result.salePrice.toFixed(2)).toBe('75000.00');
    expect(result.profit.toFixed(2)).toBe('25000.00');
  });

  it('rejects a price below minimum and above the maximum markup', () => {
    expect(() => pricing.forAgent({ ...base, requested: '59000' })).toThrow(BadRequestException);
    expect(() => pricing.forAgent({ ...base, requested: '80000.01' })).toThrow(BadRequestException);
  });

  it('uses the recommended price for fixed-price products and rejects overrides', () => {
    const fixed = { ...base, allowAgentPriceChange: false };
    expect(pricing.forAgent(fixed).salePrice.toFixed(2)).toBe('70000.00');
    expect(() => pricing.forAgent({ ...fixed, requested: '71000' })).toThrow(BadRequestException);
  });
});
