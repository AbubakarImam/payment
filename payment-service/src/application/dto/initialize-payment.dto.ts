import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsObject,
  IsIn,
} from 'class-validator';

const SUPPORTED_CURRENCIES = ['NGN', 'GHS', 'ZAR', 'USD', 'KES'];
const SUPPORTED_CHANNELS = [
  'card',
  'bank',
  'bank_transfer',
  'ussd',
  'qr',
  'mobile_money',
  'eft',
];

export class InitializePaymentDto {
  @IsInt({ message: 'amount must be an integer in the smallest currency unit' })
  @IsPositive({ message: 'amount must be greater than zero' })
  amount: number;

  @IsEmail({}, { message: 'a valid email is required' })
  @MaxLength(254)
  email: string;

  @IsIn(SUPPORTED_CURRENCIES, {
    message: `currency must be one of: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  currency: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'callback_url must be a valid https URL' })
  @MaxLength(2048)
  callbackUrl?: string;

  @IsNotEmpty({ message: 'idempotency_key is required to prevent duplicate charges' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{8,128}$/, {
    message: 'idempotency_key must be 8-128 URL-safe characters',
  })
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{6,100}$/, { message: 'reference must be alphanumeric (6-100 chars)' })
  reference?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsIn(SUPPORTED_CHANNELS, { each: true })
  channels?: string[];
}
