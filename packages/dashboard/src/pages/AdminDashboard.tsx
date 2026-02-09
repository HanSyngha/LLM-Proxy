import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Key,
  Activity,
  Zap,
  AlertTriangle,
  Clock,
  TrendingUp,
  RefreshCw,
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
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-5 flex items-center gap-4 animate-fade-in">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
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
    queryFn: () => api.admin.stats.byUser({ limit: 10, sort: 'outputTokens' }),
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
    queryFn: () => api.admin.stats.dau({ days: 30 }),
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="전체 사용자" value={formatNumber(stats?.totalUsers ?? 0)} color="bg-blue-500" />
        <StatCard icon={Users} label="활성 사용자" value={formatNumber(stats?.activeUsers ?? 0)} color="bg-green-500" />
        <StatCard icon={Key} label="전체 토큰" value={formatNumber(stats?.totalTokens ?? 0)} color="bg-purple-500" />
        <StatCard icon={Activity} label="오늘 요청 수" value={formatNumber(stats?.todayRequests ?? 0)} color="bg-brand-500" />
        <StatCard icon={Zap} label="오늘 출력 토큰" value={formatNumber(stats?.todayOutputTokens ?? 0)} color="bg-amber-500" />
        <StatCard icon={AlertTriangle} label="에러율" value={`${((stats?.errorRate ?? 0) * 100).toFixed(1)}%`} color="bg-red-500" />
        <StatCard icon={Clock} label="평균 응답시간" value={`${(stats?.avgLatency ?? 0).toFixed(0)}ms`} color="bg-teal-500" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Trend */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">일별 사용량 추이 (30일)</h3>
          {loadingDaily ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData?.stats ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                <Tooltip
                  formatter={(value: number) => formatNumber(value)}
                  labelFormatter={(label: string) => `날짜: ${label}`}
                />
                <Legend />
                <Bar dataKey="requests" name="요청 수" fill="#6366F1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="outputTokens" name="출력 토큰" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* DAU Trend */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">일별 활성 사용자 (DAU)</h3>
          {loadingDau ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dauData?.stats ?? []}>
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
                  data={modelData?.models ?? []}
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
                  {(modelData?.models ?? []).map((_: unknown, index: number) => (
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
              <BarChart data={deptData?.departments ?? []} layout="vertical">
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
                <Bar dataKey="requests" name="요청 수" fill="#6366F1" radius={[0, 2, 2, 0]} />
                <Bar dataKey="outputTokens" name="출력 토큰" fill="#EC4899" radius={[0, 2, 2, 0]} />
              </BarChart>
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
                  <th className="text-right py-3 px-4 font-medium text-gray-500">출력 토큰</th>
                </tr>
              </thead>
              <tbody>
                {(topUsers?.users ?? []).map((user: { loginid: string; username: string; requests: number; outputTokens: number }, index: number) => (
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
