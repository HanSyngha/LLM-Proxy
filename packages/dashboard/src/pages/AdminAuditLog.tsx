import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ScrollText,
  Calendar,
  Filter,
} from 'lucide-react';
import { api } from '../services/api';

interface AuditEntry {
  id: string;
  timestamp: string;
  loginid: string;
  action: string;
  target?: string;
  targetType?: string;
  details?: Record<string, unknown> | string;
}

function ExpandableJson({ data }: { data?: Record<string, unknown> | string }) {
  const [expanded, setExpanded] = useState(false);

  if (!data) return <span className="text-gray-400">-</span>;

  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = jsonStr.length > 60;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
        {isLong ? (expanded ? '접기' : '펼치기') : ''}
      </button>
      {expanded || !isLong ? (
        <pre className="mt-1 bg-gray-50 p-2 rounded text-xs font-mono text-gray-700 overflow-x-auto max-w-md whitespace-pre-wrap">
          {jsonStr}
        </pre>
      ) : (
        <span className="text-xs text-gray-500 font-mono">{jsonStr.slice(0, 60)}...</span>
      )}
    </div>
  );
}

export default function AdminAuditLog() {
  const [filters, setFilters] = useState({
    loginid: '',
    action: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', { ...filters, page, limit }],
    queryFn: () =>
      api.admin.audit.list({
        loginid: filters.loginid || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        page,
        limit,
      }),
  });

  const logs: AuditEntry[] = data?.logs ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">감사 로그를 불러오는데 실패했습니다.</p>
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
          <ScrollText className="w-6 h-6 text-brand-500" />
          감사 로그
        </h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-2 text-sm rounded-lg flex items-center gap-2 transition-colors ${
            showFilters ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Filter className="w-4 h-4" />
          필터
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">관리자 ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={filters.loginid}
                  onChange={(e) => { setFilters({ ...filters, loginid: e.target.value }); setPage(1); }}
                  placeholder="관리자 ID"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">액션 유형</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => { setFilters({ ...filters, action: e.target.value }); setPage(1); }}
                placeholder="예: CREATE, UPDATE, DELETE"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
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
                  <th className="text-left py-3 px-4 font-medium text-gray-500">관리자</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">액션</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">대상</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">대상 유형</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">감사 로그가 없습니다.</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors align-top">
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-gray-700">{log.loginid}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          log.action.includes('DELETE')
                            ? 'bg-red-100 text-red-700'
                            : log.action.includes('CREATE')
                            ? 'bg-green-100 text-green-700'
                            : log.action.includes('UPDATE')
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-600 max-w-[150px] truncate">{log.target || '-'}</td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">{log.targetType || '-'}</td>
                      <td className="py-2.5 px-4">
                        <ExpandableJson data={log.details} />
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
    </div>
  );
}
