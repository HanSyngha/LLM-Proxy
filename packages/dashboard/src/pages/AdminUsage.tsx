import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Calendar,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { api } from '../services/api';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#F97316', '#06B6D4'];

type Tab = 'overview' | 'user' | 'model' | 'department' | 'token';
type Preset = '7d' | '30d' | '90d' | 'custom';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function getDateRange(preset: Preset, customStart: string, customEnd: string) {
  if (preset === 'custom' && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { days: diffDays };
  }

  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  return { days };
}

function exportToCsv(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<Preset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo(() => getDateRange(preset, customStart, customEnd), [preset, customStart, customEnd]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: '개요' },
    { key: 'user', label: '사용자별' },
    { key: 'model', label: '모델별' },
    { key: 'department', label: '부서별' },
    { key: 'token', label: '토큰별' },
  ];

  const { data: dailyData, isLoading: loadingDaily, error: dailyError, refetch: refetchDaily } = useQuery({
    queryKey: ['admin', 'usage', 'daily', dateRange],
    queryFn: () => api.admin.stats.daily({ ...dateRange }),
  });

  const { data: userData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin', 'usage', 'byUser', dateRange],
    queryFn: () => api.admin.stats.byUser({ ...dateRange }),
    enabled: activeTab === 'user',
  });

  const { data: modelData, isLoading: loadingModels } = useQuery({
    queryKey: ['admin', 'usage', 'byModel', dateRange],
    queryFn: () => api.admin.stats.byModel({ ...dateRange }),
    enabled: activeTab === 'model' || activeTab === 'overview',
  });

  const { data: deptData, isLoading: loadingDepts } = useQuery({
    queryKey: ['admin', 'usage', 'byDept', dateRange],
    queryFn: () => api.admin.stats.byDept({ ...dateRange }),
    enabled: activeTab === 'department',
  });

  const { data: tokenData, isLoading: loadingTokens } = useQuery({
    queryKey: ['admin', 'usage', 'byToken', dateRange],
    queryFn: () => api.admin.stats.byToken({ ...dateRange }),
    enabled: activeTab === 'token',
  });

  const { data: dauData, isLoading: loadingDau } = useQuery({
    queryKey: ['admin', 'usage', 'dau', dateRange],
    queryFn: () => api.admin.stats.dau({ ...dateRange }),
    enabled: activeTab === 'overview',
  });

  // Preprocess nested data for charts/tables
  const userChartData = (userData?.data ?? []).map((u: { user?: { loginid?: string; username?: string }; requests: number; outputTokens: number; inputTokens: number }) => ({
    ...u,
    loginid: u.user?.loginid || 'Unknown',
    username: u.user?.username || 'Unknown',
  }));

  const modelChartData = (modelData?.data ?? []).map((m: { model?: { displayName?: string; name?: string }; requests: number; outputTokens: number; inputTokens: number }) => ({
    ...m,
    modelName: m.model?.displayName || m.model?.name || 'Unknown',
  }));

  const tokenChartData = (tokenData?.data ?? []).map((t: { token?: { name?: string; prefix?: string; user?: { loginid?: string } }; requests: number; outputTokens: number; inputTokens: number }) => ({
    ...t,
    tokenName: t.token?.name || t.token?.prefix || 'N/A',
    loginid: t.token?.user?.loginid || '-',
  }));

  const handleExport = () => {
    let exportData: Record<string, unknown>[] = [];
    let filename = 'usage';

    switch (activeTab) {
      case 'overview':
        exportData = dailyData?.data ?? [];
        filename = 'daily_usage';
        break;
      case 'user':
        exportData = userChartData;
        filename = 'user_usage';
        break;
      case 'model':
        exportData = modelChartData;
        filename = 'model_usage';
        break;
      case 'department':
        exportData = deptData?.data ?? [];
        filename = 'department_usage';
        break;
      case 'token':
        exportData = tokenChartData;
        filename = 'token_usage';
        break;
    }

    exportToCsv(exportData, filename);
  };

  if (dailyError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">사용량 데이터를 불러오는데 실패했습니다.</p>
        <button onClick={() => refetchDaily()} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-500" />
          사용량 분석
        </h1>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV 내보내기
        </button>
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-xl shadow-card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="flex gap-2">
            {(['7d', '30d', '90d', 'custom'] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  preset === p
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p === '7d' ? '7일' : p === '30d' ? '30일' : p === '90d' ? '90일' : '직접 선택'}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Daily Trend */}
          <div className="bg-white rounded-xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">일별 사용량 추이</h3>
            {loadingDaily ? (
              <div className="h-72 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyData?.data ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="requests" name="요청 수" stroke="#6366F1" fill="#6366F1" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="outputTokens" name="출력 토큰" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* DAU + Model Usage */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">누적 활성 사용자</h3>
              {loadingDau ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dauData?.data ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="activeUsers" name="활성 사용자" stroke="#10B981" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">모델별 사용량</h3>
              {loadingModels ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={modelChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="modelName" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                    <Tooltip formatter={(value: number) => formatNumber(value)} />
                    <Bar dataKey="outputTokens" name="출력 토큰" radius={[4, 4, 0, 0]}>
                      {modelChartData.map((_: unknown, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'user' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">사용자별 사용량</h3>
            {loadingUsers ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={userChartData.slice(0, 20)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                  <YAxis type="category" dataKey="loginid" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                  <Bar dataKey="requests" name="요청 수" fill="#6366F1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="outputTokens" name="출력 토큰" fill="#EC4899" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">사용자 ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">이름</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">요청 수</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">출력 토큰</th>
                  </tr>
                </thead>
                <tbody>
                  {userChartData.map((u: { loginid: string; username: string; requests: number; outputTokens: number }) => (
                    <tr key={u.loginid} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-gray-700">{u.loginid}</td>
                      <td className="py-2.5 px-4 text-gray-900">{u.username}</td>
                      <td className="py-2.5 px-4 text-right">{u.requests.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{u.outputTokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'model' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">모델별 사용량</h3>
            {loadingModels ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={modelChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="modelName" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                  <Bar dataKey="requests" name="요청 수" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outputTokens" name="출력 토큰" fill="#EC4899" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">모델</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">요청 수</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">출력 토큰</th>
                  </tr>
                </thead>
                <tbody>
                  {modelChartData.map((m: { modelName: string; requests: number; outputTokens: number }) => (
                    <tr key={m.modelName} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium text-gray-900">{m.modelName}</td>
                      <td className="py-2.5 px-4 text-right">{m.requests.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{m.outputTokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'department' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">부서별 사용량</h3>
            {loadingDepts ? (
              <div className="h-72 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptData?.data ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatNumber(v)} />
                  <YAxis type="category" dataKey="deptname" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                  <Bar dataKey="requests" name="요청 수" fill="#6366F1" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="outputTokens" name="출력 토큰" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">부서</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">요청 수</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500">출력 토큰</th>
                  </tr>
                </thead>
                <tbody>
                  {(deptData?.data ?? []).map((d: { deptname: string; requests: number; outputTokens: number }) => (
                    <tr key={d.deptname} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium text-gray-900">{d.deptname}</td>
                      <td className="py-2.5 px-4 text-right">{d.requests.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right font-medium">{d.outputTokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'token' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">토큰별 사용량</h3>
            {loadingTokens ? (
              <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">토큰 이름</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">사용자</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600">요청 수</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-600">출력 토큰</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenChartData.map((t: { tokenName: string; loginid: string; requests: number; outputTokens: number }, i: number) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2.5 px-4 font-medium text-gray-900">{t.tokenName || 'N/A'}</td>
                        <td className="py-2.5 px-4 text-gray-600">{t.loginid || '-'}</td>
                        <td className="py-2.5 px-4 text-right">{t.requests.toLocaleString()}</td>
                        <td className="py-2.5 px-4 text-right font-medium">{t.outputTokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
