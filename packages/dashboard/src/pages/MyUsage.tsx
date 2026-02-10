import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { myUsage } from '../services/api';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Activity,
  Coins,
  Clock,
  CalendarDays,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Shield,
} from 'lucide-react';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  try {
    return format(new Date(d), 'yyyy-MM-dd HH:mm');
  } catch {
    return '-';
  }
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color = 'brand',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.brand}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function MyUsage() {
  const [recentPage, setRecentPage] = useState(0);
  const pageSize = 20;

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['my-usage-summary'],
    queryFn: myUsage.summary,
  });

  const { data: dailyData, isLoading: dailyLoading } = useQuery({
    queryKey: ['my-usage-daily'],
    queryFn: () => myUsage.daily(30),
  });

  const { data: modelData } = useQuery({
    queryKey: ['my-usage-by-model'],
    queryFn: () => myUsage.byModel(30),
  });

  const { data: tokenData } = useQuery({
    queryKey: ['my-usage-by-token'],
    queryFn: () => myUsage.byToken(30),
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ['my-usage-recent', recentPage],
    queryFn: () => myUsage.recent(pageSize, recentPage * pageSize),
  });

  const summary = summaryData;
  const dailyStats = dailyData?.stats || [];
  const modelUsage = modelData?.usage || [];
  const tokenUsage = tokenData?.usage || [];
  const recentLogs = recentData?.logs || [];
  const recentTotal = recentData?.pagination?.total || 0;

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">내 사용량</h1>
        <p className="text-sm text-gray-500 mt-1">API 사용 현황을 확인하세요.</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="오늘 요청"
            value={formatNumber(summary.today.requests)}
            sub={`${formatNumber(summary.today.totalTokens)} tokens`}
            icon={<Activity size={18} />}
            color="brand"
          />
          <StatCard
            label="이번 주"
            value={formatNumber(summary.week.requests)}
            sub={`${formatNumber(summary.week.totalTokens)} tokens`}
            icon={<CalendarDays size={18} />}
            color="blue"
          />
          <StatCard
            label="이번 달"
            value={formatNumber(summary.month.requests)}
            sub={`${formatNumber(summary.month.totalTokens)} tokens`}
            icon={<TrendingUp size={18} />}
            color="green"
          />
          <StatCard
            label="오늘 Output Tokens"
            value={formatNumber(summary.today.outputTokens)}
            sub={`입력: ${formatNumber(summary.today.inputTokens)}`}
            icon={<Coins size={18} />}
            color="orange"
          />
        </div>
      )}

      {/* Budget card */}
      {summary?.budget?.monthlyOutputTokenBudget && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={18} className="text-brand-500" />
            <h3 className="font-semibold text-gray-900">월간 Output Token 제한</h3>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">사용량</span>
            <span className="font-medium text-gray-700">
              {formatNumber(summary.budget.monthlyOutputTokensUsed)} / {formatNumber(summary.budget.monthlyOutputTokenBudget)}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                summary.budget.monthlyOutputTokensUsed / summary.budget.monthlyOutputTokenBudget > 0.9
                  ? 'bg-red-500'
                  : summary.budget.monthlyOutputTokensUsed / summary.budget.monthlyOutputTokenBudget > 0.7
                    ? 'bg-yellow-500'
                    : 'bg-brand-500'
              }`}
              style={{
                width: `${Math.min(100, (summary.budget.monthlyOutputTokensUsed / summary.budget.monthlyOutputTokenBudget) * 100)}%`,
              }}
            />
          </div>
          {summary.budget.remaining !== null && (
            <p className="text-xs text-gray-400 mt-2">
              남은 한도: {formatNumber(summary.budget.remaining)} tokens
            </p>
          )}
        </div>
      )}

      {/* Daily chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4">일별 사용량 (최근 30일)</h3>
        {dailyLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-gray-300" size={24} />
          </div>
        ) : dailyStats.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={dailyStats} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px',
                }}
                formatter={(value: number, name: string) => [
                  formatNumber(value),
                  name === 'inputTokens' ? 'Input' : name === 'outputTokens' ? 'Output' : name === 'requests' ? '요청' : name,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value: string) =>
                  value === 'inputTokens' ? 'Input Tokens' : value === 'outputTokens' ? 'Output Tokens' : value === 'requests' ? '요청 수' : value
                }
              />
              <Bar dataKey="inputTokens" fill="#818CF8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="outputTokens" fill="#6366F1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Model & Token breakdown side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">모델별 사용량 (30일)</h3>
          {modelUsage.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">모델</th>
                    <th className="pb-2 font-medium text-right">요청</th>
                    <th className="pb-2 font-medium text-right">Output</th>
                    <th className="pb-2 font-medium text-right">지연시간</th>
                  </tr>
                </thead>
                <tbody>
                  {modelUsage.map((m: { modelId: string; modelDisplayName: string; requests: number; outputTokens: number; avgLatencyMs: number | null }) => (
                    <tr key={m.modelId} className="border-b border-gray-50">
                      <td className="py-2.5 font-medium text-gray-900">{m.modelDisplayName}</td>
                      <td className="py-2.5 text-right text-gray-600">{formatNumber(m.requests)}</td>
                      <td className="py-2.5 text-right text-gray-600">{formatNumber(m.outputTokens)}</td>
                      <td className="py-2.5 text-right text-gray-500">
                        {m.avgLatencyMs ? `${m.avgLatencyMs}ms` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Token breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">토큰별 사용량 (30일)</h3>
          {tokenUsage.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="pb-2 font-medium">토큰</th>
                    <th className="pb-2 font-medium text-right">요청</th>
                    <th className="pb-2 font-medium text-right">Output</th>
                    <th className="pb-2 font-medium text-right">지연시간</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenUsage.map((t: { tokenId: string; tokenName: string; tokenPrefix: string; requests: number; outputTokens: number; avgLatencyMs: number | null }) => (
                    <tr key={t.tokenId} className="border-b border-gray-50">
                      <td className="py-2.5">
                        <span className="font-medium text-gray-900">{t.tokenName}</span>
                        <span className="text-xs text-gray-400 ml-1.5">({t.tokenPrefix})</span>
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{formatNumber(t.requests)}</td>
                      <td className="py-2.5 text-right text-gray-600">{formatNumber(t.outputTokens)}</td>
                      <td className="py-2.5 text-right text-gray-500">
                        {t.avgLatencyMs ? `${t.avgLatencyMs}ms` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent requests */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">최근 요청</h3>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
              disabled={recentPage === 0}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-gray-500 text-xs">
              {recentPage * pageSize + 1}-{Math.min((recentPage + 1) * pageSize, recentTotal)} / {recentTotal}
            </span>
            <button
              onClick={() => setRecentPage((p) => p + 1)}
              disabled={(recentPage + 1) * pageSize >= recentTotal}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 rounded-lg transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {recentLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="animate-spin text-gray-300" size={24} />
          </div>
        ) : recentLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">요청 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-2 font-medium">시간</th>
                  <th className="pb-2 font-medium">모델</th>
                  <th className="pb-2 font-medium">토큰</th>
                  <th className="pb-2 font-medium text-right">Input</th>
                  <th className="pb-2 font-medium text-right">Output</th>
                  <th className="pb-2 font-medium text-right">
                    <Clock size={12} className="inline" /> 지연
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log: {
                  id: string;
                  timestamp: string;
                  modelName: string;
                  tokenName: string | null;
                  inputTokens: number;
                  outputTokens: number;
                  latencyMs: number | null;
                }) => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 text-gray-500 text-xs whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="py-2 font-medium text-gray-900">{log.modelName}</td>
                    <td className="py-2 text-gray-500 text-xs">{log.tokenName || '-'}</td>
                    <td className="py-2 text-right text-gray-600">{formatNumber(log.inputTokens)}</td>
                    <td className="py-2 text-right text-gray-600">{formatNumber(log.outputTokens)}</td>
                    <td className="py-2 text-right text-gray-500">
                      {log.latencyMs ? `${log.latencyMs}ms` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
