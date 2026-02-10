import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Key,
  Activity,
  Zap,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Clock,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '../services/api';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6'];

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex items-center gap-4 animate-fade-in">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-card p-5 h-24">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
              <div className="space-y-2">
                <div className="h-3 w-20 bg-gray-200 rounded" />
                <div className="h-6 w-16 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-card p-6 h-80">
            <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
            <div className="h-full bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: overview, isLoading: loadingOverview, error: overviewError, refetch: refetchOverview } = useQuery({
    queryKey: ['admin', 'stats', 'overview'],
    queryFn: () => api.admin.stats.overview(),
    refetchInterval: 30_000,
  });

  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ['admin', 'stats', 'daily'],
    queryFn: () => api.admin.stats.daily({ days: 30 }),
    refetchInterval: 30_000,
  });

  const { data: topUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin', 'stats', 'byUser'],
    queryFn: () => api.admin.stats.byUser({ days: 30 }),
    refetchInterval: 30_000,
  });

  const { data: modelData, isLoading: loadingModels } = useQuery({
    queryKey: ['admin', 'stats', 'byModel'],
    queryFn: () => api.admin.stats.byModel({}),
    refetchInterval: 30_000,
  });

  const { data: deptData, isLoading: loadingDepts } = useQuery({
    queryKey: ['admin', 'stats', 'byDept'],
    queryFn: () => api.admin.stats.byDept({}),
    refetchInterval: 30_000,
  });

  const { data: dauData, isLoading: loadingDau } = useQuery({
    queryKey: ['admin', 'stats', 'dau'],
    queryFn: () => api.admin.stats.dau({ days: 30, excludeHolidays: true }),
    refetchInterval: 30_000,
  });

  const { data: latencyData, isLoading: loadingLatency } = useQuery({
    queryKey: ['admin', 'stats', 'latency'],
    queryFn: () => api.admin.stats.latency(),
    refetchInterval: 30_000,
  });

  const { data: latencyHistory, isLoading: loadingLatencyHistory } = useQuery({
    queryKey: ['admin', 'stats', 'latencyHistory'],
    queryFn: () => api.admin.stats.latencyHistory({ hours: 24 }),
    refetchInterval: 30_000,
  });

  const isLoading = loadingOverview || loadingDaily || loadingUsers || loadingModels || loadingDepts || loadingDau;

  if (overviewError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">데이터를 불러오는데 실패했습니다.</p>
        <button
          onClick={() => refetchOverview()}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          다시 시도
        </button>
      </div>
    );
  }

  if (isLoading && !overview) {
    return <LoadingSkeleton />;
  }

  const stats = overview;

  // Business day averages from daily data
  const bizAvg = dailyData?.averages?.businessDays;
  const avgDailyTokens = bizAvg
    ? formatNumber(Math.round((bizAvg.avgInputTokens ?? 0) + (bizAvg.avgOutputTokens ?? 0)))
    : '-';

  // Average latency from latency data
  const latencyModels: Array<{ modelName: string; avgLatencyMs: number; p50LatencyMs: number | null; p95LatencyMs: number | null; requestCount: number }> = latencyData?.data ?? [];
  const avgLatency = latencyModels.length > 0
    ? Math.round(latencyModels.reduce((sum, m) => sum + m.avgLatencyMs * m.requestCount, 0) / latencyModels.reduce((sum, m) => sum + m.requestCount, 0))
    : null;

  // Prepare model chart data with flat modelName field
  const modelChartData = (modelData?.data ?? []).map((m: { model?: { displayName?: string; name?: string }; outputTokens: number; inputTokens: number; requests: number }) => ({
    ...m,
    modelName: m.model?.displayName || m.model?.name || 'Unknown',
  }));

  // Prepare dept chart data
  const deptChartData = deptData?.data ?? [];

  // Prepare top users data with flat loginid/username
  const topUsersData = (topUsers?.data ?? []).map((u: { user?: { loginid?: string; username?: string }; requests: number; inputTokens: number; outputTokens: number }) => ({
    ...u,
    loginid: u.user?.loginid || 'Unknown',
    username: u.user?.username || 'Unknown',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <button
          onClick={() => refetchOverview()}
          className="px-3 py-2 text-sm text-gray-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* Summary Cards - 9 cards, 3x3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="전체 사용자" value={formatNumber(stats?.totalUsers ?? 0)} color="bg-blue-500" />
        <StatCard icon={Users} label="활성 사용자 (5분)" value={formatNumber(stats?.activeUsersLast5Min ?? 0)} color="bg-green-500" />
        <StatCard icon={Key} label="활성 토큰" value={formatNumber(stats?.activeTokens ?? 0)} color="bg-purple-500" />
        <StatCard icon={Activity} label="오늘 요청 수" value={formatNumber(stats?.todayRequests ?? 0)} color="bg-brand-500" />
        <StatCard icon={ArrowDownRight} label="오늘 입력 토큰" value={formatNumber(stats?.todayInputTokens ?? 0)} color="bg-cyan-500" />
        <StatCard icon={ArrowUpRight} label="오늘 출력 토큰" value={formatNumber(stats?.todayOutputTokens ?? 0)} color="bg-amber-500" />
        <StatCard
          icon={Zap}
          label="일평균 토큰 (영업일)"
          value={avgDailyTokens}
          color="bg-teal-500"
          sub={bizAvg ? `${bizAvg.days ?? 0}일 기준` : undefined}
        />
        <StatCard
          icon={Clock}
          label="평균 Latency"
          value={avgLatency !== null ? `${avgLatency}ms` : '-'}
          color="bg-indigo-500"
          sub="최근 1시간"
        />
        <StatCard icon={AlertTriangle} label="에러율" value={`${(stats?.errorRate ?? 0).toFixed(1)}%`} color="bg-red-500" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Trend - Stacked bar (input/output tokens) + line (requests) */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">일별 사용량 추이 (30일)</h3>
          {loadingDaily ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData?.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis yAxisId="tokens" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                <YAxis yAxisId="requests" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatNumber(value), name]}
                  labelFormatter={(label: string) => `날짜: ${label}`}
                />
                <Legend />
                <Bar yAxisId="tokens" dataKey="inputTokens" name="입력 토큰" fill="#06B6D4" stackId="tokens" radius={[0, 0, 0, 0]} />
                <Bar yAxisId="tokens" dataKey="outputTokens" name="출력 토큰" fill="#8B5CF6" stackId="tokens" radius={[2, 2, 0, 0]} />
                <Line yAxisId="requests" type="monotone" dataKey="requests" name="요청 수" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* DAU Trend */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">일별 활성 사용자 (주말/휴일 제외)</h3>
          {loadingDau ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dauData?.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(label: string) => `날짜: ${label}`} />
                <Line
                  type="monotone"
                  dataKey="activeUsers"
                  name="활성 사용자"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Model Usage */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">모델별 사용량</h3>
          {loadingModels ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={modelChartData}
                  dataKey="outputTokens"
                  nameKey="modelName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ modelName, percent }: { modelName: string; percent: number }) =>
                    `${modelName} (${(percent * 100).toFixed(0)}%)`
                  }
                  labelLine={{ strokeWidth: 1 }}
                >
                  {modelChartData.map((_: unknown, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatNumber(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Department Usage */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">부서별 사용량</h3>
          {loadingDepts ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={deptChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                <YAxis
                  type="category"
                  dataKey="deptname"
                  tick={{ fontSize: 11 }}
                  width={100}
                />
                <Tooltip formatter={(value: number) => formatNumber(value)} />
                <Legend />
                <Bar dataKey="inputTokens" name="입력 토큰" fill="#06B6D4" radius={[0, 2, 2, 0]} />
                <Bar dataKey="outputTokens" name="출력 토큰" fill="#EC4899" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Latency Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Table */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            모델별 Latency (최근 1시간)
          </h3>
          {loadingLatency ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : latencyModels.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">최근 1시간 데이터 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 font-medium text-gray-500">모델</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Avg</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">P50</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">P95</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">요청</th>
                  </tr>
                </thead>
                <tbody>
                  {latencyModels.map((m) => (
                    <tr key={m.modelName} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{m.modelName}</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">{m.avgLatencyMs}ms</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">{m.p50LatencyMs ?? '-'}ms</td>
                      <td className="py-2.5 px-3 text-right text-gray-700">{m.p95LatencyMs ?? '-'}ms</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{m.requestCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Latency History Chart */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Latency 추이 (24시간)</h3>
          {loadingLatencyHistory ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={(() => {
                // Aggregate per-model-hour data into per-hour
                const hourMap = new Map<string, { totalLatency: number; maxP95: number; count: number }>();
                for (const row of (latencyHistory?.data ?? []) as Array<{ hour: string; avgLatencyMs: number; p95LatencyMs: number; requestCount: number }>) {
                  const existing = hourMap.get(row.hour);
                  if (existing) {
                    existing.totalLatency += row.avgLatencyMs * row.requestCount;
                    existing.maxP95 = Math.max(existing.maxP95, row.p95LatencyMs);
                    existing.count += row.requestCount;
                  } else {
                    hourMap.set(row.hour, { totalLatency: row.avgLatencyMs * row.requestCount, maxP95: row.p95LatencyMs, count: row.requestCount });
                  }
                }
                return [...hourMap.entries()].map(([hour, v]) => ({
                  hour,
                  avgLatencyMs: Math.round(v.totalLatency / v.count),
                  p95LatencyMs: Math.round(v.maxP95),
                }));
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v?.slice(11, 16) ?? v}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}ms`} />
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}ms`, name]}
                  labelFormatter={(label: string) => `시간: ${label?.slice(11, 16) ?? label}`}
                />
                <Legend />
                <Line type="monotone" dataKey="avgLatencyMs" name="평균 Latency" stroke="#6366F1" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="p95LatencyMs" name="P95 Latency" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Users Table */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-500" />
          상위 사용자 (출력 토큰 기준)
        </h3>
        {loadingUsers ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">순위</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">사용자 ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">이름</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">요청 수</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">입력 토큰</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">출력 토큰</th>
                </tr>
              </thead>
              <tbody>
                {topUsersData.map((user: { loginid: string; username: string; requests: number; inputTokens: number; outputTokens: number }, index: number) => (
                  <tr key={user.loginid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index < 3 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-700">{user.loginid}</td>
                    <td className="py-3 px-4 text-gray-900">{user.username}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{formatNumber(user.requests)}</td>
                    <td className="py-3 px-4 text-right text-gray-600">{formatNumber(user.inputTokens)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatNumber(user.outputTokens)}</td>
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
