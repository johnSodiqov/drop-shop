import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface PriceInput {
  cost: Prisma.Decimal;
  minimum: Prisma.Decimal;
  recommended: Prisma.Decimal;
  maximumMarkup: Prisma.Decimal;
  allowAgentPriceChange: boolean;
  requested?: string;
}

@Injectable()
export class PricingService {
  forAgent(input: PriceInput): { salePrice: Prisma.Decimal; profit: Prisma.Decimal } {
    const requested = input.requested ? new Prisma.Decimal(input.requested) : undefined;
    if (!input.allowAgentPriceChange && requested && !requested.equals(input.recommended)) {
      throw new BadRequestException('The sale price for this product is fixed');
    }

    const salePrice = input.allowAgentPriceChange
      ? requested ?? input.recommended
      : input.recommended;
    if (
      salePrice.lessThan(input.minimum) ||
      salePrice.greaterThan(input.cost.plus(input.maximumMarkup))
    ) {
      throw new BadRequestException('Sale price is outside allowed limits');
    }
    return { salePrice, profit: salePrice.minus(input.cost) };
  }
}
