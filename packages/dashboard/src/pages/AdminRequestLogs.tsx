import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FileText,
  Trash2,
  Filter,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';

interface LogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  modelName: string;
  statusCode: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  stream?: boolean;
  requestBody?: string;
  responseBody?: string;
  errorMessage?: string;
  apiToken?: {
    prefix: string;
    name: string;
    user?: { loginid: string; username: string };
  };
}

function LogDetailModal({
  logId,
  onClose,
}: {
  logId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<{ log: LogEntry }>({
    queryKey: ['admin', 'logs', logId],
    queryFn: () => api.admin.logs.get(logId),
  });

  const log = data?.log;

  const renderJson = (str?: string) => {
    if (!str) return <span className="text-gray-400">없음</span>;
    try {
      const parsed = JSON.parse(str);
      return (
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-80 overflow-y-auto font-mono whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return (
        <pre className="bg-gray-100 text-gray-700 p-4 rounded-lg text-xs overflow-x-auto max-h-80 overflow-y-auto font-mono whitespace-pre-wrap">
          {str}
        </pre>
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-500" />
            요청 로그 상세
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : log ? (
          <div className="p-6 space-y-6">
            {/* Log Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500">타임스탬프</p>
                <p className="font-mono text-xs">{new Date(log.timestamp).toLocaleString('ko-KR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">사용자</p>
                <p className="font-mono">{log.apiToken?.user?.loginid || log.userId || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">모델</p>
                <p>{log.modelName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">상태 코드</p>
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                  log.statusCode >= 200 && log.statusCode < 300
                    ? 'bg-green-100 text-green-700'
                    : log.statusCode >= 400
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {log.statusCode}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500">응답시간</p>
                <p>{log.latencyMs}ms</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">입력 토큰</p>
                <p>{(log.inputTokens ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">출력 토큰</p>
                <p>{(log.outputTokens ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">스트리밍</p>
                <p>{log.stream ? '예' : '아니오'}</p>
              </div>
            </div>

            {log.errorMessage && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-700">오류 메시지</p>
                <p className="text-sm text-red-600 mt-1">{log.errorMessage}</p>
              </div>
            )}

            {/* Request Body */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">요청 본문</h3>
              {renderJson(log.requestBody)}
            </div>

            {/* Response Body */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">응답 본문</h3>
              {renderJson(log.responseBody)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminRequestLogs() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    userId: '',
    modelName: '',
    statusCode: '',
    startDate: '',
    endDate: '',
  });
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('30');
  const [showFilters, setShowFilters] = useState(false);
  const limit = 50;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'logs', { ...filters, page, limit }],
    queryFn: () =>
      api.admin.logs.list({
        userId: filters.userId || undefined,
        modelName: filters.modelName || undefined,
        statusCode: filters.statusCode ? parseInt(filters.statusCode) : undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        page,
        limit,
      }),
  });

  const cleanupMut = useMutation({
    mutationFn: () => api.admin.logs.cleanup(parseInt(cleanupDays)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] });
      setShowCleanup(false);
      console.log('로그가 정리되었습니다.');
    },
    onError: () => console.log('로그 정리에 실패했습니다.'),
  });

  const logs: LogEntry[] = data?.logs ?? [];
  const total: number = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? Math.ceil(total / limit);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">로그를 불러오는데 실패했습니다.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6 text-brand-500" />
          요청 로그
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors ${
              showFilters ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            필터
          </button>
          <button
            onClick={() => setShowCleanup(true)}
            className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            정리
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">사용자 ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={filters.userId}
                  onChange={(e) => { setFilters({ ...filters, userId: e.target.value }); setPage(1); }}
                  placeholder="사용자 ID"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">모델</label>
              <input
                type="text"
                value={filters.modelName}
                onChange={(e) => { setFilters({ ...filters, modelName: e.target.value }); setPage(1); }}
                placeholder="모델 이름"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">상태 코드</label>
              <select
                value={filters.statusCode}
                onChange={(e) => { setFilters({ ...filters, statusCode: e.target.value }); setPage(1); }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="">전체</option>
                <option value="200">200 OK</option>
                <option value="400">400 Bad Request</option>
                <option value="401">401 Unauthorized</option>
                <option value="429">429 Too Many Requests</option>
                <option value="500">500 Server Error</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setPage(1); }}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Dialog */}
      {showCleanup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-4">로그 정리</h3>
            <p className="text-sm text-gray-600 mb-4">지정한 일수보다 오래된 로그를 삭제합니다.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">일수</label>
              <input
                type="number"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(e.target.value)}
                min={1}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">{cleanupDays}일 이전의 로그가 삭제됩니다.</p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCleanup(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => cleanupMut.mutate()}
                disabled={cleanupMut.isPending}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
              >
                {cleanupMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Total Count */}
      <p className="text-sm text-gray-500">총 {total.toLocaleString()}건</p>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">시간</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">사용자</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">모델</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">상태</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">응답시간</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">입력</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">출력</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">스트림</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      로그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log.id)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-500">
                        {new Date(log.timestamp).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-gray-700 font-mono text-xs">{log.apiToken?.user?.loginid || log.userId || '-'}</td>
                      <td className="py-2.5 px-4 text-gray-900">{log.modelName}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-green-100 text-green-700'
                            : log.statusCode >= 400 && log.statusCode < 500
                            ? 'bg-yellow-100 text-yellow-700'
                            : log.statusCode >= 500
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-gray-600 text-xs">{log.latencyMs}ms</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 text-xs">{(log.inputTokens ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right text-gray-600 text-xs">{(log.outputTokens ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-center">
                        {log.stream ? (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">SSE</span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {(page - 1) * limit + 1} - {Math.min(page * limit, total)} / {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <LogDetailModal logId={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
