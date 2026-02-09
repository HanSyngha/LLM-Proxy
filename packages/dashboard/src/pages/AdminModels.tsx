import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  X,
  Server,
} from 'lucide-react';
import { api } from '../services/api';

interface SubModel {
  id: string;
  modelName: string;
  endpointUrl: string;
  apiKey?: string;
  sortOrder: number;
  enabled: boolean;
}

interface Model {
  id: string;
  name: string;
  displayName: string;
  alias?: string;
  endpointUrl: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
  maxTokens?: number;
  enabled: boolean;
  isHealthy?: boolean;
  sortOrder?: number;
}

interface ModelFormData {
  name: string;
  displayName: string;
  alias: string;
  endpointUrl: string;
  apiKey: string;
  extraHeaders: string;
  maxTokens: string;
  enabled: boolean;
}

const emptyForm: ModelFormData = {
  name: '',
  displayName: '',
  alias: '',
  endpointUrl: '',
  apiKey: '',
  extraHeaders: '{}',
  maxTokens: '',
  enabled: true,
};

function ModelDialog({
  open,
  onClose,
  onSubmit,
  initialData,
  title,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ModelFormData) => void;
  initialData: ModelFormData;
  title: string;
  loading: boolean;
}) {
  const [form, setForm] = useState<ModelFormData>(initialData);
  const [headersError, setHeadersError] = useState('');

  // Re-initialize form when dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      setForm(initialData);
      setHeadersError('');
    }
  }, [open, initialData]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (form.extraHeaders.trim()) {
        JSON.parse(form.extraHeaders);
      }
      setHeadersError('');
      onSubmit(form);
    } catch {
      setHeadersError('유효한 JSON 형식이 아닙니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">모델 이름 *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="gpt-4o"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">표시 이름 *</label>
            <input
              type="text"
              required
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="GPT-4o"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">별칭 (Alias)</label>
            <input
              type="text"
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="gpt4o"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">엔드포인트 URL *</label>
            <input
              type="url"
              required
              value={form.endpointUrl}
              onChange={(e) => setForm({ ...form, endpointUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="sk-..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">추가 헤더 (JSON)</label>
            <textarea
              value={form.extraHeaders}
              onChange={(e) => setForm({ ...form, extraHeaders: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-mono text-sm"
              rows={3}
              placeholder='{"X-Custom-Header": "value"}'
            />
            {headersError && <p className="text-red-500 text-xs mt-1">{headersError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최대 토큰</label>
            <input
              type="number"
              value={form.maxTokens}
              onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
              placeholder="4096"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-gray-700">활성화</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-brand-500 rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center gap-2"
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

function SubModelRow({
  modelId,
  sub,
}: {
  modelId: string;
  sub: SubModel;
}) {
  const queryClient = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: () => api.admin.models.deleteSubModel(modelId, sub.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models', 'subModels', modelId] });
      console.log('서브모델이 삭제되었습니다.');
    },
    onError: () => console.log('서브모델 삭제에 실패했습니다.'),
  });

  return (
    <tr className="border-b border-gray-50 bg-gray-50/50">
      <td className="py-2 px-4" />
      <td className="py-2 px-4 text-sm text-gray-600 pl-10">{sub.modelName}</td>
      <td className="py-2 px-4 text-sm text-gray-500 font-mono text-xs">{sub.endpointUrl}</td>
      <td className="py-2 px-4 text-sm text-gray-600">{sub.sortOrder}</td>
      <td className="py-2 px-4">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
          sub.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {sub.enabled ? '활성' : '비활성'}
        </span>
      </td>
      <td className="py-2 px-4" />
      <td className="py-2 px-4">
        <button
          onClick={() => {
            if (confirm('이 서브모델을 삭제하시겠습니까?')) deleteMut.mutate();
          }}
          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

export default function AdminModels() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editModel, setEditModel] = useState<Model | null>(null);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showAddSubModel, setShowAddSubModel] = useState<string | null>(null);
  const [subModelForm, setSubModelForm] = useState({ modelName: '', endpointUrl: '', apiKey: '', enabled: true });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'models'],
    queryFn: () => api.admin.models.list(),
  });

  const createMut = useMutation({
    mutationFn: (formData: ModelFormData) =>
      api.admin.models.create({
        name: formData.name,
        displayName: formData.displayName,
        alias: formData.alias || undefined,
        endpointUrl: formData.endpointUrl,
        apiKey: formData.apiKey || undefined,
        extraHeaders: formData.extraHeaders ? JSON.parse(formData.extraHeaders) : undefined,
        maxTokens: formData.maxTokens ? parseInt(formData.maxTokens) : undefined,
        enabled: formData.enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
      setShowCreate(false);
      console.log('모델이 생성되었습니다.');
    },
    onError: () => console.log('모델 생성에 실패했습니다.'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: ModelFormData }) =>
      api.admin.models.update(id, {
        name: formData.name,
        displayName: formData.displayName,
        alias: formData.alias || undefined,
        endpointUrl: formData.endpointUrl,
        apiKey: formData.apiKey || undefined,
        extraHeaders: formData.extraHeaders ? JSON.parse(formData.extraHeaders) : undefined,
        maxTokens: formData.maxTokens ? parseInt(formData.maxTokens) : undefined,
        enabled: formData.enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
      setEditModel(null);
      console.log('모델이 수정되었습니다.');
    },
    onError: () => console.log('모델 수정에 실패했습니다.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.admin.models.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
      console.log('모델이 삭제되었습니다.');
    },
    onError: () => console.log('모델 삭제에 실패했습니다.'),
  });

  const testMut = useMutation({
    mutationFn: (model: Model) =>
      api.admin.models.test({
        endpointUrl: model.endpointUrl,
        modelName: model.name,
        apiKey: model.apiKey,
        extraHeaders: model.extraHeaders,
      }),
    onSuccess: () => {
      setTestingId(null);
      console.log('엔드포인트 테스트 성공!');
    },
    onError: () => {
      setTestingId(null);
      console.log('엔드포인트 테스트 실패.');
    },
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => api.admin.models.reorder(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models'] });
      console.log('순서가 변경되었습니다.');
    },
  });

  const createSubModelMut = useMutation({
    mutationFn: ({ modelId, data }: { modelId: string; data: typeof subModelForm }) =>
      api.admin.models.createSubModel(modelId, {
        modelName: data.modelName,
        endpointUrl: data.endpointUrl,
        apiKey: data.apiKey || undefined,
        enabled: data.enabled,
      }),
    onSuccess: (_, { modelId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'models', 'subModels', modelId] });
      setShowAddSubModel(null);
      setSubModelForm({ modelName: '', endpointUrl: '', apiKey: '', enabled: true });
      console.log('서브모델이 추가되었습니다.');
    },
    onError: () => console.log('서브모델 추가에 실패했습니다.'),
  });

  const models: Model[] = data?.models ?? [];

  const moveModel = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const ids = models.map((m) => m.id);
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= ids.length) return;
      [ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
      reorderMut.mutate(ids);
    },
    [models, reorderMut]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600">모델 목록을 불러오는데 실패했습니다.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> 다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">모델 관리</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          모델 추가
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-white rounded-xl shadow-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="w-10 py-3 px-4" />
                  <th className="text-left py-3 px-4 font-medium text-gray-500">모델 이름</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">엔드포인트</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">최대 토큰</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">상태</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">건강</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">작업</th>
                </tr>
              </thead>
              <tbody>
                {models.map((model, index) => (
                  <ModelRow
                    key={model.id}
                    model={model}
                    index={index}
                    totalCount={models.length}
                    expandedModel={expandedModel}
                    testingId={testingId}
                    showAddSubModel={showAddSubModel}
                    subModelForm={subModelForm}
                    onToggleExpand={(id) => setExpandedModel(expandedModel === id ? null : id)}
                    onEdit={(m) =>
                      setEditModel(m)
                    }
                    onDelete={(id) => {
                      if (confirm('이 모델을 삭제하시겠습니까?')) deleteMut.mutate(id);
                    }}
                    onTest={(m) => {
                      setTestingId(m.id);
                      testMut.mutate(m);
                    }}
                    onMove={moveModel}
                    onShowAddSubModel={(id) => setShowAddSubModel(showAddSubModel === id ? null : id)}
                    onSubModelFormChange={setSubModelForm}
                    onCreateSubModel={(modelId) => createSubModelMut.mutate({ modelId, data: subModelForm })}
                    createSubModelLoading={createSubModelMut.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <ModelDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(formData) => createMut.mutate(formData)}
        initialData={emptyForm}
        title="모델 추가"
        loading={createMut.isPending}
      />

      {/* Edit Dialog */}
      {editModel && (
        <ModelDialog
          open={!!editModel}
          onClose={() => setEditModel(null)}
          onSubmit={(formData) => updateMut.mutate({ id: editModel.id, formData })}
          initialData={{
            name: editModel.name,
            displayName: editModel.displayName,
            alias: editModel.alias || '',
            endpointUrl: editModel.endpointUrl,
            apiKey: editModel.apiKey || '',
            extraHeaders: editModel.extraHeaders ? JSON.stringify(editModel.extraHeaders, null, 2) : '{}',
            maxTokens: editModel.maxTokens?.toString() || '',
            enabled: editModel.enabled,
          }}
          title="모델 수정"
          loading={updateMut.isPending}
        />
      )}
    </div>
  );
}

function ModelRow({
  model,
  index,
  totalCount,
  expandedModel,
  testingId,
  showAddSubModel,
  subModelForm,
  onToggleExpand,
  onEdit,
  onDelete,
  onTest,
  onMove,
  onShowAddSubModel,
  onSubModelFormChange,
  onCreateSubModel,
  createSubModelLoading,
}: {
  model: Model;
  index: number;
  totalCount: number;
  expandedModel: string | null;
  testingId: string | null;
  showAddSubModel: string | null;
  subModelForm: { modelName: string; endpointUrl: string; apiKey: string; enabled: boolean };
  onToggleExpand: (id: string) => void;
  onEdit: (m: Model) => void;
  onDelete: (id: string) => void;
  onTest: (m: Model) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onShowAddSubModel: (id: string) => void;
  onSubModelFormChange: (form: { modelName: string; endpointUrl: string; apiKey: string; enabled: boolean }) => void;
  onCreateSubModel: (modelId: string) => void;
  createSubModelLoading: boolean;
}) {
  const isExpanded = expandedModel === model.id;

  const { data: subModelsData } = useQuery({
    queryKey: ['admin', 'models', 'subModels', model.id],
    queryFn: () => api.admin.models.getSubModels(model.id),
    enabled: isExpanded,
  });

  const subModels: SubModel[] = subModelsData?.subModels ?? [];

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="py-3 px-4">
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => onMove(index, 'up')}
              disabled={index === 0}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <GripVertical className="w-4 h-4 text-gray-300" />
            <button
              onClick={() => onMove(index, 'down')}
              disabled={index === totalCount - 1}
              className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        </td>
        <td className="py-3 px-4">
          <button
            onClick={() => onToggleExpand(model.id)}
            className="flex items-center gap-2 hover:text-brand-600 transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <div>
              <p className="font-medium text-gray-900">{model.displayName}</p>
              <p className="text-xs text-gray-500 font-mono">{model.name}</p>
            </div>
          </button>
        </td>
        <td className="py-3 px-4 text-xs font-mono text-gray-500 max-w-[200px] truncate">{model.endpointUrl}</td>
        <td className="py-3 px-4 text-gray-600">{model.maxTokens ?? '-'}</td>
        <td className="py-3 px-4">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            model.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {model.enabled ? '활성' : '비활성'}
          </span>
        </td>
        <td className="py-3 px-4">
          {model.isHealthy === undefined ? (
            <span className="text-gray-400 text-xs">-</span>
          ) : model.isHealthy ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => onTest(model)}
              disabled={testingId === model.id}
              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
              title="엔드포인트 테스트"
            >
              {testingId === model.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={() => onEdit(model)}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
              title="수정"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(model.id)}
              className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <>
          {subModels.map((sub) => (
            <SubModelRow key={sub.id} modelId={model.id} sub={sub} />
          ))}
          {showAddSubModel === model.id && (
            <tr className="bg-blue-50/50 border-b">
              <td />
              <td colSpan={6} className="py-3 px-4">
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">모델 이름</label>
                    <input
                      type="text"
                      value={subModelForm.modelName}
                      onChange={(e) => onSubModelFormChange({ ...subModelForm, modelName: e.target.value })}
                      className="px-2 py-1.5 border rounded text-sm w-40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">엔드포인트 URL</label>
                    <input
                      type="text"
                      value={subModelForm.endpointUrl}
                      onChange={(e) => onSubModelFormChange({ ...subModelForm, endpointUrl: e.target.value })}
                      className="px-2 py-1.5 border rounded text-sm w-60"
                    />
                  </div>
                  <button
                    onClick={() => onCreateSubModel(model.id)}
                    disabled={createSubModelLoading}
                    className="px-3 py-1.5 bg-brand-500 text-white text-sm rounded hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {createSubModelLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    추가
                  </button>
                </div>
              </td>
            </tr>
          )}
          <tr className="bg-gray-50/30 border-b">
            <td />
            <td colSpan={6} className="py-2 px-4">
              <button
                onClick={() => onShowAddSubModel(model.id)}
                className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <Server className="w-3 h-3" />
                서브모델 추가 (로드밸런싱)
              </button>
            </td>
          </tr>
        </>
      )}
    </>
  );
}
