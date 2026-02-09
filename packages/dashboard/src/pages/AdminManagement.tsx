import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  UserCog,
  Code,
} from 'lucide-react';
import { api } from '../services/api';

interface Admin {
  id: string;
  loginid: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER';
  createdAt: string;
  isDeveloper?: boolean;
}

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

export default function AdminManagement() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newLoginId, setNewLoginId] = useState('');
  const [newRole, setNewRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'>('ADMIN');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'admins'],
    queryFn: () => api.admin.admins.list(),
  });

  const createMut = useMutation({
    mutationFn: () => api.admin.admins.create({ loginid: newLoginId, role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      setShowCreate(false);
      setNewLoginId('');
      setNewRole('ADMIN');
      console.log('관리자가 추가되었습니다.');
    },
    onError: () => console.log('관리자 추가에 실패했습니다.'),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.admin.admins.update(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      console.log('권한이 변경되었습니다.');
    },
    onError: () => console.log('권한 변경에 실패했습니다.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.admin.admins.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] });
      console.log('관리자가 삭제되었습니다.');
    },
    onError: () => console.log('관리자 삭제에 실패했습니다.'),
  });

  const admins: Admin[] = data?.admins ?? [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">관리자 목록을 불러오는데 실패했습니다.</p>
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
          <UserCog className="w-6 h-6 text-brand-500" />
          관리자 관리
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          관리자 추가
        </button>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">관리자 추가</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">로그인 ID *</label>
                <input
                  type="text"
                  value={newLoginId}
                  onChange={(e) => setNewLoginId(e.target.value)}
                  placeholder="loginid"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">권한 *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                >
                  <option value="SUPER_ADMIN">슈퍼 관리자</option>
                  <option value="ADMIN">관리자</option>
                  <option value="VIEWER">뷰어</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !newLoginId.trim()}
                  className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <th className="text-left py-3 px-4 font-medium text-gray-500">권한</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">생성일</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">구분</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">관리자가 없습니다.</td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-700 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-brand-400" />
                        {admin.loginid}
                      </td>
                      <td className="py-3 px-4">
                        {admin.isDeveloper ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[admin.role]}`}>
                            {ROLE_LABELS[admin.role]}
                          </span>
                        ) : (
                          <select
                            value={admin.role}
                            onChange={(e) => updateRoleMut.mutate({ id: admin.id, role: e.target.value })}
                            className="px-2 py-1 border rounded text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                          >
                            <option value="SUPER_ADMIN">슈퍼 관리자</option>
                            <option value="ADMIN">관리자</option>
                            <option value="VIEWER">뷰어</option>
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {new Date(admin.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="py-3 px-4">
                        {admin.isDeveloper && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            <Code className="w-3 h-3" />
                            Developer
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {admin.isDeveloper ? (
                          <span className="text-xs text-gray-400">수정 불가</span>
                        ) : (
                          <button
                            onClick={() => {
                              if (confirm(`${admin.loginid} 관리자를 삭제하시겠습니까?`))
                                deleteMut.mutate(admin.id);
                            }}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
