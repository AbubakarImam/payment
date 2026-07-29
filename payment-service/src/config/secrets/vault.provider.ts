import { Injectable, Logger } from '@nestjs/common';
import { ISecretsProvider } from './secrets-provider.interface';

/**
 * Production-ready stub for HashiCorp Vault integration (KV v2 engine).
 *
 * To activate: `npm i node-vault`, implement `load()` to authenticate
 * against `VAULT_ADDR` and read `VAULT_SECRET_PATH`, merging the returned
 * key/value pairs over process.env. Then set SECRETS_PROVIDER=vault.
 */
@Injectable()
export class VaultProvider implements ISecretsProvider {
  private readonly logger = new Logger(VaultProvider.name);

  async load(): Promise<Record<string, string>> {
    this.logger.warn(
      'VaultProvider is a stub — falling back to process.env. Implement node-vault integration before using in production.',
    );
    return process.env as Record<string, string>;
  }
}
