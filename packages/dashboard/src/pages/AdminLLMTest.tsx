import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  Play,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
  CheckCircle,
  Clock,
  Target,
  Activity,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '../services/api';

interface TestPair {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  intervalMinutes: number;
  questionerModelName: string;
  questionerEndpoint: string;
  questionerApiKey?: string | null;
  questionerExtraHeaders?: Record<string, string> | null;
  testModelName: string;
  testEndpoint: string;
  testApiKey?: string | null;
  testExtraHeaders?: Record<string, string> | null;
  questionPrompt?: string;
  evaluationPrompt?: string;
  lastRunAt?: string;
  lastScore?: number;
  lastLatency?: number;
  _count?: { results: number };
}

interface TestPairFormData {
  name: string;
  description: string;
  testModelName: string;
  testEndpoint: string;
  testApiKey: string;
  testExtraHeaders: string;
  questionerModelName: string;
  questionerEndpoint: string;
  questionerApiKey: string;
  questionerExtraHeaders: string;
  questionPrompt: string;
  evaluationPrompt: string;
  intervalMinutes: string;
  enabled: boolean;
}

const emptyForm: TestPairFormData = {
  name: '',
  description: '',
  testModelName: '',
  testEndpoint: '',
  testApiKey: '',
  testExtraHeaders: '',
  questionerModelName: '',
  questionerEndpoint: '',
  questionerApiKey: '',
  questionerExtraHeaders: '',
  questionPrompt: '',
  evaluationPrompt: '',
  intervalMinutes: '5',
  enabled: true,
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function TestPairDialog({
  open,
  onClose,
  onSubmit,
  initialData,
  title,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TestPairFormData) => void;
  initialData: TestPairFormData;
  title: string;
  loading: boolean;
}) {
  const [form, setForm] = useState<TestPairFormData>(initialData);
  const [headersError, setHeadersError] = useState('');

  // Re-initialize form when initialData changes (fix stale form state)
  useEffect(() => {
    if (open) setForm(initialData);
  }, [open, initialData]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate JSON fields
    try {
      if (form.testExtraHeaders.trim()) JSON.parse(form.testExtraHeaders);
      if (form.questionerExtraHeaders.trim()) JSON.parse(form.questionerExtraHeaders);
      setHeadersError('');
      onSubmit(form);
    } catch {
      setHeadersError('Extra Headers는 유효한 JSON 형식이어야 합니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
                placeholder="GPT-4o 품질 테스트"
              />
            </div>
          </div>

          {/* Test Model */}
          <div className="p-4 bg-blue-50 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-blue-800">테스트 대상 모델</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">모델명 *</label>
                <input
                  type="text"
                  required
                  value={form.testModelName}
                  onChange={(e) => setForm({ ...form, testModelName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="gpt-4o"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                <input
                  type="password"
                  value={form.testApiKey}
                  onChange={(e) => setForm({ ...form, testApiKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="sk-..."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">엔드포인트 URL *</label>
                <input
                  type="url"
                  required
                  value={form.testEndpoint}
                  onChange={(e) => setForm({ ...form, testEndpoint: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Extra Headers (JSON)</label>
                <input
                  type="text"
                  value={form.testExtraHeaders}
                  onChange={(e) => setForm({ ...form, testExtraHeaders: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder='{"x-custom": "value"}'
                />
              </div>
            </div>
          </div>

          {/* Questioner Model */}
          <div className="p-4 bg-green-50 rounded-lg space-y-3">
            <h3 className="text-sm font-semibold text-green-800">질문자 모델</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">모델명 *</label>
                <input
                  type="text"
                  required
                  value={form.questionerModelName}
                  onChange={(e) => setForm({ ...form, questionerModelName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="gpt-4o-mini"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
                <input
                  type="password"
                  value={form.questionerApiKey}
                  onChange={(e) => setForm({ ...form, questionerApiKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="sk-..."
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">엔드포인트 URL *</label>
                <input
                  type="url"
                  required
                  value={form.questionerEndpoint}
                  onChange={(e) => setForm({ ...form, questionerEndpoint: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder="https://api.openai.com/v1/chat/completions"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Extra Headers (JSON)</label>
                <input
                  type="text"
                  value={form.questionerExtraHeaders}
                  onChange={(e) => setForm({ ...form, questionerExtraHeaders: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                  placeholder='{"x-custom": "value"}'
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">질문 프롬프트</label>
            <textarea
              value={form.questionPrompt}
              onChange={(e) => setForm({ ...form, questionPrompt: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm"
              placeholder="질문 생성용 프롬프트"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">평가 프롬프트</label>
            <textarea
              value={form.evaluationPrompt}
              onChange={(e) => setForm({ ...form, evaluationPrompt: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm"
              placeholder="평가용 프롬프트"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">테스트 간격 (분) *</label>
            <input
              type="number"
              required
              value={form.intervalMinutes}
              onChange={(e) => setForm({ ...form, intervalMinutes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              min={1}
              max={60}
            />
            <p className="text-xs text-gray-400 mt-1">1~60분. 기본 5분.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pairEnabled"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="pairEnabled" className="text-sm font-medium text-gray-700">활성화</label>
          </div>

          {headersError && <p className="text-sm text-red-500">{headersError}</p>}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PairResultCharts({ pairId }: { pairId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['llmTest', 'results', pairId],
    queryFn: () => api.llmTest.getResults(pairId, { limit: 50 }),
  });

  const results = data?.results ?? [];
  const chartData = [...results].reverse().map((r: { timestamp: string; score: number; latencyMs: number }) => ({
    time: new Date(r.timestamp).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    score: r.score,
    latency: r.latencyMs,
  }));

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">아직 테스트 결과가 없습니다.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">점수 추이</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} />
            <Tooltip />
            <Line type="monotone" dataKey="score" name="점수" stroke="#6366F1" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">응답시간 추이</h4>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 11 }} unit="ms" />
            <Tooltip formatter={(value: number) => `${value}ms`} />
            <Legend />
            <Line type="monotone" dataKey="latency" name="응답시간" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function buildFormPayload(form: TestPairFormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name,
    testModelName: form.testModelName,
    testEndpoint: form.testEndpoint,
    questionerModelName: form.questionerModelName,
    questionerEndpoint: form.questionerEndpoint,
    intervalMinutes: parseInt(form.intervalMinutes) || 5,
    enabled: form.enabled,
  };
  if (form.testApiKey && form.testApiKey !== '********') payload.testApiKey = form.testApiKey;
  if (form.questionerApiKey && form.questionerApiKey !== '********') payload.questionerApiKey = form.questionerApiKey;
  if (form.testExtraHeaders.trim()) payload.testExtraHeaders = JSON.parse(form.testExtraHeaders);
  if (form.questionerExtraHeaders.trim()) payload.questionerExtraHeaders = JSON.parse(form.questionerExtraHeaders);
  if (form.questionPrompt) payload.questionPrompt = form.questionPrompt;
  if (form.evaluationPrompt) payload.evaluationPrompt = form.evaluationPrompt;
  return payload;
}

export default function AdminLLMTest() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editPair, setEditPair] = useState<TestPair | null>(null);
  const [expandedPair, setExpandedPair] = useState<string | null>(null);

  const { data: statsData } = useQuery({
    queryKey: ['llmTest', 'stats'],
    queryFn: () => api.llmTest.stats(),
    refetchInterval: 30_000,
  });

  const { data: pairsData, isLoading, error, refetch } = useQuery({
    queryKey: ['llmTest', 'pairs'],
    queryFn: () => api.llmTest.listPairs(),
  });

  const createMut = useMutation({
    mutationFn: (form: TestPairFormData) => api.llmTest.createPair(buildFormPayload(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmTest'] });
      setShowCreate(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, form }: { id: string; form: TestPairFormData }) =>
      api.llmTest.updatePair(id, buildFormPayload(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['llmTest'] });
      setEditPair(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.llmTest.deletePair(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['llmTest'] }),
  });

  const [runningPairId, setRunningPairId] = useState<string | null>(null);
  const runTestMut = useMutation({
    mutationFn: (id: string) => { setRunningPairId(id); return api.llmTest.runTest(id); },
    onSuccess: () => { setRunningPairId(null); queryClient.invalidateQueries({ queryKey: ['llmTest'] }); },
    onError: () => setRunningPairId(null),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.llmTest.updatePair(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['llmTest'] }),
  });

  const pairs: TestPair[] = pairsData?.pairs ?? [];
  const stats = statsData;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">LLM 테스트 데이터를 불러오는데 실패했습니다.</p>
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
          <FlaskConical className="w-6 h-6 text-brand-500" />
          LLM 테스트 관리
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          테스트 페어 추가
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={FlaskConical} label="전체 페어" value={stats?.totalPairs ?? 0} color="bg-brand-500" />
        <StatCard icon={CheckCircle} label="활성 페어" value={stats?.enabledPairs ?? 0} color="bg-green-500" />
        <StatCard icon={Target} label="평균 점수" value={stats?.avgScore != null ? stats.avgScore.toFixed(1) : '-'} color="bg-blue-500" />
        <StatCard icon={Activity} label="성공률" value={stats?.successRate != null ? `${stats.successRate}%` : '-'} color="bg-purple-500" />
        <StatCard icon={Zap} label="평균 응답시간" value={stats?.avgLatency != null ? `${stats.avgLatency}ms` : '-'} color="bg-amber-500" />
      </div>

      {/* Test Pairs */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl shadow-card animate-pulse" />
          ))}
        </div>
      ) : pairs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-card p-12 text-center">
          <FlaskConical className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">등록된 테스트 페어가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair) => (
            <div key={pair.id} className="bg-white rounded-xl shadow-card overflow-hidden">
              {/* Pair Row */}
              <div className="p-4 flex items-center justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setExpandedPair(expandedPair === pair.id ? null : pair.id)}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{pair.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      pair.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {pair.enabled ? '활성' : '비활성'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span>테스트: <span className="font-mono text-gray-700">{pair.testModelName}</span></span>
                    <span>질문자: <span className="font-mono text-gray-700">{pair.questionerModelName}</span></span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {pair.intervalMinutes >= 60 ? `${pair.intervalMinutes / 60}시간` : `${pair.intervalMinutes}분`}
                    </span>
                    {pair.lastRunAt && (
                      <span>마지막 실행: {new Date(pair.lastRunAt).toLocaleString('ko-KR')}</span>
                    )}
                    {pair.lastScore != null && (
                      <span className="font-medium text-brand-600">점수: {pair.lastScore.toFixed(1)}</span>
                    )}
                    {pair.lastLatency != null && (
                      <span>{pair.lastLatency}ms</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => runTestMut.mutate(pair.id)}
                    disabled={runTestMut.isPending}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                    title="수동 실행"
                  >
                    {runningPairId === pair.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => toggleMut.mutate({ id: pair.id, enabled: !pair.enabled })}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                    title={pair.enabled ? '비활성화' : '활성화'}
                  >
                    {pair.enabled ? (
                      <ToggleRight className="w-4 h-4 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditPair(pair)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    title="수정"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`"${pair.name}" 테스트 페어를 삭제하시겠습니까?`))
                        deleteMut.mutate(pair.id);
                    }}
                    className="p-2 text-red-400 hover:bg-red-50 rounded transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Charts */}
              {expandedPair === pair.id && (
                <div className="border-t bg-gray-50/50 p-4">
                  <PairResultCharts pairId={pair.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <TestPairDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(form) => createMut.mutate(form)}
        initialData={emptyForm}
        title="테스트 페어 추가"
        loading={createMut.isPending}
      />

      {/* Edit Dialog */}
      {editPair && (
        <TestPairDialog
          open={!!editPair}
          onClose={() => setEditPair(null)}
          onSubmit={(form) => updateMut.mutate({ id: editPair.id, form })}
          initialData={{
            name: editPair.name,
            description: editPair.description || '',
            testModelName: editPair.testModelName,
            testEndpoint: editPair.testEndpoint || '',
            testApiKey: editPair.testApiKey || '',
            testExtraHeaders: editPair.testExtraHeaders ? JSON.stringify(editPair.testExtraHeaders) : '',
            questionerModelName: editPair.questionerModelName,
            questionerEndpoint: editPair.questionerEndpoint || '',
            questionerApiKey: editPair.questionerApiKey || '',
            questionerExtraHeaders: editPair.questionerExtraHeaders ? JSON.stringify(editPair.questionerExtraHeaders) : '',
            questionPrompt: editPair.questionPrompt || '',
            evaluationPrompt: editPair.evaluationPrompt || '',
            intervalMinutes: editPair.intervalMinutes.toString(),
            enabled: editPair.enabled,
          }}
          title="테스트 페어 수정"
          loading={updateMut.isPending}
        />
      )}
    </div>
  );
}
