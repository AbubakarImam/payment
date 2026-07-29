/**
 * Abstraction over "where secrets come from". Default implementation reads
 * from process.env (populated by .env in dev, or the container/orchestrator
 * environment in prod). Swap in AwsSecretsManagerProvider / VaultProvider
 * by implementing this interface and switching SECRETS_PROVIDER — no
 * changes needed anywhere else in the app because everything consumes
 * secrets through ConfigService, not process.env directly.
 */
export interface ISecretsProvider {
  load(): Promise<Record<string, string>>;
}
