import { IsInt, Max, Min } from 'class-validator';

export class UpdateSettingDto {
  @IsInt()
  @Min(0)
  @Max(100_000)
  lowStockThreshold!: number;
}
