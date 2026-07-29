import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class GetPaymentStatusDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'reference contains invalid characters' })
  reference: string;
}
