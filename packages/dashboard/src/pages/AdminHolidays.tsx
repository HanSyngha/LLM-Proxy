import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CalendarDays,
  Upload,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'NATIONAL' | 'COMPANY' | 'CUSTOM';
}

const TYPE_LABELS: Record<string, string> = {
  NATIONAL: '공휴일',
  COMPANY: '회사 휴일',
  CUSTOM: '커스텀',
};

const TYPE_COLORS: Record<string, string> = {
  NATIONAL: 'bg-red-100 text-red-700',
  COMPANY: 'bg-blue-100 text-blue-700',
  CUSTOM: 'bg-purple-100 text-purple-700',
};

export default function AdminHolidays() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editHoliday, setEditHoliday] = useState<Holiday | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({ date: '', name: '', type: 'NATIONAL' as Holiday['type'] });

  // Edit form
  const [editForm, setEditForm] = useState({ date: '', name: '', type: 'NATIONAL' as Holiday['type'] });

  // Bulk form
  const [bulkText, setBulkText] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.holidays.list({ year }),
  });

  const createMut = useMutation({
    mutationFn: () => api.holidays.create(createForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      setShowCreate(false);
      setCreateForm({ date: '', name: '', type: 'NATIONAL' });
      console.log('휴일이 추가되었습니다.');
    },
    onError: () => console.log('휴일 추가에 실패했습니다.'),
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!editHoliday) throw new Error('No holiday selected');
      const { date: _date, ...updateData } = editForm;
      return api.holidays.update(editHoliday.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      setEditHoliday(null);
      console.log('휴일이 수정되었습니다.');
    },
    onError: () => console.log('휴일 수정에 실패했습니다.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.holidays.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      console.log('휴일이 삭제되었습니다.');
    },
    onError: () => console.log('휴일 삭제에 실패했습니다.'),
  });

  const bulkCreateMut = useMutation({
    mutationFn: () => {
      const lines = bulkText.trim().split('\n').filter((l) => l.trim());
      const holidays = lines.map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        return {
          date: parts[0],
          name: parts[1] || '',
          type: (parts[2] as Holiday['type']) || 'NATIONAL',
        };
      });
      return api.holidays.bulkCreate({ holidays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', year] });
      setShowBulk(false);
      setBulkText('');
      console.log('휴일이 일괄 추가되었습니다.');
    },
    onError: () => console.log('일괄 추가에 실패했습니다.'),
  });

  const holidays: Holiday[] = data?.holidays ?? [];

  // Sort by date
  const sortedHolidays = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">휴일 목록을 불러오는데 실패했습니다.</p>
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
          <CalendarDays className="w-6 h-6 text-brand-500" />
          휴일 관리
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulk(true)}
            className="px-4 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            일괄 추가
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            휴일 추가
          </button>
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setYear(year - 1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-xl font-bold text-gray-900 min-w-[80px] text-center">{year}년</span>
        <button
          onClick={() => setYear(year + 1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">휴일 추가</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={createForm.date}
                  onChange={(e) => setCreateForm({ ...createForm, date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="예: 설날"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형 *</label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value as Holiday['type'] })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="NATIONAL">공휴일</option>
                  <option value="COMPANY">회사 휴일</option>
                  <option value="CUSTOM">커스텀</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  취소
                </button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !createForm.date || !createForm.name}
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

      {/* Edit Dialog */}
      {editHoliday && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">휴일 수정</h2>
              <button onClick={() => setEditHoliday(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input
                  type="date"
                  value={editForm.date}
                  disabled
                  className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형 *</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as Holiday['type'] })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                >
                  <option value="NATIONAL">공휴일</option>
                  <option value="COMPANY">회사 휴일</option>
                  <option value="CUSTOM">커스텀</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditHoliday(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  취소
                </button>
                <button
                  onClick={() => updateMut.mutate()}
                  disabled={updateMut.isPending || !editForm.date || !editForm.name}
                  className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {updateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Dialog */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">일괄 추가</h2>
              <button onClick={() => setShowBulk(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  휴일 목록 (한 줄에 하나씩)
                </label>
                <p className="text-xs text-gray-400 mb-2">형식: 날짜,이름,유형 (예: 2025-01-01,신정,NATIONAL)</p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={10}
                  placeholder={`2025-01-01,신정,NATIONAL\n2025-01-28,설날,NATIONAL\n2025-01-29,설날 연휴,NATIONAL`}
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowBulk(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                  취소
                </button>
                <button
                  onClick={() => bulkCreateMut.mutate()}
                  disabled={bulkCreateMut.isPending || !bulkText.trim()}
                  className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkCreateMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Holiday Table */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : sortedHolidays.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">{year}년에 등록된 휴일이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">날짜</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">요일</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">이름</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">유형</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {sortedHolidays.map((holiday) => {
                  const dayOfWeek = new Date(holiday.date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short' });
                  return (
                    <tr key={holiday.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-700">{holiday.date}</td>
                      <td className="py-3 px-4 text-gray-500">{dayOfWeek}</td>
                      <td className="py-3 px-4 text-gray-900 font-medium">{holiday.name}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[holiday.type]}`}>
                          {TYPE_LABELS[holiday.type]}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditHoliday(holiday);
                              setEditForm({ date: holiday.date, name: holiday.name, type: holiday.type });
                            }}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                            title="수정"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`"${holiday.name}" 휴일을 삭제하시겠습니까?`))
                                deleteMut.mutate(holiday.id);
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

      {/* Summary */}
      {sortedHolidays.length > 0 && (
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span>총 {sortedHolidays.length}일</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            공휴일 {sortedHolidays.filter((h) => h.type === 'NATIONAL').length}일
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            회사 휴일 {sortedHolidays.filter((h) => h.type === 'COMPANY').length}일
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            커스텀 {sortedHolidays.filter((h) => h.type === 'CUSTOM').length}일
          </span>
        </div>
      )}
    </div>
  );
}
