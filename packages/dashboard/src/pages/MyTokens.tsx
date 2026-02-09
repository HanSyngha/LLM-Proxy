import { useState, useCallback, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokens as tokensApi } from '../services/api';
import { format } from 'date-fns';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Pencil,
  AlertTriangle,
  X,
  Loader2,
  Clock,
  Activity,
  Coins,
  Shield,
} from 'lucide-react';

interface Token {
  id: string;
  name: string;
  prefix: string;
  enabled: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  rpmLimit: number | null;
  tpmLimit: number | null;
  monthlyOutputTokenBudget: number | null;
  usage: {
    totalRequests: number;
    totalOutputTokens: number;
    monthlyOutputTokens: number;
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  try {
    return format(new Date(d), 'yyyy-MM-dd HH:mm');
  } catch {
    return '-';
  }
}

export default function MyTokens() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showRenameModal, setShowRenameModal] = useState<Token | null>(null);
  const [newRawKey, setNewRawKey] = useState('');
  const [createName, setCreateName] = useState('');
  const [createExpiry, setCreateExpiry] = useState('');
  const [renameName, setRenameName] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-tokens'],
    queryFn: tokensApi.list,
  });

  const tokenList: Token[] = data?.tokens || [];

  const createMutation = useMutation({
    mutationFn: ({ name, expiresAt }: { name: string; expiresAt?: string }) =>
      tokensApi.create(name, expiresAt),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['my-tokens'] });
      setNewRawKey(res.rawKey);
      setShowCreateModal(false);
      setShowKeyModal(true);
      setCreateName('');
      setCreateExpiry('');
      setError('');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error || 'Token creation failed');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: { name?: string; enabled?: boolean } }) =>
      tokensApi.update(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tokens'] });
      setShowRenameModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tokensApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tokens'] });
      setShowDeleteConfirm(null);
    },
  });

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    createMutation.mutate({
      name: createName.trim(),
      expiresAt: createExpiry || undefined,
    });
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRenameModal || !renameName.trim()) return;
    updateMutation.mutate({ id: showRenameModal.id, data: { name: renameName.trim() } });
  };

  const toggleEnabled = (token: Token) => {
    updateMutation.mutate({ id: token.id, data: { enabled: !token.enabled } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">
            API 호출에 사용할 키를 관리합니다. (최대 5개)
          </p>
        </div>
        <button
          onClick={() => {
            setError('');
            setShowCreateModal(true);
          }}
          disabled={tokenList.length >= 5}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-sm"
        >
          <Plus size={16} />
          새 API Key
        </button>
      </div>

      {/* Token count indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < tokenList.length ? 'bg-brand-500' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500">{tokenList.length} / 5 사용 중</span>
      </div>

      {/* Token cards */}
      {tokenList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Key size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">API Key가 없습니다</h3>
          <p className="text-sm text-gray-500 mb-4">
            새 API Key를 생성하여 LLM Gateway를 사용하세요.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-all"
          >
            <Plus size={16} />
            첫 번째 API Key 생성
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tokenList.map((token) => (
            <div
              key={token.id}
              className={`bg-white rounded-xl border ${
                token.enabled ? 'border-gray-200' : 'border-gray-200 opacity-60'
              } p-5 shadow-sm hover:shadow-md transition-all`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      token.enabled ? 'bg-brand-50 text-brand-500' : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{token.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded font-mono">
                        {token.prefix}...
                      </code>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                          token.enabled
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {token.enabled ? '활성' : '비활성'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setShowRenameModal(token);
                      setRenameName(token.name);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="이름 변경"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => toggleEnabled(token)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title={token.enabled ? '비활성화' : '활성화'}
                  >
                    {token.enabled ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(token.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">총 요청</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatNumber(token.usage.totalRequests)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Coins size={14} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Output Tokens</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatNumber(token.usage.totalOutputTokens)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">생성일</p>
                    <p className="text-xs font-medium text-gray-700">
                      {formatDate(token.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">마지막 사용</p>
                    <p className="text-xs font-medium text-gray-700">
                      {formatDate(token.lastUsedAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Monthly budget */}
              {token.monthlyOutputTokenBudget && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Shield size={12} />
                      월간 Output Token 예산
                    </span>
                    <span className="text-gray-700 font-medium">
                      {formatNumber(token.usage.monthlyOutputTokens)} / {formatNumber(token.monthlyOutputTokenBudget)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        token.usage.monthlyOutputTokens / token.monthlyOutputTokenBudget > 0.9
                          ? 'bg-red-500'
                          : token.usage.monthlyOutputTokens / token.monthlyOutputTokenBudget > 0.7
                            ? 'bg-yellow-500'
                            : 'bg-brand-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (token.usage.monthlyOutputTokens / token.monthlyOutputTokenBudget) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="새 API Key 생성">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">이름</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="예: Production Server"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                maxLength={100}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                만료일 (선택사항)
              </label>
              <input
                type="datetime-local"
                value={createExpiry}
                onChange={(e) => setCreateExpiry(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle size={14} className="text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!createName.trim() || createMutation.isPending}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                생성
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Show new key modal */}
      {showKeyModal && (
        <Modal onClose={() => setShowKeyModal(false)} title="API Key 생성 완료">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  이 키는 다시 표시되지 않습니다!
                </p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  반드시 지금 복사하여 안전한 곳에 저장하세요.
                </p>
              </div>
            </div>

            <div className="relative">
              <code className="block w-full px-3 py-3 pr-12 bg-gray-900 text-green-400 rounded-lg text-sm font-mono break-all">
                {newRawKey}
              </code>
              <button
                onClick={() => handleCopy(newRawKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white rounded transition-colors"
                title="복사"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-all"
              >
                확인
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(null)} title="API Key 삭제">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                이 API Key를 삭제하면 해당 키를 사용하는 모든 서비스에서 인증이 실패합니다.
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate(showDeleteConfirm)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rename modal */}
      {showRenameModal && (
        <Modal onClose={() => setShowRenameModal(null)} title="API Key 이름 변경">
          <form onSubmit={handleRename} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">새 이름</label>
              <input
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm"
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={!renameName.trim() || updateMutation.isPending}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all"
              >
                변경
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// Reusable modal component
function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
