'use client';
import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { BacktestResult } from '../app/page';

interface SavedStrategy {
  id: string;
  savedAt: string;
  intent: string;
  strategy_name: string;
  status: string;
  metrics: BacktestResult['metrics'];
  full: BacktestResult;
}

interface StrategyHistoryProps {
  onLoad: (result: BacktestResult) => void;
}

const loadFromStorage = (): SavedStrategy[] => {
  try {
    const raw = localStorage.getItem('qg_strategy_history');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export default function StrategyHistory({ onLoad }: StrategyHistoryProps) {
  const [history, setHistory] = useState<SavedStrategy[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setHistory(loadFromStorage());

    const handleUpdate = () => {
      setHistory(loadFromStorage());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    };

    window.addEventListener('qg_history_updated', handleUpdate);
    return () => window.removeEventListener('qg_history_updated', handleUpdate);
  }, []);

  const handleDelete = (id: string) => {
    const updated = history.filter((s) => s.id !== id);
    try { localStorage.setItem('qg_strategy_history', JSON.stringify(updated)); } catch {}
    setHistory(updated);
  };

  const handleClearAll = () => {
    try { localStorage.removeItem('qg_strategy_history'); } catch {}
    setHistory([]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
      ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const isFallback = (status: string) => status === 'FALLBACK';

  if (history.length === 0) return null;

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.35)' }} className="rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-semibold" style={{ fontFamily: 'Manrope' }}>Historique des stratégies</h3>
        {justSaved && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Check size={12} strokeWidth={2.5} /> Sauvegardé
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
          {history.length} stratégie{history.length > 1 ? 's' : ''} — stockées localement
        </p>
        <button
          onClick={handleClearAll}
          className="text-xs transition-all"
          style={{ color: 'rgba(244,243,248,0.4)', fontFamily: 'Manrope' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(244,243,248,0.4)')}
        >
          Tout effacer
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {history.map((s) => (
          <div
            key={s.id}
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            className="rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-white truncate" style={{ fontFamily: 'Manrope' }}>{s.strategy_name}</p>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: isFallback(s.status) ? 'rgba(217,119,6,0.15)' : 'rgba(34,197,94,0.12)',
                    color: isFallback(s.status) ? '#FAC775' : '#22c55e',
                    border: `1px solid ${isFallback(s.status) ? 'rgba(217,119,6,0.3)' : 'rgba(34,197,94,0.25)'}`,
                    fontFamily: 'Manrope',
                  }}
                >
                  {s.status}
                </span>
              </div>
              <p className="text-xs mb-2 truncate" style={{ color: 'rgba(244,243,248,0.45)', fontFamily: 'Inter' }}>{s.intent}</p>
              <div className="flex gap-4 flex-wrap">
                <span className="text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
                  Sharpe <span className="text-white font-medium">{s.metrics.sharpe_ratio}</span>
                </span>
                <span className="text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
                  DD <span style={{ color: '#F87171' }} className="font-medium">{s.metrics.max_drawdown_pct}%</span>
                </span>
                <span className="text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
                  Return <span style={{ color: '#22c55e' }} className="font-medium">+{s.metrics.total_return_pct}%</span>
                </span>
                <span className="text-xs" style={{ color: 'rgba(244,243,248,0.5)', fontFamily: 'Inter' }}>
                  WR <span className="text-white font-medium">{s.metrics.win_rate_pct}%</span>
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: 'rgba(244,243,248,0.4)', fontFamily: 'Inter' }}>{formatDate(s.savedAt)}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onLoad(s.full)}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(120deg,#7b39fc,#06B6D4)', fontFamily: 'Manrope', boxShadow: '0 6px 18px rgba(123,57,252,0.3)' }}
                >
                  Charger
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', color: 'rgba(244,243,248,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(244,243,248,0.5)')}
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}