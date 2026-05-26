'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

// ============================================================
// DONNÉES MOCK — à remplacer par les vraies données de Berkant
// Ces données viendront de : BacktestResult.chart_data
// Format attendu : { date: string, value: number, drawdown: number }[]
// ============================================================
const MOCK_DATA = [
  { date: '2024-01', value: 100, drawdown: 0 },
  { date: '2024-02', value: 108, drawdown: -2 },
  { date: '2024-03', value: 105, drawdown: -5 },
  { date: '2024-04', value: 115, drawdown: -1 },
  { date: '2024-05', value: 112, drawdown: -3 },
  { date: '2024-06', value: 120, drawdown: 0 },
  { date: '2024-07', value: 118, drawdown: -8 },
  { date: '2024-08', value: 125, drawdown: -2 },
  { date: '2024-09', value: 123, drawdown: -4 },
  { date: '2024-10', value: 130, drawdown: 0 },
  { date: '2024-11', value: 128, drawdown: -3 },
  { date: '2024-12', value: 135, drawdown: 0 },
];

// ============================================================
// QUAND BERKANT EST CONNECTÉ :
// Remplace MOCK_DATA par la prop data reçue depuis Chat.tsx
// Change l'interface pour accepter : { data: typeof MOCK_DATA }
// ============================================================

export default function PerformanceChart() {
  return (
    <div className="mt-6 border rounded-lg p-4">

      {/* Graphique performance */}
      <h3 className="text-sm font-semibold text-gray-600 mb-3">
        Performance du portefeuille
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={MOCK_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Graphique drawdown */}
      <h3 className="text-sm font-semibold text-gray-600 mt-6 mb-3">
        Drawdown
      </h3>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={MOCK_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <ReferenceLine y={0} stroke="#666" />
          <Line
            type="monotone"
            dataKey="drawdown"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}