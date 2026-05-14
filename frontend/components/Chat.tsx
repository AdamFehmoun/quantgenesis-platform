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
      />
      <button
        onClick={handleAnalyse}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full"
      >
        {loading ? 'Analyse en cours...' : 'Analyser →'}
      </button>
      {result && (
        <pre className="mt-4 p-3 bg-gray-100 rounded text-sm overflow-auto">
          {result}
        </pre>
      )}
    </div>
  );
}