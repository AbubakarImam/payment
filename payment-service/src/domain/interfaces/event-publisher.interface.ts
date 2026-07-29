import { PaymentEventName } from '../enums/payment-event.enum';

export const EVENT_PUBLISHER = Symbol('EVENT_PUBLISHER');

export interface IEventPublisher {
  publish<T extends Record<string, unknown>>(
    eventName: PaymentEventName,
    payload: T,
  ): Promise<void>;
}
