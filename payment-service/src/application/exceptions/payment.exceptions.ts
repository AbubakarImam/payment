export class PaymentNotFoundException extends Error {
  constructor(reference: string) {
    super(`Payment with reference "${reference}" was not found`);
    this.name = 'PaymentNotFoundException';
  }
}

export class PaymentGatewayException extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PaymentGatewayException';
  }
}

export class InvalidPaymentStateException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPaymentStateException';
  }
}

export class DuplicatePaymentException extends Error {
  constructor(reference: string) {
    super(`A payment with reference "${reference}" already exists`);
    this.name = 'DuplicatePaymentException';
  }
}
