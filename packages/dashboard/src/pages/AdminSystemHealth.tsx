import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Database,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Zap,
  Clock,
} from 'lucide-react';
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
import { api } from '../services/api';

// Backend endpoint response structure:
// { modelId, name, displayName, endpointUrl, enabled, circuitBreaker: { isHealthy, consecutiveFails, cooldownUntil }, subModels: [...] }
interface EndpointData {
  modelId: string;
  name: string;
  displayName?: string;
  endpointUrl: string;
  enabled: boolean;
  circuitBreaker?: {
    isHealthy: boolean;
    consecutiveFails: number;
    cooldownUntil?: string | null;
  };
}

// Backend error-rates response: { hourly: [...], daily: [...] }
// Each item: { modelName, totalRequests, errorRequests, errorRate (0-100) }
interface ErrorRateModel {
  modelName: string;
  errorRate: number;
  totalRequests: number;
  errorRequests: number;
}

// Backend latency response: { data: [...], periodMinutes }
// Each item: { modelId, modelName, avgLatencyMs, minLatencyMs, maxLatencyMs, p50LatencyMs, p95LatencyMs, requestCount }
interface LatencyModel {
  modelName: string;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

function StatusCard({
  icon: Icon,
  label,
  status,
  details,
}: {
  icon: React.ElementType;
  label: string;
  status: 'connected' | 'error' | 'loading';
  details?: string;
}) {
  const colors = {
    connected: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    loading: 'bg-gray-50 border-gray-200',
  };

  const statusColors = {
    connected: 'text-green-600',
    error: 'text-red-600',
    loading: 'text-gray-400',
  };

  const statusLabels = {
    connected: '연결됨',
    error: '오류',
    loading: '확인 중...',
  };

  return (
    <div className={`rounded-xl border-2 p-5 ${colors[status]}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-8 h-8 ${statusColors[status]}`} />
        <div>
          <p className="font-semibold text-gray-900">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            {status === 'connected' ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : status === 'error' ? (
              <XCircle className="w-4 h-4 text-red-500" />
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            )}
            <span className={`text-sm font-medium ${statusColors[status]}`}>{statusLabels[status]}</span>
          </div>
          {details && <p className="text-xs text-gray-500 mt-1">{details}</p>}
        </div>
      </div>
    </div>
  );
}

export default function AdminSystemHealth() {
  const queryClient = useQueryClient();

  const { data: healthData, isLoading: loadingHealth, error: healthError, refetch: refetchHealth } = useQuery({
    queryKey: ['admin', 'system', 'health'],
    queryFn: () => api.admin.system.health(),
    refetchInterval: 30_000,
  });

  const { data: endpointsData, isLoading: loadingEndpoints } = useQuery({
    queryKey: ['admin', 'system', 'endpoints'],
    queryFn: () => api.admin.system.endpoints(),
    refetchInterval: 30_000,
  });

  const { data: errorRatesData, isLoading: loadingErrorRates } = useQuery({
    queryKey: ['admin', 'system', 'errorRates'],
    queryFn: () => api.admin.system.errorRates(),
  });

  const { data: latencyData, isLoading: loadingLatency } = useQuery({
    queryKey: ['admin', 'stats', 'latency'],
    queryFn: () => api.admin.stats.latency(),
  });

  const [checkingModelId, setCheckingModelId] = useState<string | null>(null);
  const checkEndpointMut = useMutation({
    mutationFn: (modelId: string) => { setCheckingModelId(modelId); return api.admin.system.checkEndpoint(modelId); },
    onSuccess: () => {
      setCheckingModelId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'endpoints'] });
      console.log('엔드포인트 확인 완료');
    },
    onError: () => { setCheckingModelId(null); console.log('엔드포인트 확인 실패'); },
  });

  const checkAllMut = useMutation({
    mutationFn: () => api.admin.system.checkAllEndpoints(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'endpoints'] });
      console.log('전체 엔드포인트 확인 완료');
    },
    onError: () => console.log('전체 엔드포인트 확인 실패'),
  });

  // Flatten endpoint data for display
  const endpoints: EndpointData[] = endpointsData?.endpoints ?? [];
  // Error rates: use hourly data for the chart
  const errorRates: ErrorRateModel[] = errorRatesData?.hourly ?? [];
  // Latency: backend returns { data, periodMinutes }
  const latencies: LatencyModel[] = latencyData?.data ?? [];

  // DB/Redis status: check the .healthy field inside the objects
  const dbStatus = loadingHealth ? 'loading' : healthData?.database?.healthy ? 'connected' : 'error';
  const redisStatus = loadingHealth ? 'loading' : healthData?.redis?.healthy ? 'connected' : 'error';

  if (healthError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">시스템 상태를 불러오는데 실패했습니다.</p>
        <button onClick={() => refetchHealth()} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-brand-500" />
          시스템 상태
        </h1>
        <button
          onClick={() => refetchHealth()}
          className="px-3 py-2 text-sm text-gray-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          icon={Database}
          label="데이터베이스"
          status={dbStatus as 'connected' | 'error' | 'loading'}
          details={healthData?.database ? `${healthData.database.latencyMs}ms` : undefined}
        />
        <StatusCard
          icon={Server}
          label="Redis"
          status={redisStatus as 'connected' | 'error' | 'loading'}
          details={healthData?.redis ? `${healthData.redis.latencyMs}ms` : undefined}
        />
        <StatusCard
          icon={Zap}
          label="엔드포인트"
          status={
            loadingEndpoints
              ? 'loading'
              : endpoints.every((e) => e.circuitBreaker?.isHealthy !== false)
              ? 'connected'
              : 'error'
          }
          details={`${endpoints.filter((e) => e.circuitBreaker?.isHealthy !== false).length}/${endpoints.length} 정상`}
        />
      </div>

      {/* Endpoint Health Table */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">엔드포인트 상태</h3>
          <button
            onClick={() => checkAllMut.mutate()}
            disabled={checkAllMut.isPending}
            className="px-3 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {checkAllMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            전체 확인
          </button>
        </div>

        {loadingEndpoints ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : endpoints.length === 0 ? (
          <p className="text-center text-gray-400 py-8">등록된 엔드포인트가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">모델</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">엔드포인트 URL</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">상태</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">연속 실패</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((endpoint) => (
                  <tr key={endpoint.modelId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-4 text-gray-900 font-medium">{endpoint.displayName || endpoint.name}</td>
                    <td className="py-2.5 px-4 font-mono text-xs text-gray-700 max-w-xs truncate">{endpoint.endpointUrl}</td>
                    <td className="py-2.5 px-4 text-center">
                      {endpoint.circuitBreaker?.isHealthy !== false ? (
                        <CheckCircle className="w-5 h-5 text-green-500 inline" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 inline" />
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`font-medium ${(endpoint.circuitBreaker?.consecutiveFails ?? 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {endpoint.circuitBreaker?.consecutiveFails ?? 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => checkEndpointMut.mutate(endpoint.modelId)}
                        disabled={checkEndpointMut.isPending}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                      >
                        {checkingModelId === endpoint.modelId ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '확인'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Rates */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            모델별 에러율 (1시간)
          </h3>
          {loadingErrorRates ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
          ) : errorRates.length === 0 ? (
            <p className="text-center text-gray-400 py-12">데이터가 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={errorRates}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="modelName" tick={{ fontSize: 10 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === '에러율' ? `${value.toFixed(1)}%` : value.toLocaleString()
                  }
                />
                <Legend />
                <Bar dataKey="errorRate" name="에러율" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Latency */}
        <div className="bg-white rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            모델별 응답시간
          </h3>
          {loadingLatency ? (
            <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
          ) : latencies.length === 0 ? (
            <p className="text-center text-gray-400 py-12">데이터가 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={latencies}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="modelName" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} unit="ms" />
                <Tooltip formatter={(value: number) => `${value.toFixed(0)}ms`} />
                <Legend />
                <Bar dataKey="avgLatencyMs" name="평균" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="p95LatencyMs" name="P95" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
