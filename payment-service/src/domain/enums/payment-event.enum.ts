/**
 * Domain event names published to RabbitMQ. The routing key for each
 * event is `payment.<name>` (see RabbitMqPublisherService).
 */
export enum PaymentEventName {
  PAYMENT_INITIALIZED = 'PaymentInitialized',
  PAYMENT_SUCCESSFUL = 'PaymentSuccessful',
  PAYMENT_FAILED = 'PaymentFailed',
  PAYMENT_REFUNDED = 'PaymentRefunded',
}
