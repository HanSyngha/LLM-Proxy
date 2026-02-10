import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Key,
  ToggleLeft,
  ToggleRight,
  Filter,
} from 'lucide-react';
import { api } from '../services/api';

interface Token {
  id: string;
  name: string;
  prefix: string;
  userId: string;
  user?: {
    id: string;
    loginid: string;
    username: string;
    deptname?: string;
  };
  enabled: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt?: string;
  rpmLimit?: number | null;
  tpmLimit?: number | null;
  tphLimit?: number | null;
  tpdLimit?: number | null;
  monthlyOutputTokenBudget?: number | null;
  allowedModels?: string[];
}

function TokenDetailModal({
  token,
  onClose,
}: {
  token: Token;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'limits' | 'budget' | 'models'>('limits');

  // Rate limits form
  const [rpmLimit, setRpmLimit] = useState(token.rpmLimit?.toString() ?? '');
  const [tpmLimit, setTpmLimit] = useState(token.tpmLimit?.toString() ?? '');
  const [tphLimit, setTphLimit] = useState(token.tphLimit?.toString() ?? '');
  const [tpdLimit, setTpdLimit] = useState(token.tpdLimit?.toString() ?? '');

  // Budget form
  const [budget, setBudget] = useState(token.monthlyOutputTokenBudget?.toString() ?? '');

  // Models form
  const [selectedModels, setSelectedModels] = useState<string[]>(token.allowedModels ?? []);

  // Reset form state when token changes
  useEffect(() => {
    setRpmLimit(token.rpmLimit?.toString() ?? '');
    setTpmLimit(token.tpmLimit?.toString() ?? '');
    setTphLimit(token.tphLimit?.toString() ?? '');
    setTpdLimit(token.tpdLimit?.toString() ?? '');
    setBudget(token.monthlyOutputTokenBudget?.toString() ?? '');
    setSelectedModels(token.allowedModels ?? []);
    setActiveTab('limits');
  }, [token.id]);

  const { data: modelsData } = useQuery({
    queryKey: ['admin', 'models'],
    queryFn: () => api.admin.models.list(),
  });

  const rateLimitsMut = useMutation({
    mutationFn: () =>
      api.admin.tokens.setRateLimits(token.id, {
        rpmLimit: rpmLimit.trim() ? (parseInt(rpmLimit) || null) : null,
        tpmLimit: tpmLimit.trim() ? (parseInt(tpmLimit) || null) : null,
        tphLimit: tphLimit.trim() ? (parseInt(tphLimit) || null) : null,
        tpdLimit: tpdLimit.trim() ? (parseInt(tpdLimit) || null) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      console.log('레이트 리밋이 설정되었습니다.');
    },
    onError: () => console.log('레이트 리밋 설정에 실패했습니다.'),
  });

  const budgetMut = useMutation({
    mutationFn: () => api.admin.tokens.setBudget(token.id, budget.trim() ? parseInt(budget) : null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      console.log('예산이 설정되었습니다.');
    },
    onError: () => console.log('예산 설정에 실패했습니다.'),
  });

  const modelsMut = useMutation({
    mutationFn: () => api.admin.tokens.setModels(token.id, selectedModels),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      console.log('허용 모델이 설정되었습니다.');
    },
    onError: () => console.log('모델 설정에 실패했습니다.'),
  });

  const availableModels: Array<{ id: string; name: string; displayName: string }> = modelsData?.models ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Key className="w-5 h-5 text-brand-500" />
            토큰 상세 - {token.name}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Token Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">프리픽스</p>
              <p className="font-mono">{token.prefix}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">소유자</p>
              <p>{token.user?.username || token.user?.loginid || token.userId}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">상태</p>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                token.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {token.enabled ? '활성' : '비활성'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">만료일</p>
              <p>{token.expiresAt ? new Date(token.expiresAt).toLocaleDateString('ko-KR') : '없음'}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <div className="flex gap-4">
              {[
                { key: 'limits' as const, label: '레이트 리밋' },
                { key: 'budget' as const, label: '예산' },
                { key: 'models' as const, label: '허용 모델' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
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
          {activeTab === 'limits' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">RPM (분당 요청)</label>
                  <input
                    type="number"
                    value={rpmLimit}
                    onChange={(e) => setRpmLimit(e.target.value)}
                    placeholder="기본값 사용"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">TPM (분당 토큰)</label>
                  <input
                    type="number"
                    value={tpmLimit}
                    onChange={(e) => setTpmLimit(e.target.value)}
                    placeholder="기본값 사용"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">TPH (시간당 토큰)</label>
                  <input
                    type="number"
                    value={tphLimit}
                    onChange={(e) => setTphLimit(e.target.value)}
                    placeholder="기본값 사용"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">TPD (일당 토큰)</label>
                  <input
                    type="number"
                    value={tpdLimit}
                    onChange={(e) => setTpdLimit(e.target.value)}
                    placeholder="기본값 사용"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
              <button
                onClick={() => rateLimitsMut.mutate()}
                disabled={rateLimitsMut.isPending}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {rateLimitsMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                저장
              </button>
            </div>
          )}

          {activeTab === 'budget' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">월 출력 토큰 한도</label>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="제한 없음"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">비워두면 제한 없음</p>
              </div>
              <button
                onClick={() => budgetMut.mutate()}
                disabled={budgetMut.isPending}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {budgetMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                저장
              </button>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">허용할 모델을 선택하세요. 선택하지 않으면 모든 모델 사용 가능.</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableModels.map((model) => (
                  <label key={model.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedModels([...selectedModels, model.id]);
                        } else {
                          setSelectedModels(selectedModels.filter((m) => m !== model.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm">{model.displayName}</span>
                    <span className="text-xs text-gray-400 font-mono">{model.name}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={() => modelsMut.mutate()}
                disabled={modelsMut.isPending}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
              >
                {modelsMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                저장
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminTokens() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'tokens', { search, filterEnabled, page, limit }],
    queryFn: () =>
      api.admin.tokens.list({
        search: search || undefined,
        enabled: filterEnabled === 'all' ? undefined : filterEnabled === 'true',
        page,
        limit,
      }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.admin.tokens.update(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      console.log('토큰 상태가 변경되었습니다.');
    },
    onError: () => console.log('토큰 상태 변경에 실패했습니다.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.admin.tokens.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tokens'] });
      console.log('토큰이 삭제되었습니다.');
    },
    onError: () => console.log('토큰 삭제에 실패했습니다.'),
  });

  const tokens: Token[] = data?.tokens ?? [];
  const total: number = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? Math.ceil(total / limit);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">토큰 목록을 불러오는데 실패했습니다.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">토큰 관리</h1>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="토큰 이름 또는 사용자로 검색..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterEnabled}
            onChange={(e) => {
              setFilterEnabled(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
          >
            <option value="all">전체 상태</option>
            <option value="true">활성</option>
            <option value="false">비활성</option>
          </select>
        </div>
        <p className="text-sm text-gray-500">총 {total.toLocaleString()}개</p>
      </div>

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
                  <th className="text-left py-3 px-4 font-medium text-gray-500">이름</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">프리픽스</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">소유자</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">만료일</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">마지막 사용</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      토큰이 없습니다.
                    </td>
                  </tr>
                ) : (
                  tokens.map((token) => (
                    <tr
                      key={token.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td
                        className="py-3 px-4 text-gray-900 cursor-pointer hover:text-brand-600"
                        onClick={() => setSelectedToken(token)}
                      >
                        {token.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">{token.prefix}</td>
                      <td className="py-3 px-4 text-gray-600">{token.user?.username || token.user?.loginid || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          token.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {token.enabled ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {token.expiresAt ? new Date(token.expiresAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMut.mutate({ id: token.id, enabled: !token.enabled });
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                            title={token.enabled ? '비활성화' : '활성화'}
                          >
                            {token.enabled ? (
                              <ToggleRight className="w-4 h-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedToken(token);
                            }}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('이 토큰을 삭제하시겠습니까?')) deleteMut.mutate(token.id);
                            }}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
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
      {selectedToken && (
        <TokenDetailModal token={selectedToken} onClose={() => setSelectedToken(null)} />
      )}
    </div>
  );
}
