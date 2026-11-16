import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Matches(/^\+998\d{9}$/, { message: 'Phone must use the +998XXXXXXXXX format' })
  phone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @Matches(/^[\x21-\x7E]{10,72}$/, {
    message: 'Password must be 10–72 printable ASCII characters',
  })
  password!: string;
}
