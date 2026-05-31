'use client';
import { useState } from 'react';

interface Metrics {
  sharpe_ratio: number;
  max_drawdown_pct: number;
  total_return_pct: number;
  num_trades: number;
  win_rate_pct: number;
}

interface BacktestResult {
  status: string;
  strategy_name: string;
  metrics: Metrics;
}

export default function Chat() {
  const [intent, setIntent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyse = async () => {
    if (!intent.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('https://quantgenesis-platform-production.up.railway.app/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent })
      });
      const data: BacktestResult = await res.json();
      setResult(data);
    } catch (err) {
      setError('Erreur : backend non disponible');
    } finally {
      setLoading(false);
    }
  };

  const getWarning = (metrics: Metrics): string | null => {
    if (metrics.sharpe_ratio > 5) return '⚠️ Sharpe > 5 — résultats suspects, possible overfitting';
    if (metrics.max_drawdown_pct === 0) return '⚠️ Drawdown nul — vérifier les données';
    if (metrics.num_trades < 5) return '⚠️ Trop peu de trades pour être significatif';
    if (metrics.win_rate_pct > 90) return '⚠️ Win rate trop élevé — possible look-ahead bias';
    return null;
  };

  const examples = ['momentum Bitcoin drawdown 10%', 'ETH RSI 14 mean reversion', 'BTC/ETH ratio trading'];

  return (
    <div style={{background: '#16181F', border: '1px solid #2a2a2a'}} className="rounded-xl p-6">
      <h2 className="text-white font-semibold mb-1">Décris ta stratégie</h2>
      <p className="text-xs mb-4" style={{color: '#666'}}>En langage naturel — le pipeline IA s'occupe du reste</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => setIntent(ex)}
            className="text-xs px-3 py-1 rounded-full transition-all"
            style={{background: '#1e2028', color: '#888', border: '1px solid #2a2a2a'}}
          >
            {ex}
          </button>
        ))}
      </div>

      <div style={{background: '#1a1c24', border: '1px solid #2a2a2a'}} className="rounded-lg p-4 mb-4 min-h-16 flex items-center">
        <span style={{color: result ? '#fff' : '#555'}} className="text-sm">
          {intent || 'Tape ou choisis un exemple ci-dessus...'}
        </span>
      </div>

      <div className="flex gap-3">
        <input
          className="flex-1 rounded-lg px-4 py-3 text-sm text-white outline-none"
          style={{background: '#1a1c24', border: '1px solid #2a2a2a'}}
          value={intent}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntent(e.target.value)}
          placeholder="Tape ta stratégie en français..."
          disabled={loading}
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyse()}
        />
        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="px-6 py-3 rounded-lg font-medium text-sm text-white transition-all disabled:opacity-50"
          style={{background: '#1D9E75'}}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Analyse...
            </span>
          ) : 'Analyser →'}
        </button>
      </div>

      {loading && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{background: '#0F3028', border: '1px solid #1D9E75', color: '#9FE1CB'}}>
          ⏳ Pipeline IA en cours — résultats dans ~30 secondes
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{background: '#2D1515', border: '1px solid #E24B4A', color: '#F87171'}}>
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-white">{result.strategy_name || 'Résultats'}</span>
            <span className="text-xs px-2 py-1 rounded-full" style={{background: '#0F3028', color: '#1D9E75'}}>
              {result.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Sharpe Ratio', value: result.metrics.sharpe_ratio, color: '#fff' },
              { label: 'Max Drawdown', value: `${result.metrics.max_drawdown_pct}%`, color: '#E24B4A' },
              { label: 'Total Return', value: `+${result.metrics.total_return_pct}%`, color: '#1D9E75' },
              { label: 'Win Rate', value: `${result.metrics.win_rate_pct}%`, color: '#fff' },
            ].map((m) => (
              <div key={m.label} style={{background: '#1a1c24', border: '1px solid #2a2a2a'}} className="rounded-lg p-4">
                <p className="text-xs mb-1" style={{color: '#666'}}>{m.label}</p>
                <p className="text-2xl font-semibold" style={{color: m.color}}>{m.value}</p>
              </div>
            ))}
          </div>

          {getWarning(result.metrics) && (
            <div className="mt-3 p-3 rounded-lg text-sm" style={{background: '#2D2510', border: '1px solid #FAC775', color: '#FAC775'}}>
              {getWarning(result.metrics)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}