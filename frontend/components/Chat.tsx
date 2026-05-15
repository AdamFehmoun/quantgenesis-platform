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
      const res = await fetch('https://detached-twig-patriot.ngrok-free.dev/api/pipeline/run', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
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

  return (
    <div className="p-4 border rounded-lg max-w-xl mx-auto mt-5">
      <h2 className="text-xl font-bold mb-4">QuantGenesis</h2>

      <input
        className="border p-2 w-full mb-3 rounded"
        value={intent}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIntent(e.target.value)}
        placeholder="Décris ta stratégie en français..."
        disabled={loading}
      />

      <button
        onClick={handleAnalyse}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Analyse en cours...
          </span>
        ) : 'Analyser →'}
      </button>

      {loading && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          ⏳ Pipeline IA en cours — résultats dans ~30 secondes
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <p className="text-sm text-gray-500 mb-3">
            {result.strategy_name} — <span className="text-green-600 font-medium">{result.status}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border rounded p-3">
              <p className="text-xs text-gray-400">Sharpe Ratio</p>
              <p className="text-xl font-bold">{result.metrics.sharpe_ratio}</p>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-gray-400">Max Drawdown</p>
              <p className="text-xl font-bold text-red-500">{result.metrics.max_drawdown_pct}%</p>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-gray-400">Total Return</p>
              <p className="text-xl font-bold text-green-600">+{result.metrics.total_return_pct}%</p>
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-gray-400">Win Rate</p>
              <p className="text-xl font-bold">{result.metrics.win_rate_pct}%</p>
            </div>
          </div>

          {getWarning(result.metrics) && (
            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-yellow-800">
              {getWarning(result.metrics)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}