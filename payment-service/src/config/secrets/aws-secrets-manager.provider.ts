import { Injectable, Logger } from '@nestjs/common';
import { ISecretsProvider } from './secrets-provider.interface';

/**
 * Production-ready stub for AWS Secrets Manager integration.
 *
 * To activate: `npm i @aws-sdk/client-secrets-manager`, implement `load()`
 * below to call `GetSecretValueCommand` for `AWS_SECRETS_MANAGER_SECRET_ID`,
 * JSON.parse the SecretString, and merge it over process.env. Then set
 * SECRETS_PROVIDER=aws-secrets-manager and wire this provider in
 * ConfigModule's factory (see config/secrets/secrets.module.ts).
 *
 * Left unimplemented here to avoid an unused hard dependency in the base
 * image — this is the extension point referenced in the README's
 * "secrets management" section.
 */
@Injectable()
export class AwsSecretsManagerProvider implements ISecretsProvider {
  private readonly logger = new Logger(AwsSecretsManagerProvider.name);

  async load(): Promise<Record<string, string>> {
    this.logger.warn(
      'AwsSecretsManagerProvider is a stub — falling back to process.env. Implement AWS SDK integration before using in production.',
    );
    return process.env as Record<string, string>;
  }
}
