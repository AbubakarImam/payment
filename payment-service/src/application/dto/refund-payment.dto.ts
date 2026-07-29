import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Matches, MaxLength } from 'class-validator';

export class RefundPaymentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'reference contains invalid characters' })
  reference: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsNotEmpty({ message: 'idempotency_key is required to prevent duplicate refunds' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{8,128}$/, {
    message: 'idempotency_key must be 8-128 URL-safe characters',
  })
  idempotencyKey: string;
}
