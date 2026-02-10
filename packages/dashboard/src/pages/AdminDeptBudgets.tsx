import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Infinity,
} from 'lucide-react';
import { api } from '../services/api';

interface DeptBudget {
  id: string;
  deptname: string;
  monthlyOutputTokenBudget: number;
  rpmLimit: number | null;
  tpmLimit: number | null;
  tphLimit: number | null;
  tpdLimit: number | null;
  enabled: boolean;
  monthlyUsed: number;
  createdAt: string;
}

interface Department {
  deptname: string;
  userCount: number;
}

interface FormState {
  deptname: string;
  monthlyOutputTokenBudget: number;
  budgetUnlimited: boolean;
  rpmLimit: number | string;
  rpmUnlimited: boolean;
  tpmLimit: number | string;
  tpmUnlimited: boolean;
  tphLimit: number | string;
  tphUnlimited: boolean;
  tpdLimit: number | string;
  tpdUnlimited: boolean;
}

const defaultForm: FormState = {
  deptname: '',
  monthlyOutputTokenBudget: 10_000_000,
  budgetUnlimited: true,
  rpmLimit: 60,
  rpmUnlimited: true,
  tpmLimit: 100000,
  tpmUnlimited: true,
  tphLimit: 1000000,
  tphUnlimited: true,
  tpdLimit: 10000000,
  tpdUnlimited: true,
};

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function UnlimitedToggleField({
  label,
  value,
  unlimited,
  onChange,
  onToggle,
  placeholder,
  helpText,
}: {
  label: string;
  value: number | string;
  unlimited: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
  placeholder?: string;
  helpText?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
            unlimited
              ? 'bg-brand-50 text-brand-600 border border-brand-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}
        >
          <Infinity className="w-3 h-3" />
          {unlimited ? '무제한' : '제한'}
        </button>
      </div>
      <input
        type="number"
        value={unlimited ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={unlimited}
        placeholder={unlimited ? '무제한' : placeholder}
        className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors text-sm ${
          unlimited
            ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent'
        }`}
      />
      {helpText && !unlimited && (
        <p className="text-xs text-gray-400 mt-1">{helpText}</p>
      )}
    </div>
  );
}

export default function AdminDeptBudgets() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<DeptBudget | null>(null);
  const [form, setForm] = useState<FormState>({ ...defaultForm });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dept-budgets'],
    queryFn: () => api.admin.deptBudgets.list(),
  });

  const { data: deptsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.admin.deptBudgets.departments(),
  });

  const deptBudgets: DeptBudget[] = data?.deptBudgets ?? [];
  const departments: Department[] = deptsData?.departments ?? [];

  const availableDepts = departments.filter(
    (d) => !deptBudgets.some((db) => db.deptname === d.deptname)
  );

  const filtered = deptBudgets.filter((db) =>
    db.deptname.toLowerCase().includes(search.toLowerCase())
  );

  function buildPayload() {
    return {
      deptname: form.deptname,
      monthlyOutputTokenBudget: form.budgetUnlimited ? 999_999_999_999 : form.monthlyOutputTokenBudget,
      rpmLimit: form.rpmUnlimited ? null : (form.rpmLimit === '' ? null : Number(form.rpmLimit)),
      tpmLimit: form.tpmUnlimited ? null : (form.tpmLimit === '' ? null : Number(form.tpmLimit)),
      tphLimit: form.tphUnlimited ? null : (form.tphLimit === '' ? null : Number(form.tphLimit)),
      tpdLimit: form.tpdUnlimited ? null : (form.tpdLimit === '' ? null : Number(form.tpdLimit)),
    };
  }

  const createMut = useMutation({
    mutationFn: () => api.admin.deptBudgets.create(buildPayload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dept-budgets'] });
      setShowCreate(false);
      resetForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editItem) throw new Error('No item');
      const p = buildPayload();
      return api.admin.deptBudgets.update(editItem.id, {
        monthlyOutputTokenBudget: p.monthlyOutputTokenBudget,
        rpmLimit: p.rpmLimit,
        tpmLimit: p.tpmLimit,
        tphLimit: p.tphLimit,
        tpdLimit: p.tpdLimit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dept-budgets'] });
      setEditItem(null);
      resetForm();
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.admin.deptBudgets.update(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dept-budgets'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.admin.deptBudgets.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dept-budgets'] }),
  });

  function resetForm() {
    setForm({ ...defaultForm });
  }

  function openEdit(item: DeptBudget) {
    const isVirtuallyUnlimited = item.monthlyOutputTokenBudget >= 999_999_999;
    setEditItem(item);
    setForm({
      deptname: item.deptname,
      monthlyOutputTokenBudget: isVirtuallyUnlimited ? 10_000_000 : item.monthlyOutputTokenBudget,
      budgetUnlimited: isVirtuallyUnlimited,
      rpmLimit: item.rpmLimit ?? 60,
      rpmUnlimited: item.rpmLimit === null,
      tpmLimit: item.tpmLimit ?? 100000,
      tpmUnlimited: item.tpmLimit === null,
      tphLimit: item.tphLimit ?? 1000000,
      tphUnlimited: item.tphLimit === null,
      tpdLimit: item.tpdLimit ?? 10000000,
      tpdUnlimited: item.tpdLimit === null,
    });
  }

  const isBudgetUnlimited = (budget: number) => budget >= 999_999_999;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">부서별 토큰 제한을 불러오는데 실패했습니다.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  const modalContent = (isCreate: boolean) => (
    <div className="space-y-4">
      {isCreate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">부서명 *</label>
          {availableDepts.length > 0 ? (
            <select
              value={form.deptname}
              onChange={(e) => setForm({ ...form, deptname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
            >
              <option value="">부서 선택...</option>
              {availableDepts.map((d) => (
                <option key={d.deptname} value={d.deptname}>
                  {d.deptname} ({d.userCount}명)
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={form.deptname}
              onChange={(e) => setForm({ ...form, deptname: e.target.value })}
              placeholder="부서명 입력"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
            />
          )}
        </div>
      )}

      <UnlimitedToggleField
        label="월간 Output Token 한도"
        value={form.monthlyOutputTokenBudget}
        unlimited={form.budgetUnlimited}
        onChange={(v) => setForm({ ...form, monthlyOutputTokenBudget: parseInt(v) || 0 })}
        onToggle={() => setForm({ ...form, budgetUnlimited: !form.budgetUnlimited })}
        helpText={`${formatTokens(form.monthlyOutputTokenBudget)} tokens`}
      />

      {!isCreate && editItem && !form.budgetUnlimited && (
        <p className="text-xs text-gray-400 -mt-2 pl-1">
          현재 사용: {formatTokens(editItem.monthlyUsed)} / {formatTokens(form.monthlyOutputTokenBudget)}
        </p>
      )}

      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-sm font-medium text-gray-800 mb-3">Rate Limits</h4>
        <div className="grid grid-cols-2 gap-3">
          <UnlimitedToggleField
            label="RPM"
            value={form.rpmLimit}
            unlimited={form.rpmUnlimited}
            onChange={(v) => setForm({ ...form, rpmLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, rpmUnlimited: !form.rpmUnlimited })}
            placeholder="분당 요청 수"
          />
          <UnlimitedToggleField
            label="TPM"
            value={form.tpmLimit}
            unlimited={form.tpmUnlimited}
            onChange={(v) => setForm({ ...form, tpmLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, tpmUnlimited: !form.tpmUnlimited })}
            placeholder="분당 토큰 수"
          />
          <UnlimitedToggleField
            label="TPH"
            value={form.tphLimit}
            unlimited={form.tphUnlimited}
            onChange={(v) => setForm({ ...form, tphLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, tphUnlimited: !form.tphUnlimited })}
            placeholder="시간당 토큰 수"
          />
          <UnlimitedToggleField
            label="TPD"
            value={form.tpdLimit}
            unlimited={form.tpdUnlimited}
            onChange={(v) => setForm({ ...form, tpdLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, tpdUnlimited: !form.tpdUnlimited })}
            placeholder="일간 토큰 수"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={() => isCreate ? setShowCreate(false) : setEditItem(null)}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          취소
        </button>
        <button
          onClick={() => isCreate ? createMut.mutate() : updateMut.mutate()}
          disabled={
            isCreate
              ? createMut.isPending || !form.deptname
              : updateMut.isPending
          }
          className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {(isCreate ? createMut.isPending : updateMut.isPending) && (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
          {isCreate ? '추가' : '저장'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-500" />
            부서별 토큰 제한
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            부서별 월간 Output Token 한도 및 Rate Limit을 관리합니다.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> 부서 제한 추가
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="부서명 검색..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-card p-5">
          <p className="text-sm text-gray-500">등록된 부서</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{deptBudgets.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-5">
          <p className="text-sm text-gray-500">활성 부서</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {deptBudgets.filter((d) => d.enabled).length}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-5">
          <p className="text-sm text-gray-500">한도 초과 부서</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {deptBudgets.filter(
              (d) =>
                d.enabled &&
                !isBudgetUnlimited(d.monthlyOutputTokenBudget) &&
                d.monthlyUsed >= d.monthlyOutputTokenBudget
            ).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">등록된 부서별 토큰 제한이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">부서명</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">월간 한도</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">사용량</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">사용률</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">RPM</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">TPD</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const unlimited = isBudgetUnlimited(item.monthlyOutputTokenBudget);
                  const usagePercent = unlimited
                    ? 0
                    : item.monthlyOutputTokenBudget > 0
                      ? Math.min(100, (item.monthlyUsed / item.monthlyOutputTokenBudget) * 100)
                      : 0;
                  const isOverBudget =
                    !unlimited && item.monthlyUsed >= item.monthlyOutputTokenBudget;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900">{item.deptname}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() =>
                            toggleMut.mutate({ id: item.id, enabled: !item.enabled })
                          }
                          className="flex items-center gap-1"
                        >
                          {item.enabled ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                          <span
                            className={`text-xs ${item.enabled ? 'text-green-600' : 'text-gray-400'}`}
                          >
                            {item.enabled ? '활성' : '비활성'}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        {unlimited ? (
                          <span className="inline-flex items-center gap-1 text-brand-500 font-medium">
                            <Infinity className="w-4 h-4" /> 무제한
                          </span>
                        ) : (
                          formatTokens(item.monthlyOutputTokenBudget)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        {formatTokens(item.monthlyUsed)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {unlimited ? (
                          <span className="text-xs text-gray-400">-</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isOverBudget
                                    ? 'bg-red-500'
                                    : usagePercent > 80
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, usagePercent)}%` }}
                              />
                            </div>
                            <span
                              className={`text-xs font-medium min-w-[40px] text-right ${
                                isOverBudget
                                  ? 'text-red-600'
                                  : usagePercent > 80
                                    ? 'text-yellow-600'
                                    : 'text-gray-600'
                              }`}
                            >
                              {usagePercent.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-500">
                        {item.rpmLimit != null ? item.rpmLimit : (
                          <span className="text-xs text-gray-300">무제한</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-500">
                        {item.tpdLimit != null ? formatTokens(item.tpdLimit) : (
                          <span className="text-xs text-gray-300">무제한</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(item)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`"${item.deptname}" 부서 제한을 삭제하시겠습니까?`))
                                deleteMut.mutate(item.id);
                            }}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">부서 제한 추가</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {modalContent(true)}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setEditItem(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editItem.deptname} 제한 수정
              </h2>
              <button
                onClick={() => setEditItem(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {modalContent(false)}
          </div>
        </div>
      )}
    </div>
  );
}
