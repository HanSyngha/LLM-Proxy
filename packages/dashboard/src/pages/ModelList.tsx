import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { models } from '../services/api';
import { Cpu, Search, Loader2, Hash, Layers } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  displayName: string;
  alias: string | null;
  maxTokens: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function ModelList() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: models.list,
  });

  const modelList: Model[] = data?.models || [];

  const filteredModels = search.trim()
    ? modelList.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.displayName.toLowerCase().includes(search.toLowerCase()) ||
          (m.alias && m.alias.toLowerCase().includes(search.toLowerCase()))
      )
    : modelList;

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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">모델 목록</h1>
          <p className="text-sm text-gray-500 mt-1">
            사용 가능한 LLM 모델을 확인하세요. ({modelList.length}개)
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="모델 이름으로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Model grid */}
      {filteredModels.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Cpu size={40} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            {search ? '검색 결과가 없습니다.' : '등록된 모델이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map((model) => (
            <div
              key={model.id}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-brand-200 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-100 transition-colors">
                  <Cpu size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{model.displayName}</h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{model.name}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {model.alias && (
                  <div className="flex items-center gap-2 text-xs">
                    <Hash size={13} className="text-gray-400" />
                    <span className="text-gray-500">Alias:</span>
                    <code className="bg-gray-50 px-1.5 py-0.5 rounded text-brand-600 font-mono">
                      {model.alias}
                    </code>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <Layers size={13} className="text-gray-400" />
                  <span className="text-gray-500">Context Window:</span>
                  <span className="font-medium text-gray-700">
                    {formatTokens(model.maxTokens)} tokens
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
