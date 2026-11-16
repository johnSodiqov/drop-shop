import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^\+998\d{9}$/)
  phone!: string;

  @IsString()
  @Matches(/^[\x21-\x7E]{1,72}$/)
  password!: string;
}
