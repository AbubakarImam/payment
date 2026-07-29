import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import {
  IPaymentGateway,
  InitializeTransactionParams,
  InitializeTransactionResult,
  RefundTransactionParams,
  RefundTransactionResult,
  VerifyTransactionResult,
} from '../../domain/interfaces/payment-gateway.interface';
import {
  PaystackInitializeResponse,
  PaystackRefundResponse,
  PaystackVerifyResponse,
} from './paystack.types';
import { redact } from '../../common/utils/redact.util';

/**
 * Adapter implementing the IPaymentGateway port against the real Paystack
 * REST API. This is the ONLY place in the codebase that holds a reference
 * to PAYSTACK_SECRET_KEY — it is injected via ConfigService (sourced from
 * env vars / secrets manager), never hardcoded, and never logged.
 */
@Injectable()
export class PaystackService implements IPaymentGateway {
  private readonly logger = new Logger(PaystackService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('paystack.secretKey');
    const baseURL = this.configService.get<string>('paystack.baseUrl');

    this.client = axios.create({
      baseURL,
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Defensive: strip Authorization from any error object axios attaches
    // to logs/interceptors downstream.
    this.client.interceptors.request.use((config) => {
      this.logger.debug(
        `-> Paystack ${config.method?.toUpperCase()} ${config.url} ${JSON.stringify(
          redact(config.data),
        )}`,
      );
      return config;
    });
  }

  async initializeTransaction(
    params: InitializeTransactionParams,
  ): Promise<InitializeTransactionResult> {
    try {
      const response = await this.client.post<PaystackInitializeResponse>(
        '/transaction/initialize',
        {
          amount: params.amount,
          email: params.email,
          currency: params.currency,
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: params.metadata,
          channels: params.channels,
        },
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Paystack initialization failed');
      }

      return {
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
      };
    } catch (err) {
      throw this.toGatewayError(err, 'initializeTransaction');
    }
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    try {
      const response = await this.client.get<PaystackVerifyResponse>(
        `/transaction/verify/${encodeURIComponent(reference)}`,
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Paystack verification failed');
      }

      const { data } = response.data;
      return {
        status: data.status,
        reference: data.reference,
        amount: data.amount,
        currency: data.currency,
        channel: data.channel,
        gatewayResponse: data.gateway_response,
        paidAt: data.paid_at,
        metadata: data.metadata,
      };
    } catch (err) {
      throw this.toGatewayError(err, 'verifyTransaction');
    }
  }

  async refundTransaction(params: RefundTransactionParams): Promise<RefundTransactionResult> {
    try {
      const response = await this.client.post<PaystackRefundResponse>('/refund', {
        transaction: params.reference,
        amount: params.amount,
        customer_note: params.reason,
        merchant_note: params.reason,
      });

      if (!response.data.status) {
        throw new Error(response.data.message || 'Paystack refund failed');
      }

      return {
        status: response.data.data.status,
        paystackRefundId: String(response.data.data.id),
      };
    } catch (err) {
      throw this.toGatewayError(err, 'refundTransaction');
    }
  }

  private toGatewayError(err: unknown, operation: string): Error {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      const message =
        (err.response?.data as { message?: string } | undefined)?.message ?? err.message;
      this.logger.error(`Paystack ${operation} failed [${status}]: ${message}`);
      return new Error(`Paystack ${operation} failed: ${message}`);
    }
    this.logger.error(`Paystack ${operation} failed: ${(err as Error).message}`);
    return err as Error;
  }
}
