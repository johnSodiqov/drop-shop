import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  IsUrl,
} from 'class-validator';

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

export class CreateProductDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,40}$/)
  sku!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsString()
  categoryId!: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  costPrice!: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  recommendedPrice!: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  minimumPrice!: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  maximumMarkup!: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsBoolean()
  allowAgentPriceChange?: boolean;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock!: number;
}
