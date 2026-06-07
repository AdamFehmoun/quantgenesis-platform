'use client';
import { BacktestResult } from '../app/page';

interface WhiteBoxProps {
  result: BacktestResult;
}

export default function WhiteBox({ result }: WhiteBoxProps) {
  // Code généré — vient du backtest si dispo, sinon final_spec
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
    <div style={{background: '#16181F', border: '1px solid #2a2a2a'}} className="rounded-xl p-6">
      <h3 className="text-white font-semibold mb-1">Code Python généré</h3>
      <p className="text-xs mb-4" style={{color: '#666'}}>Exportable — White-Box complet</p>

      <div style={{background: '#0d0f14', border: '1px solid #2a2a2a'}} className="rounded-lg p-4 mb-4 overflow-auto max-h-64">
        <pre className="text-xs font-mono" style={{color: '#9FE1CB', lineHeight: 1.7}}>{generatedCode}</pre>
      </div>

      <button
        onClick={handleExport}
        className="w-full py-3 rounded-lg font-medium text-sm text-white mb-6 transition-all"
        style={{background: '#1D9E75'}}
      >
        ⬇ Exporter strategy.py
      </button>

      <h3 className="text-white font-semibold mb-1">Log de conformité AI Act</h3>
      <p className="text-xs mb-4" style={{color: '#666'}}>Décisions traçables — Article 12</p>

      <div style={{border: '1px solid #2a2a2a'}} className="rounded-lg overflow-hidden">
        {compliance ? (
          Object.entries(compliance).map(([key, value], index, arr) => (
            <div
              key={key}
              className="flex justify-between items-start p-4"
              style={{borderBottom: index < arr.length - 1 ? '1px solid #2a2a2a' : 'none', background: '#1a1c24'}}
            >
              <div>
                <p className="text-sm font-medium text-white">{key}</p>
                <p className="text-xs mt-0.5" style={{color: '#555'}}>
                  {typeof value === 'object' ? JSON.stringify(value).slice(0, 80) + '...' : String(value)}
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ml-2" style={{background: '#0F3028', color: '#1D9E75'}}>
                ✓
              </span>
            </div>
          ))
        ) : (
          <div className="p-4" style={{background: '#1a1c24'}}>
            <p className="text-sm" style={{color: '#555'}}>Log de conformité non disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}