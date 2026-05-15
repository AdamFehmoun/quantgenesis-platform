'use client';
import { useState } from 'react';

export default function Chat() {
  const [intent, setIntent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAnalyse = async () => {
    if (!intent.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent })
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setResult('Erreur : backend non disponible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg max-w-xl mx-auto mt-5">
      <h2 className="text-xl font-bold mb-4">QuantGenesis</h2>
      <input
        className="border p-2 flex-1 w-full mb-3 rounded"
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

      {result && (
        <pre className="mt-4 p-3 bg-gray-100 rounded text-sm overflow-auto">
          {result}
        </pre>
      )}
    </div>
  );
}