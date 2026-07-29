import { Injectable } from '@nestjs/common';
import { ISecretsProvider } from './secrets-provider.interface';

@Injectable()
export class EnvSecretsProvider implements ISecretsProvider {
  async load(): Promise<Record<string, string>> {
    return process.env as Record<string, string>;
  }
}
