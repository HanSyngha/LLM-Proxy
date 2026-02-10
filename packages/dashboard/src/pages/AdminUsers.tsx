import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Ban,
  ShieldCheck,
  Shield,
  Gauge,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  User as UserIcon,
} from 'lucide-react';
import { api } from '../services/api';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: '슈퍼 관리자',
  ADMIN: '관리자',
  VIEWER: '뷰어',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  ADMIN: 'bg-brand-100 text-brand-700',
  VIEWER: 'bg-gray-100 text-gray-600',
};

interface User {
  id: string;
  loginid: string;
  username: string;
  deptname?: string;
  businessUnit?: string;
  firstSeen: string;
  lastActive: string;
  isBanned: boolean;
  bannedReason?: string | null;
  monthlyOutputTokenBudget?: number | null;
  adminRole?: string | null;
  isDeveloper?: boolean;
  _count?: { apiTokens: number; usageLogs: number };
}

function UserDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [banReason, setBanReason] = useState('');
  const [showBanInput, setShowBanInput] = useState(false);
  const [budget, setBudget] = useState('');
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN');
  const [showRoleInput, setShowRoleInput] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => api.admin.users.get(userId),
  });

  const banMut = useMutation({
    mutationFn: () => api.admin.users.ban(userId, banReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowBanInput(false);
      setBanReason('');
    },
    onError: () => alert('사용자 차단에 실패했습니다.'),
  });

  const unbanMut = useMutation({
    mutationFn: () => api.admin.users.unban(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: () => alert('차단 해제에 실패했습니다.'),
  });

  const budgetMut = useMutation({
    mutationFn: () => api.admin.users.setBudget(userId, budget.trim() ? parseInt(budget) : null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowBudgetInput(false);
      setBudget('');
    },
    onError: () => alert('월간 토큰 제한 설정에 실패했습니다.'),
  });

  const setRoleMut = useMutation({
    mutationFn: (role: string | null) => api.admin.users.setAdminRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowRoleInput(false);
    },
    onError: () => alert('관리자 역할 변경에 실패했습니다.'),
  });

  const user = data?.user;
  const adminInfo = data?.adminInfo;
  const tokens: { id: string; name: string; prefix: string; enabled: boolean; lastUsedAt?: string }[] = data?.user?.apiTokens ?? [];
  const usage = data?.usageHistory ?? [];
  const currentAdminRole = adminInfo?.role || null;
  const userIsDeveloper = adminInfo?.isDeveloper || false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-brand-500" />
            사용자 상세
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : user ? (
          <div className="p-6 space-y-6">
            {/* User Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">로그인 ID</p>
                <p className="font-mono text-sm">{user.loginid}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">이름</p>
                <p className="text-sm">{user.username}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">부서</p>
                <p className="text-sm">{user.deptname || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">사업부</p>
                <p className="text-sm">{user.businessUnit || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">최초 접속</p>
                <p className="text-sm">{new Date(user.firstSeen).toLocaleDateString('ko-KR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">마지막 활동</p>
                <p className="text-sm">{new Date(user.lastActive).toLocaleDateString('ko-KR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">상태</p>
                <div className="flex gap-2 mt-1">
                  {user.isBanned ? (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">차단됨</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">활성</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">토큰 수</p>
                <p className="text-sm">{tokens.length}</p>
              </div>
            </div>

            {/* Admin Role Management */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-500" />
                관리자 권한
              </h3>
              {currentAdminRole ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${ROLE_COLORS[currentAdminRole] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[currentAdminRole] || currentAdminRole}
                    </span>
                    {userIsDeveloper && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">Developer</span>
                    )}
                  </div>
                  {!userIsDeveloper && (
                    <div className="flex items-center gap-2">
                      <select
                        value={currentAdminRole}
                        onChange={(e) => setRoleMut.mutate(e.target.value)}
                        disabled={setRoleMut.isPending}
                        className="px-3 py-1.5 text-sm border rounded-lg bg-white"
                      >
                        <option value="SUPER_ADMIN">슈퍼 관리자</option>
                        <option value="ADMIN">관리자</option>
                        <option value="VIEWER">뷰어</option>
                      </select>
                      <button
                        onClick={() => setRoleMut.mutate(null)}
                        disabled={setRoleMut.isPending}
                        className="px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-1"
                      >
                        {setRoleMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        권한 해제
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {showRoleInput ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="px-3 py-1.5 text-sm border rounded-lg bg-white"
                      >
                        <option value="ADMIN">관리자</option>
                        <option value="VIEWER">뷰어</option>
                        <option value="SUPER_ADMIN">슈퍼 관리자</option>
                      </select>
                      <button
                        onClick={() => setRoleMut.mutate(selectedRole)}
                        disabled={setRoleMut.isPending}
                        className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        {setRoleMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        확인
                      </button>
                      <button
                        onClick={() => setShowRoleInput(false)}
                        className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">일반 사용자</span>
                      <button
                        onClick={() => setShowRoleInput(true)}
                        className="px-3 py-1.5 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-1"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        관리자 지정
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap border-t pt-4">
              {user.isBanned ? (
                <button
                  onClick={() => unbanMut.mutate()}
                  disabled={unbanMut.isPending}
                  className="px-3 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2 disabled:opacity-50"
                >
                  {unbanMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  차단 해제
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {showBanInput ? (
                    <>
                      <input
                        type="text"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="차단 사유"
                        className="px-3 py-2 text-sm border rounded-lg w-48"
                      />
                      <button
                        onClick={() => banMut.mutate()}
                        disabled={banMut.isPending || !banReason.trim()}
                        className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        {banMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        확인
                      </button>
                      <button
                        onClick={() => setShowBanInput(false)}
                        className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowBanInput(true)}
                      className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                    >
                      <Ban className="w-4 h-4" />
                      차단
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                {showBudgetInput ? (
                  <>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="월 출력 토큰 한도"
                      className="px-3 py-2 text-sm border rounded-lg w-48"
                    />
                    <button
                      onClick={() => budgetMut.mutate()}
                      disabled={budgetMut.isPending}
                      className="px-3 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1"
                    >
                      {budgetMut.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      {budget.trim() ? '설정' : '제한 해제'}
                    </button>
                    <button
                      onClick={() => setShowBudgetInput(false)}
                      className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      취소
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowBudgetInput(true)}
                    className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
                  >
                    <Gauge className="w-4 h-4" />
                    월간 토큰 제한
                  </button>
                )}
              </div>
            </div>

            {/* Usage History */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">최근 사용 내역</h3>
              {usage.length === 0 ? (
                <p className="text-sm text-gray-400">사용 내역이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">날짜</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">요청 수</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-500">출력 토큰</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.slice(0, 10).map((u: { date: string; requestCount?: number; totalOutputTokens?: number }, i: number) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 px-3">{new Date(u.date).toLocaleDateString('ko-KR')}</td>
                          <td className="py-2 px-3 text-right">{(u.requestCount ?? 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">{(u.totalOutputTokens ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Tokens */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">토큰 목록</h3>
              {tokens.length === 0 ? (
                <p className="text-sm text-gray-400">토큰이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-gray-500">이름</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">프리픽스</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">상태</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-500">마지막 사용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.map((t) => (
                        <tr key={t.id} className="border-b border-gray-50">
                          <td className="py-2 px-3">{t.name}</td>
                          <td className="py-2 px-3 font-mono">{t.prefix}</td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              t.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {t.enabled ? '활성' : '비활성'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-gray-500">
                            {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString('ko-KR') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const limit = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', { search, page, limit }],
    queryFn: () => api.admin.users.list({ search: search || undefined, page, limit }),
  });

  const users: User[] = data?.users ?? [];
  const total: number = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? Math.ceil(total / limit);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">사용자 목록을 불러오는데 실패했습니다.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="사용자 ID 또는 이름으로 검색..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm"
          />
        </div>
        <p className="text-sm text-gray-500">총 {total.toLocaleString()}명</p>
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
                  <th className="text-left py-3 px-4 font-medium text-gray-500">로그인 ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">이름</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">부서</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">마지막 활동</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">토큰 수</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => setSelectedUser(user.id)}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-gray-700">{user.loginid}</td>
                      <td className="py-3 px-4 text-gray-900">{user.username}</td>
                      <td className="py-3 px-4 text-gray-600">{user.deptname || '-'}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{new Date(user.lastActive).toLocaleDateString('ko-KR')}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1 flex-wrap">
                          {user.isBanned ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">차단</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">활성</span>
                          )}
                          {user.adminRole && (
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ROLE_COLORS[user.adminRole] || 'bg-gray-100 text-gray-600'}`}>
                              {ROLE_LABELS[user.adminRole] || user.adminRole}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700">{user._count?.apiTokens ?? 0}</td>
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
      {selectedUser && (
        <UserDetailModal userId={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
