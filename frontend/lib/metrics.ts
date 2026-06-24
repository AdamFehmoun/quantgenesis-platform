import type { BacktestResult } from '../app/page';

/**
 * Nombre de trades, robuste au contrat backend.
 *
 * La clé canonique côté API est `metrics.trades_count` (anciennement
 * `num_trades`, d'où l'ancien bug d'affichage "undefined" côté front). On
 * retombe sur `backtest.num_trades` si la clé canonique est absente, et on
 * renvoie `null` quand aucune source n'est exploitable (ex. run FALLBACK où la
 * métrique vaut `null`). L'appelant décide alors quoi afficher ("n/a", "—"…).
 */
export function getTradesCount(result: BacktestResult): number | null {
  const canonical = result.metrics?.trades_count;
  if (typeof canonical === 'number' && Number.isFinite(canonical)) return canonical;
  const legacy = result.backtest?.num_trades;
  if (typeof legacy === 'number' && Number.isFinite(legacy)) return legacy;
  return null;
}
