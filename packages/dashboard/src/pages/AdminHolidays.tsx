import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CalendarDays,
  Upload,
  ChevronLeft,
  ChevronRight,
  Sun,
  Building2,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'NATIONAL' | 'COMPANY' | 'CUSTOM';
}

// 한국 공휴일 프리셋 (2024-2027)
const KOREAN_HOLIDAYS_PRESET: Record<number, Array<{ date: string; name: string; type: string }>> = {
  2024: [
    { date: '2024-01-01', name: '신정', type: 'NATIONAL' },
    { date: '2024-02-09', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2024-02-10', name: '설날', type: 'NATIONAL' },
    { date: '2024-02-11', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2024-02-12', name: '대체공휴일(설날)', type: 'NATIONAL' },
    { date: '2024-03-01', name: '삼일절', type: 'NATIONAL' },
    { date: '2024-04-10', name: '국회의원선거일', type: 'NATIONAL' },
    { date: '2024-05-05', name: '어린이날', type: 'NATIONAL' },
    { date: '2024-05-06', name: '대체공휴일(어린이날)', type: 'NATIONAL' },
    { date: '2024-05-15', name: '부처님오신날', type: 'NATIONAL' },
    { date: '2024-06-06', name: '현충일', type: 'NATIONAL' },
    { date: '2024-08-15', name: '광복절', type: 'NATIONAL' },
    { date: '2024-09-16', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2024-09-17', name: '추석', type: 'NATIONAL' },
    { date: '2024-09-18', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2024-10-03', name: '개천절', type: 'NATIONAL' },
    { date: '2024-10-09', name: '한글날', type: 'NATIONAL' },
    { date: '2024-12-25', name: '크리스마스', type: 'NATIONAL' },
  ],
  2025: [
    { date: '2025-01-01', name: '신정', type: 'NATIONAL' },
    { date: '2025-01-28', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2025-01-29', name: '설날', type: 'NATIONAL' },
    { date: '2025-01-30', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2025-03-01', name: '삼일절', type: 'NATIONAL' },
    { date: '2025-05-05', name: '부처님오신날/어린이날', type: 'NATIONAL' },
    { date: '2025-05-06', name: '대체공휴일', type: 'NATIONAL' },
    { date: '2025-06-06', name: '현충일', type: 'NATIONAL' },
    { date: '2025-08-15', name: '광복절', type: 'NATIONAL' },
    { date: '2025-10-03', name: '개천절', type: 'NATIONAL' },
    { date: '2025-10-05', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2025-10-06', name: '추석', type: 'NATIONAL' },
    { date: '2025-10-07', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2025-10-08', name: '대체공휴일(추석)', type: 'NATIONAL' },
    { date: '2025-10-09', name: '한글날', type: 'NATIONAL' },
    { date: '2025-12-25', name: '크리스마스', type: 'NATIONAL' },
  ],
  2026: [
    { date: '2026-01-01', name: '신정', type: 'NATIONAL' },
    { date: '2026-02-16', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2026-02-17', name: '설날', type: 'NATIONAL' },
    { date: '2026-02-18', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2026-03-01', name: '삼일절', type: 'NATIONAL' },
    { date: '2026-03-02', name: '대체공휴일(삼일절)', type: 'NATIONAL' },
    { date: '2026-05-05', name: '어린이날', type: 'NATIONAL' },
    { date: '2026-05-24', name: '부처님오신날', type: 'NATIONAL' },
    { date: '2026-05-25', name: '대체공휴일(부처님오신날)', type: 'NATIONAL' },
    { date: '2026-06-06', name: '현충일', type: 'NATIONAL' },
    { date: '2026-08-15', name: '광복절', type: 'NATIONAL' },
    { date: '2026-08-17', name: '대체공휴일(광복절)', type: 'NATIONAL' },
    { date: '2026-09-24', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2026-09-25', name: '추석', type: 'NATIONAL' },
    { date: '2026-09-26', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2026-10-03', name: '개천절', type: 'NATIONAL' },
    { date: '2026-10-05', name: '대체공휴일(개천절)', type: 'NATIONAL' },
    { date: '2026-10-09', name: '한글날', type: 'NATIONAL' },
    { date: '2026-12-25', name: '크리스마스', type: 'NATIONAL' },
  ],
  2027: [
    { date: '2027-01-01', name: '신정', type: 'NATIONAL' },
    { date: '2027-02-06', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2027-02-07', name: '설날', type: 'NATIONAL' },
    { date: '2027-02-08', name: '설날 연휴', type: 'NATIONAL' },
    { date: '2027-02-09', name: '대체공휴일(설날)', type: 'NATIONAL' },
    { date: '2027-03-01', name: '삼일절', type: 'NATIONAL' },
    { date: '2027-05-05', name: '어린이날', type: 'NATIONAL' },
    { date: '2027-05-13', name: '부처님오신날', type: 'NATIONAL' },
    { date: '2027-06-06', name: '현충일', type: 'NATIONAL' },
    { date: '2027-06-07', name: '대체공휴일(현충일)', type: 'NATIONAL' },
    { date: '2027-08-15', name: '광복절', type: 'NATIONAL' },
    { date: '2027-08-16', name: '대체공휴일(광복절)', type: 'NATIONAL' },
    { date: '2027-09-14', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2027-09-15', name: '추석', type: 'NATIONAL' },
    { date: '2027-09-16', name: '추석 연휴', type: 'NATIONAL' },
    { date: '2027-10-03', name: '개천절', type: 'NATIONAL' },
    { date: '2027-10-04', name: '대체공휴일(개천절)', type: 'NATIONAL' },
    { date: '2027-10-09', name: '한글날', type: 'NATIONAL' },
    { date: '2027-10-11', name: '대체공휴일(한글날)', type: 'NATIONAL' },
    { date: '2027-12-25', name: '크리스마스', type: 'NATIONAL' },
  ],
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

const TYPE_LABELS: Record<string, string> = {
  NATIONAL: '공휴일',
  COMPANY: '회사 휴일',
  CUSTOM: '커스텀',
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  NATIONAL: { bg: 'bg-red-100', text: 'text-red-700' },
  COMPANY: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CUSTOM: { bg: 'bg-purple-100', text: 'text-purple-700' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  NATIONAL: <Sun className="w-3 h-3" />,
  COMPANY: <Building2 className="w-3 h-3" />,
  CUSTOM: <Tag className="w-3 h-3" />,
};

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AdminHolidays() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', type: 'NATIONAL' as Holiday['type'] });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: fetchError, refetch } = useQuery({
    queryKey: ['holidays', currentYear],
    queryFn: () => api.holidays.list({ year: currentYear }),
  });

  const holidays: Holiday[] = data?.holidays ?? [];

  // Create a map of date string to holidays
  const holidayMap = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    holidays.forEach(h => {
      const dateStr = h.date.split('T')[0];
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(h);
    });
    return map;
  }, [holidays]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date | null; dateStr: string; isCurrentMonth: boolean }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, prevMonthLastDay - i);
      days.push({ date: d, dateStr: formatLocalDate(d), isCurrentMonth: false });
    }

    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(currentYear, currentMonth, i);
      days.push({ date: d, dateStr: formatLocalDate(d), isCurrentMonth: true });
    }

    // Next month padding (fill to 6 rows)
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      days.push({ date: d, dateStr: formatLocalDate(d), isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setNewHoliday({ date: dateStr, name: '', type: 'NATIONAL' });
    setShowAddModal(true);
  };

  const createMut = useMutation({
    mutationFn: () => api.holidays.create(newHoliday),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', currentYear] });
      setShowAddModal(false);
      setNewHoliday({ date: '', name: '', type: 'NATIONAL' });
      setError(null);
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || '휴일 추가에 실패했습니다.');
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.holidays.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays', currentYear] });
    },
    onError: () => setError('휴일 삭제에 실패했습니다.'),
  });

  const bulkCreateMut = useMutation({
    mutationFn: (year: number) => {
      const preset = KOREAN_HOLIDAYS_PRESET[year];
      if (!preset) throw new Error(`${year}년 프리셋이 없습니다.`);
      return api.holidays.bulkCreate({ holidays: preset });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['holidays', currentYear] });
      setShowBulkModal(false);
      const created = data?.created?.length ?? 0;
      const skipped = data?.skipped?.length ?? 0;
      setError(null);
      alert(`${created}개 휴일이 추가되었습니다. (${skipped}개 건너뜀)`);
    },
    onError: () => setError('일괄 추가에 실패했습니다.'),
  });

  const handleDeleteHoliday = (id: string, name: string) => {
    if (!confirm(`"${name}" 휴일을 삭제하시겠습니까?`)) return;
    deleteMut.mutate(id);
  };

  const todayStr = formatLocalDate(today);

  if (fetchError) {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-brand-500" />
            휴일 관리
          </h1>
          <p className="text-gray-500 mt-1 text-sm">주말 및 휴일을 관리하여 일 평균 활성 사용자 통계에 반영합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            프리셋 가져오기
          </button>
          <button
            onClick={() => {
              setNewHoliday({ date: '', name: '', type: 'NATIONAL' });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            휴일 추가
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value))}
              className="px-3 py-2 text-lg font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {Array.from({ length: 10 }, (_, i) => today.getFullYear() - 3 + i).map((year) => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="px-3 py-2 text-lg font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {MONTHS.map((month, idx) => (
                <option key={idx} value={idx}>{month}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => {
                setCurrentYear(today.getFullYear());
                setCurrentMonth(today.getMonth());
              }}
              className="px-3 py-2 text-sm font-medium text-brand-600 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors"
            >
              오늘
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAYS.map((day, idx) => (
            <div
              key={day}
              className={`py-3 text-center text-sm font-medium ${
                idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        {isLoading ? (
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, dateStr, isCurrentMonth }, idx) => {
              const dayHolidays = holidayMap.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const dayOfWeek = date?.getDay();

              return (
                <div
                  key={idx}
                  onClick={() => isCurrentMonth && handleDateClick(dateStr)}
                  className={`min-h-[120px] p-2 border-b border-r border-gray-100 cursor-pointer transition-colors ${
                    isCurrentMonth ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50'
                  } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-brand-500 text-white'
                          : !isCurrentMonth
                          ? 'text-gray-300'
                          : dayOfWeek === 0 || dayHolidays.some(h => h.type === 'NATIONAL')
                          ? 'text-red-500'
                          : dayOfWeek === 6
                          ? 'text-blue-500'
                          : 'text-gray-700'
                      }`}
                    >
                      {date?.getDate()}
                    </span>
                    {isToday && (
                      <span className="text-[10px] text-brand-500 font-medium">오늘</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayHolidays.slice(0, 3).map((h) => (
                      <div
                        key={h.id}
                        className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${TYPE_COLORS[h.type].bg} ${TYPE_COLORS[h.type].text}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {TYPE_ICONS[h.type]}
                        <span className="truncate flex-1">{h.name}</span>
                        <button
                          onClick={() => handleDeleteHoliday(h.id, h.name)}
                          className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity flex-shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {dayHolidays.length > 3 && (
                      <div className="text-xs text-gray-400 pl-1">
                        +{dayHolidays.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
          <span>공휴일</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
          <span>회사 휴일</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
          <span>커스텀</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-red-500">일</span>
          <span className="text-blue-500">토</span>
          <span className="text-gray-400">= 주말 (자동 제외)</span>
        </div>
      </div>

      {/* Holiday List */}
      <div className="bg-white rounded-xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{currentYear}년 휴일 목록 ({holidays.length}개)</h3>
        </div>
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {holidays.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400">
              등록된 휴일이 없습니다.
            </div>
          ) : (
            holidays.map((h) => {
              const dateStr = h.date.split('T')[0];
              const dayOfWeek = new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short' });
              return (
                <div key={h.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-500 font-mono w-24">{dateStr}</div>
                    <div className="text-sm text-gray-400 w-8">{dayOfWeek}</div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${TYPE_COLORS[h.type].bg} ${TYPE_COLORS[h.type].text}`}>
                      {TYPE_ICONS[h.type]}
                      {TYPE_LABELS[h.type]}
                    </span>
                    <span className="font-medium text-gray-800">{h.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteHoliday(h.id, h.name)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Holiday Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">휴일 추가</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜 *</label>
                <input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  placeholder="예: 설날, 추석"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">유형 *</label>
                <select
                  value={newHoliday.type}
                  onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value as Holiday['type'] })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                >
                  <option value="NATIONAL">공휴일</option>
                  <option value="COMPANY">회사 휴일</option>
                  <option value="CUSTOM">커스텀</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  취소
                </button>
                <button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !newHoliday.date || !newHoliday.name}
                  className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {createMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowBulkModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">공휴일 프리셋 가져오기</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-500 mb-4 text-sm">
                한국 공휴일 프리셋을 선택하여 일괄 추가합니다. 이미 등록된 날짜는 건너뜁니다.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(KOREAN_HOLIDAYS_PRESET).map((year) => (
                  <button
                    key={year}
                    onClick={() => bulkCreateMut.mutate(parseInt(year))}
                    disabled={bulkCreateMut.isPending}
                    className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-lg hover:bg-brand-50 hover:border-brand-300 transition-colors disabled:opacity-50"
                  >
                    <CalendarDays className="w-4 h-4 text-brand-500" />
                    <span className="font-medium">{year}년</span>
                    <span className="text-xs text-gray-400">
                      ({KOREAN_HOLIDAYS_PRESET[parseInt(year)]?.length}개)
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
