import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gauge,
  Save,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Info,
} from 'lucide-react';
import { api } from '../services/api';

interface RateLimitConfig {
  rpmLimit: number;
  tpmLimit: number;
  tphLimit: number;
  tpdLimit: number;
}

interface TokenOverride {
  id: string;
  name: string;
  prefix: string;
  user?: { id: string; loginid: string; username: string };
  rpmLimit?: number;
  tpmLimit?: number;
  tphLimit?: number;
  tpdLimit?: number;
}

export default function AdminRateLimits() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RateLimitConfig>({
    rpmLimit: 0,
    tpmLimit: 0,
    tphLimit: 0,
    tpdLimit: 0,
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'rateLimits'],
    queryFn: () => api.admin.rateLimits.get(),
  });

  const { data: tokensData, isLoading: loadingTokens } = useQuery({
    queryKey: ['admin', 'tokens', 'overrides'],
    queryFn: () => api.admin.tokens.list({ limit: 100 }),
  });

  useEffect(() => {
    if (data?.config) {
      setForm({
        rpmLimit: data.config.rpmLimit ?? 0,
        tpmLimit: data.config.tpmLimit ?? 0,
        tphLimit: data.config.tphLimit ?? 0,
        tpdLimit: data.config.tpdLimit ?? 0,
      });
    }
  }, [data]);

  const updateMut = useMutation({
    mutationFn: () => api.admin.rateLimits.update(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'rateLimits'] });
      setShowConfirm(false);
      console.log('글로벌 레이트 리밋이 업데이트되었습니다.');
    },
    onError: () => {
      setShowConfirm(false);
      console.log('레이트 리밋 업데이트에 실패했습니다.');
    },
  });

  const tokensWithOverrides: TokenOverride[] = (tokensData?.tokens ?? []).filter(
    (t: TokenOverride) => t.rpmLimit != null || t.tpmLimit != null || t.tphLimit != null || t.tpdLimit != null
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">레이트 리밋 설정을 불러오는데 실패했습니다.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Gauge className="w-6 h-6 text-brand-500" />
        글로벌 레이트 리밋
      </h1>

      {/* Global Config */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <div className="flex items-start gap-3 mb-6 p-3 bg-blue-50 rounded-lg">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            글로벌 레이트 리밋은 모든 토큰에 적용되는 기본값입니다. 개별 토큰에 커스텀 리밋을 설정하면 글로벌 값 대신 적용됩니다.
            0은 제한 없음을 의미합니다.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">RPM (분당 요청 수)</label>
                <input
                  type="number"
                  value={form.rpmLimit}
                  onChange={(e) => setForm({ ...form, rpmLimit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-lg"
                  min={0}
                />
                <p className="text-xs text-gray-400 mt-1">0 = 제한 없음</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TPM (분당 토큰 수)</label>
                <input
                  type="number"
                  value={form.tpmLimit}
                  onChange={(e) => setForm({ ...form, tpmLimit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-lg"
                  min={0}
                />
                <p className="text-xs text-gray-400 mt-1">0 = 제한 없음</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TPH (시간당 토큰 수)</label>
                <input
                  type="number"
                  value={form.tphLimit}
                  onChange={(e) => setForm({ ...form, tphLimit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-lg"
                  min={0}
                />
                <p className="text-xs text-gray-400 mt-1">0 = 제한 없음</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">TPD (일당 토큰 수)</label>
                <input
                  type="number"
                  value={form.tpdLimit}
                  onChange={(e) => setForm({ ...form, tpdLimit: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-lg"
                  min={0}
                />
                <p className="text-xs text-gray-400 mt-1">0 = 제한 없음</p>
              </div>
            </div>

            <div className="flex justify-end">
              {showConfirm ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">변경사항을 저장하시겠습니까?</span>
                  <button
                    onClick={() => updateMut.mutate()}
                    disabled={updateMut.isPending}
                    className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    확인
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfirm(true)}
                  className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  저장
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tokens with Custom Rate Limits */}
      <div className="bg-white rounded-xl shadow-card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">커스텀 레이트 리밋 토큰</h3>
        <p className="text-sm text-gray-500 mb-4">글로벌 설정 대신 커스텀 레이트 리밋이 적용된 토큰 목록입니다.</p>

        {loadingTokens ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : tokensWithOverrides.length === 0 ? (
          <p className="text-center text-gray-400 py-8">커스텀 레이트 리밋이 설정된 토큰이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">토큰</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">소유자</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">RPM</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">TPM</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">TPH</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">TPD</th>
                </tr>
              </thead>
              <tbody>
                {tokensWithOverrides.map((token) => (
                  <tr key={token.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-gray-900">{token.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{token.prefix}</p>
                    </td>
                    <td className="py-2.5 px-4 text-gray-600">{token.user?.loginid || '-'}</td>
                    <td className="py-2.5 px-4 text-right">
                      {token.rpmLimit != null ? (
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs font-medium">
                          {token.rpmLimit.toLocaleString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {token.tpmLimit != null ? (
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs font-medium">
                          {token.tpmLimit.toLocaleString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {token.tphLimit != null ? (
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs font-medium">
                          {token.tphLimit.toLocaleString()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {token.tpdLimit != null ? (
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs font-medium">
                          {token.tpdLimit.toLocaleString()}
                        </span>
                      ) : '-'}
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
