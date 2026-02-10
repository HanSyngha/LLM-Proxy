import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gauge,
  Save,
  Loader2,
  Info,
  Building2,
  Users,
  Key,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  ToggleLeft,
  ToggleRight,
  Infinity,
} from 'lucide-react';
import { api } from '../services/api';

type TabKey = 'global' | 'dept' | 'user' | 'token';

const TABS: { key: TabKey; label: string; icon: typeof Gauge }[] = [
  { key: 'global', label: '글로벌 기본값', icon: Gauge },
  { key: 'dept', label: '부서별 제한', icon: Building2 },
  { key: 'user', label: '사용자별 제한', icon: Users },
  { key: 'token', label: '토큰별 제한', icon: Key },
];

// ============ Shared helpers ============

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function UnlimitedToggleField({
  label, value, unlimited, onChange, onToggle, placeholder, helpText,
}: {
  label: string; value: number | string; unlimited: boolean;
  onChange: (v: string) => void; onToggle: () => void;
  placeholder?: string; helpText?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button type="button" onClick={onToggle}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
            unlimited ? 'bg-brand-50 text-brand-600 border border-brand-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
          <Infinity className="w-3 h-3" />
          {unlimited ? '무제한' : '제한'}
        </button>
      </div>
      <input type="number" value={unlimited ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={unlimited}
        placeholder={unlimited ? '무제한' : placeholder}
        className={`w-full px-3 py-2 border rounded-lg outline-none transition-colors text-sm ${
          unlimited ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' : 'border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-transparent'
        }`} />
      {helpText && !unlimited && <p className="text-xs text-gray-400 mt-1">{helpText}</p>}
    </div>
  );
}

// ============ Tab 1: Global ============

function GlobalLimitsTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ rpmLimit: 0, tpmLimit: 0, tphLimit: 0, tpdLimit: 0 });
  const [showConfirm, setShowConfirm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'rateLimits'],
    queryFn: () => api.admin.rateLimits.get(),
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
    },
    onError: () => setShowConfirm(false),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;

  return (
    <div className="bg-white rounded-xl shadow-card p-6">
      <div className="flex items-start gap-3 mb-6 p-3 bg-blue-50 rounded-lg">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          글로벌 레이트 리밋은 모든 토큰에 적용되는 기본값입니다.
          개별 토큰에 커스텀 리밋을 설정하면 글로벌 값 대신 적용됩니다.
          0은 제한 없음을 의미합니다.
        </p>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { key: 'rpmLimit' as const, label: 'RPM (분당 요청 수)' },
            { key: 'tpmLimit' as const, label: 'TPM (분당 토큰 수)' },
            { key: 'tphLimit' as const, label: 'TPH (시간당 토큰 수)' },
            { key: 'tpdLimit' as const, label: 'TPD (일당 토큰 수)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              <input type="number" value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-lg"
                min={0} />
              <p className="text-xs text-gray-400 mt-1">0 = 제한 없음</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          {showConfirm ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">변경사항을 저장하시겠습니까?</span>
              <button onClick={() => updateMut.mutate()} disabled={updateMut.isPending}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2">
                {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} 확인
              </button>
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
            </div>
          ) : (
            <button onClick={() => setShowConfirm(true)}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" /> 저장
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Tab 2: Department ============

interface DeptBudget {
  id: string; deptname: string; monthlyOutputTokenBudget: number;
  rpmLimit: number | null; tpmLimit: number | null; tphLimit: number | null; tpdLimit: number | null;
  enabled: boolean; monthlyUsed: number;
}
interface Department { deptname: string; userCount: number; }
interface DeptFormState {
  deptname: string; monthlyOutputTokenBudget: number; budgetUnlimited: boolean;
  rpmLimit: number | string; rpmUnlimited: boolean; tpmLimit: number | string; tpmUnlimited: boolean;
  tphLimit: number | string; tphUnlimited: boolean; tpdLimit: number | string; tpdUnlimited: boolean;
}

const defaultDeptForm: DeptFormState = {
  deptname: '', monthlyOutputTokenBudget: 10_000_000, budgetUnlimited: true,
  rpmLimit: 60, rpmUnlimited: true, tpmLimit: 100000, tpmUnlimited: true,
  tphLimit: 1000000, tphUnlimited: true, tpdLimit: 10000000, tpdUnlimited: true,
};

function DeptLimitsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<DeptBudget | null>(null);
  const [form, setForm] = useState<DeptFormState>({ ...defaultDeptForm });

  const { data, isLoading } = useQuery({ queryKey: ['dept-budgets'], queryFn: () => api.admin.deptBudgets.list() });
  const { data: deptsData } = useQuery({ queryKey: ['departments'], queryFn: () => api.admin.deptBudgets.departments() });

  const deptBudgets: DeptBudget[] = data?.deptBudgets ?? [];
  const departments: Department[] = deptsData?.departments ?? [];
  const availableDepts = departments.filter(d => !deptBudgets.some(db => db.deptname === d.deptname));
  const filtered = deptBudgets.filter(db => db.deptname.toLowerCase().includes(search.toLowerCase()));

  function buildPayload() {
    return {
      deptname: form.deptname,
      monthlyOutputTokenBudget: form.budgetUnlimited ? 999_999_999_999 : form.monthlyOutputTokenBudget,
      rpmLimit: form.rpmUnlimited ? 0 : (form.rpmLimit === '' ? null : Number(form.rpmLimit)),
      tpmLimit: form.tpmUnlimited ? 0 : (form.tpmLimit === '' ? null : Number(form.tpmLimit)),
      tphLimit: form.tphUnlimited ? 0 : (form.tphLimit === '' ? null : Number(form.tphLimit)),
      tpdLimit: form.tpdUnlimited ? 0 : (form.tpdLimit === '' ? null : Number(form.tpdLimit)),
    };
  }

  const createMut = useMutation({
    mutationFn: () => api.admin.deptBudgets.create(buildPayload()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dept-budgets'] }); setShowCreate(false); setForm({ ...defaultDeptForm }); },
  });
  const updateMut = useMutation({
    mutationFn: () => {
      if (!editItem) throw new Error('No item');
      const p = buildPayload();
      return api.admin.deptBudgets.update(editItem.id, {
        monthlyOutputTokenBudget: p.monthlyOutputTokenBudget, rpmLimit: p.rpmLimit, tpmLimit: p.tpmLimit, tphLimit: p.tphLimit, tpdLimit: p.tpdLimit,
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['dept-budgets'] }); setEditItem(null); setForm({ ...defaultDeptForm }); },
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.admin.deptBudgets.update(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dept-budgets'] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.admin.deptBudgets.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dept-budgets'] }),
  });

  function openEdit(item: DeptBudget) {
    const isUnlimited = item.monthlyOutputTokenBudget >= 999_999_999;
    setEditItem(item);
    setForm({
      deptname: item.deptname,
      monthlyOutputTokenBudget: isUnlimited ? 10_000_000 : item.monthlyOutputTokenBudget,
      budgetUnlimited: isUnlimited,
      rpmLimit: item.rpmLimit || 60, rpmUnlimited: item.rpmLimit === null || item.rpmLimit === 0,
      tpmLimit: item.tpmLimit || 100000, tpmUnlimited: item.tpmLimit === null || item.tpmLimit === 0,
      tphLimit: item.tphLimit || 1000000, tphUnlimited: item.tphLimit === null || item.tphLimit === 0,
      tpdLimit: item.tpdLimit || 10000000, tpdUnlimited: item.tpdLimit === null || item.tpdLimit === 0,
    });
  }

  const isBudgetUnlimited = (budget: number) => budget >= 999_999_999;

  const modalContent = (isCreate: boolean) => (
    <div className="space-y-4">
      {isCreate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">부서명 *</label>
          {availableDepts.length > 0 ? (
            <select value={form.deptname} onChange={(e) => setForm({ ...form, deptname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm">
              <option value="">부서 선택...</option>
              {availableDepts.map(d => <option key={d.deptname} value={d.deptname}>{d.deptname} ({d.userCount}명)</option>)}
            </select>
          ) : (
            <input type="text" value={form.deptname} onChange={(e) => setForm({ ...form, deptname: e.target.value })}
              placeholder="부서명 입력" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
          )}
        </div>
      )}
      <UnlimitedToggleField label="월간 Output Token 한도" value={form.monthlyOutputTokenBudget} unlimited={form.budgetUnlimited}
        onChange={(v) => setForm({ ...form, monthlyOutputTokenBudget: parseInt(v) || 0 })}
        onToggle={() => setForm({ ...form, budgetUnlimited: !form.budgetUnlimited })}
        helpText={`${formatTokens(form.monthlyOutputTokenBudget)} tokens`} />
      {!isCreate && editItem && !form.budgetUnlimited && (
        <p className="text-xs text-gray-400 -mt-2 pl-1">현재 사용: {formatTokens(editItem.monthlyUsed)} / {formatTokens(form.monthlyOutputTokenBudget)}</p>
      )}
      <div className="border-t border-gray-100 pt-4">
        <h4 className="text-sm font-medium text-gray-800 mb-3">Rate Limits</h4>
        <div className="grid grid-cols-2 gap-3">
          <UnlimitedToggleField label="RPM" value={form.rpmLimit} unlimited={form.rpmUnlimited}
            onChange={(v) => setForm({ ...form, rpmLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, rpmUnlimited: !form.rpmUnlimited })} placeholder="분당 요청 수" />
          <UnlimitedToggleField label="TPM" value={form.tpmLimit} unlimited={form.tpmUnlimited}
            onChange={(v) => setForm({ ...form, tpmLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, tpmUnlimited: !form.tpmUnlimited })} placeholder="분당 토큰 수" />
          <UnlimitedToggleField label="TPH" value={form.tphLimit} unlimited={form.tphUnlimited}
            onChange={(v) => setForm({ ...form, tphLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, tphUnlimited: !form.tphUnlimited })} placeholder="시간당 토큰 수" />
          <UnlimitedToggleField label="TPD" value={form.tpdLimit} unlimited={form.tpdUnlimited}
            onChange={(v) => setForm({ ...form, tpdLimit: v === '' ? '' : parseInt(v) })}
            onToggle={() => setForm({ ...form, tpdUnlimited: !form.tpdUnlimited })} placeholder="일간 토큰 수" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button onClick={() => isCreate ? setShowCreate(false) : setEditItem(null)}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">취소</button>
        <button onClick={() => isCreate ? createMut.mutate() : updateMut.mutate()}
          disabled={isCreate ? createMut.isPending || !form.deptname : updateMut.isPending}
          className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2 transition-colors">
          {(isCreate ? createMut.isPending : updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
          {isCreate ? '추가' : '저장'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="부서명 검색..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm" />
        </div>
        <button onClick={() => { setForm({ ...defaultDeptForm }); setShowCreate(true); }}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> 부서 제한 추가
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-card p-4">
          <p className="text-sm text-gray-500">등록된 부서</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{deptBudgets.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4">
          <p className="text-sm text-gray-500">활성 부서</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{deptBudgets.filter(d => d.enabled).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4">
          <p className="text-sm text-gray-500">한도 초과</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {deptBudgets.filter(d => d.enabled && !isBudgetUnlimited(d.monthlyOutputTokenBudget) && d.monthlyUsed >= d.monthlyOutputTokenBudget).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center"><Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">등록된 부서별 제한이 없습니다.</p></div>
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
                {filtered.map(item => {
                  const unlimited = isBudgetUnlimited(item.monthlyOutputTokenBudget);
                  const pct = unlimited ? 0 : item.monthlyOutputTokenBudget > 0 ? Math.min(100, (item.monthlyUsed / item.monthlyOutputTokenBudget) * 100) : 0;
                  const over = !unlimited && item.monthlyUsed >= item.monthlyOutputTokenBudget;
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4"><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="font-medium text-gray-900">{item.deptname}</span></div></td>
                      <td className="py-3 px-4">
                        <button onClick={() => toggleMut.mutate({ id: item.id, enabled: !item.enabled })} className="flex items-center gap-1">
                          {item.enabled ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                          <span className={`text-xs ${item.enabled ? 'text-green-600' : 'text-gray-400'}`}>{item.enabled ? '활성' : '비활성'}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        {unlimited ? <span className="inline-flex items-center gap-1 text-brand-500 font-medium"><Infinity className="w-4 h-4" /> 무제한</span> : formatTokens(item.monthlyOutputTokenBudget)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">{formatTokens(item.monthlyUsed)}</td>
                      <td className="py-3 px-4 text-right">
                        {unlimited ? <span className="text-xs text-gray-400">-</span> : (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className={`text-xs font-medium min-w-[40px] text-right ${over ? 'text-red-600' : pct > 80 ? 'text-yellow-600' : 'text-gray-600'}`}>
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-500">{item.rpmLimit != null ? item.rpmLimit : <span className="text-xs text-gray-300">-</span>}</td>
                      <td className="py-3 px-4 text-right font-mono text-gray-500">{item.tpdLimit != null ? formatTokens(item.tpdLimit) : <span className="text-xs text-gray-300">-</span>}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="수정"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm(`"${item.deptname}" 부서 제한을 삭제하시겠습니까?`)) deleteMut.mutate(item.id); }}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors" title="삭제"><Trash2 className="w-4 h-4" /></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">부서 제한 추가</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            {modalContent(true)}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditItem(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editItem.deptname} 제한 수정</h2>
              <button onClick={() => setEditItem(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            {modalContent(false)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Tab 3: User ============

interface UserWithLimit {
  id: string; loginid: string; username: string; deptname: string;
  monthlyOutputTokenBudget: number | null;
}

function UserLimitsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editUser, setEditUser] = useState<UserWithLimit | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', 'all-for-limits'],
    queryFn: () => api.admin.users.list({ limit: 200 }),
  });

  const allUsers: UserWithLimit[] = data?.users ?? [];
  const usersWithLimits = allUsers.filter(u => u.monthlyOutputTokenBudget != null);
  const usersWithoutLimits = allUsers.filter(u => u.monthlyOutputTokenBudget == null);

  const filteredLimited = search
    ? usersWithLimits.filter(u => u.loginid.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()))
    : usersWithLimits;

  const filteredForAdd = addSearch.trim()
    ? usersWithoutLimits.filter(u => u.loginid.toLowerCase().includes(addSearch.toLowerCase()) || u.username.toLowerCase().includes(addSearch.toLowerCase())).slice(0, 10)
    : [];

  const setBudgetMut = useMutation({
    mutationFn: ({ id, budget }: { id: string; budget: number | null }) => api.admin.users.setBudget(id, budget),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditUser(null);
      setBudgetInput('');
      setShowAdd(false);
      setAddSearch('');
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="사용자 검색..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm" />
        </div>
        <button onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> 사용자 제한 추가
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-card p-4">
        <p className="text-sm text-gray-500">제한 설정된 사용자: <span className="font-bold text-gray-900">{usersWithLimits.length}</span>명</p>
      </div>

      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
        ) : filteredLimited.length === 0 ? (
          <div className="py-12 text-center"><Users className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">월간 토큰 제한이 설정된 사용자가 없습니다.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">로그인 ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">이름</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">부서</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">월간 토큰 제한</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredLimited.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-gray-700">{u.loginid}</td>
                    <td className="py-3 px-4 text-gray-900">{u.username}</td>
                    <td className="py-3 px-4 text-gray-600">{u.deptname || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                        {formatTokens(u.monthlyOutputTokenBudget!)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditUser(u); setBudgetInput(String(u.monthlyOutputTokenBudget)); }}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors" title="수정"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => { if (confirm(`${u.loginid}의 월간 토큰 제한을 해제하시겠습니까?`)) setBudgetMut.mutate({ id: u.id, budget: null }); }}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors" title="제한 해제"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editUser.loginid} 토큰 제한 수정</h2>
              <button onClick={() => setEditUser(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">월간 Output Token 제한</label>
                <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm" placeholder="토큰 수" min={0} />
                {budgetInput && <p className="text-xs text-gray-400 mt-1">{formatTokens(parseInt(budgetInput) || 0)} tokens</p>}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
                <button onClick={() => setBudgetMut.mutate({ id: editUser.id, budget: budgetInput ? parseInt(budgetInput) : null })}
                  disabled={setBudgetMut.isPending}
                  className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2">
                  {setBudgetMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />} 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">사용자 토큰 제한 추가</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사용자 검색</label>
                <input type="text" value={addSearch} onChange={(e) => setAddSearch(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm" placeholder="ID 또는 이름 검색..." />
              </div>
              {filteredForAdd.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {filteredForAdd.map(u => (
                    <button key={u.id} onClick={() => { setEditUser(u); setBudgetInput('10000000'); setShowAdd(false); setAddSearch(''); }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm flex items-center justify-between">
                      <div>
                        <span className="font-mono text-gray-700">{u.loginid}</span>
                        <span className="text-gray-400 ml-2">{u.username}</span>
                      </div>
                      <span className="text-xs text-gray-400">{u.deptname}</span>
                    </button>
                  ))}
                </div>
              )}
              {addSearch.trim() && filteredForAdd.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">검색 결과가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Tab 4: Token ============

interface TokenOverride {
  id: string; name: string; prefix: string;
  user?: { id: string; loginid: string; username: string };
  rpmLimit?: number; tpmLimit?: number; tphLimit?: number; tpdLimit?: number;
}

function TokenLimitsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tokens', 'overrides'],
    queryFn: () => api.admin.tokens.list({ limit: 100 }),
  });

  const tokensWithOverrides: TokenOverride[] = (data?.tokens ?? []).filter(
    (t: TokenOverride) => (t.rpmLimit != null && t.rpmLimit !== 0) || (t.tpmLimit != null && t.tpmLimit !== 0) || (t.tphLimit != null && t.tphLimit !== 0) || (t.tpdLimit != null && t.tpdLimit !== 0)
  );

  return (
    <div className="bg-white rounded-xl shadow-card overflow-hidden">
      <div className="p-4 border-b">
        <p className="text-sm text-gray-500">글로벌 설정 대신 커스텀 레이트 리밋이 적용된 토큰 목록입니다. 토큰 관리 페이지에서 개별 설정할 수 있습니다.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
      ) : tokensWithOverrides.length === 0 ? (
        <div className="py-12 text-center"><Key className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="text-gray-400">커스텀 레이트 리밋이 설정된 토큰이 없습니다.</p></div>
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
              {tokensWithOverrides.map(token => (
                <tr key={token.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 px-4">
                    <p className="font-medium text-gray-900">{token.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{token.prefix}</p>
                  </td>
                  <td className="py-2.5 px-4 text-gray-600">{token.user?.loginid || '-'}</td>
                  {(['rpmLimit', 'tpmLimit', 'tphLimit', 'tpdLimit'] as const).map(key => (
                    <td key={key} className="py-2.5 px-4 text-right">
                      {token[key] != null ? (
                        <span className="px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-xs font-medium">
                          {token[key]!.toLocaleString()}
                        </span>
                      ) : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ Main Component ============

export default function AdminRateLimits() {
  const [activeTab, setActiveTab] = useState<TabKey>('global');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <Gauge className="w-6 h-6 text-brand-500" />
        Rate Limits & 토큰 제한
      </h1>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'global' && <GlobalLimitsTab />}
      {activeTab === 'dept' && <DeptLimitsTab />}
      {activeTab === 'user' && <UserLimitsTab />}
      {activeTab === 'token' && <TokenLimitsTab />}
    </div>
  );
}
