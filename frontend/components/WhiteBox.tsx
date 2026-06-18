'use client';
import { useState } from 'react';
import { BacktestResult } from '../app/page';

interface WhiteBoxProps {
  result: BacktestResult;
}

export default function WhiteBox({ result }: WhiteBoxProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'compliance'>('code');

  const generatedCode = result.backtest?.generated_code
    || (result.final_spec ? JSON.stringify(result.final_spec, null, 2) : null)
    || '# Code non disponible — backtest en FALLBACK';

  const compliance = result.compliance_log;

  const handleExport = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'strategy.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(10,8,20,0.7)', border: '1px solid rgba(123,57,252,0.2)', backdropFilter: 'blur(24px)' }}>

      <div className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(123,57,252,0.12)', background: 'rgba(123,57,252,0.05)' }}>
        <span className="text-sm font-semibold text-white" style={{ fontFamily: 'Manrope' }}>🔬 White-Box</span>
        <span className="text-xs" style={{ color: '#666', fontFamily: 'Inter' }}>Transparence totale — code + conformité AI Act</span>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {(['code', 'compliance'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-6 py-3 text-xs font-semibold transition-all"
            style={{
              color: activeTab === tab ? '#a78bfa' : '#555',
              borderBottom: activeTab === tab ? '2px solid #7b39fc' : '2px solid transparent',
              background: 'transparent',
              fontFamily: 'Manrope',
            }}>
            {tab === 'code' ? '💻 Code Python' : '🛡️ AI Act Log'}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'code' && (
          <>
            {/* FIX overflow : word-break + white-space pre-wrap */}
            <div className="rounded-xl p-4 mb-4 overflow-auto max-h-72"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(123,57,252,0.15)' }}>
              <pre className="text-xs font-mono leading-relaxed"
                style={{ color: '#a78bfa', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                {generatedCode}
              </pre>
            </div>
            <button onClick={handleExport}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:scale-[1.01]"
              style={{ background: '#7b39fc', fontFamily: 'Manrope', boxShadow: '0 0 25px rgba(123,57,252,0.3)' }}>
              ⬇ Exporter strategy.py
            </button>
          </>
        )}

        {activeTab === 'compliance' && (
          <div className="flex flex-col gap-2">
            {compliance ? (
              Object.entries(compliance).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start p-4 rounded-xl"
                  style={{ background: 'rgba(123,57,252,0.05)', border: '1px solid rgba(123,57,252,0.12)' }}>
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-sm font-semibold text-white mb-0.5" style={{ fontFamily: 'Manrope' }}>{key}</p>
                    <p className="text-xs break-words" style={{ color: '#555', fontFamily: 'Inter' }}>
                      {typeof value === 'object' ? JSON.stringify(value).slice(0, 100) + '...' : String(value)}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full ml-2 flex-shrink-0"
                    style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', fontFamily: 'Manrope' }}>
                    ✓
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-center py-8" style={{ color: '#555', fontFamily: 'Inter' }}>
                Log de conformité non disponible
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}