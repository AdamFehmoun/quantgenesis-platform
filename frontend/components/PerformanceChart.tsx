'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// ============================================================
// DONNÉES MOCK — à remplacer par BacktestResult.chart_data
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

const tooltipStyle = { background: '#1a1c24', border: '1px solid #2a2a2a', borderRadius: 8, color: '#fff', fontSize: 12 };

export default function PerformanceChart() {
  return (
    <div style={{background: '#16181F', border: '1px solid #2a2a2a'}} className="rounded-xl p-6">
      <h3 className="text-white font-semibold mb-1">Performance du portefeuille</h3>
      <p className="text-xs mb-6" style={{color: '#666'}}>Equity curve — données mock</p>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={MOCK_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="value" stroke="#1D9E75" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>

      <h3 className="text-white font-semibold mt-6 mb-1">Drawdown</h3>
      <p className="text-xs mb-4" style={{color: '#666'}}>Perte maximale depuis un pic</p>

      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={MOCK_DATA}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <ReferenceLine y={0} stroke="#333" />
          <Line type="monotone" dataKey="drawdown" stroke="#E24B4A" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}