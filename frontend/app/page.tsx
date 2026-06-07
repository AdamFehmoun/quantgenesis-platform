'use client';
import { useState } from 'react';
import Chat from "../components/Chat";
import PerformanceChart from "../components/PerformanceChart";
import WhiteBox from "../components/WhiteBox";
import AuditTrail from "../components/AuditTrail";

export interface BacktestResult {
  status: string;
  strategy_name?: string;
  intent?: string;
  metrics: {
    sharpe_ratio: number;
    max_drawdown_pct: number;
    total_return_pct: number;
    num_trades: number;
    win_rate_pct: number;
  };
  backtest?: {
    status: string;
    error?: string;
    generated_code?: string;
  };
  final_spec?: {
    architecture?: Record<string, unknown>;
    functions?: unknown[];
  };
  compliance_log?: {
    compliance_record?: Record<string, unknown>;
    decision_trace?: Record<string, unknown>;
  };
  pipeline?: {
    status: string;
    pipeline_start?: string;
  };
}

export default function Home() {
  const [result, setResult] = useState<BacktestResult | null>(null);

  return (
    <main className="min-h-screen" style={{background: '#0F1117'}}>
      <div style={{background: '#16181F', borderBottom: '1px solid #2a2a2a'}} className="px-8 py-4 flex items-center justify-between">
        <span className="font-semibold text-white">Quant<span style={{color: '#1D9E75'}}>Genesis</span></span>
        <span className="text-xs px-3 py-1 rounded-full" style={{background: '#1e2028', color: '#888'}}>White-Box Trading Platform</span>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
        <Chat onResult={setResult} />
        <PerformanceChart />
        {result && <WhiteBox result={result} />}
        {result && <AuditTrail result={result} />}
      </div>
    </main>
  );
}