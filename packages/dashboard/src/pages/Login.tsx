import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { Zap, Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, login } = useAuth();
  const [ssoToken, setSsoToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoProcessing, setAutoProcessing] = useState(false);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Check for SSO token in URL params or hash
  useEffect(() => {
    const processToken = async (token: string) => {
      setAutoProcessing(true);
      try {
        await login(token);
        navigate('/', { replace: true });
      } catch {
        setError('SSO 인증에 실패했습니다. 다시 시도해 주세요.');
        setAutoProcessing(false);
      }
    };

    // Check URL search params for token
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      processToken(tokenParam);
      return;
    }

    // Check URL hash for base64 encoded SSO token
    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const hashToken = hash.substring(1); // remove #
      try {
        // Try to decode as base64
        const decoded = atob(hashToken);
        if (decoded) {
          processToken(decoded);
          return;
        }
      } catch {
        // Not base64, try as raw token
        processToken(hashToken);
        return;
      }
    }
  }, [searchParams, login, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ssoToken.trim()) {
      setError('SSO 토큰을 입력해 주세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login(ssoToken.trim());
      navigate('/', { replace: true });
    } catch {
      setError('인증에 실패했습니다. 토큰을 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (autoProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl mx-auto mb-6">
            <Zap size={32} className="text-white" />
          </div>
          <Loader2 size={32} className="text-brand-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 text-sm">SSO 인증 처리 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl mx-auto mb-4 shadow-lg shadow-brand-500/25">
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">LLM Gateway</h1>
          <p className="text-slate-400 mt-1">AI Model Management Dashboard</p>
        </div>

        {/* Login card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            로그인
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="ssoToken"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                SSO Token
              </label>
              <input
                id="ssoToken"
                type="password"
                value={ssoToken}
                onChange={(e) => setSsoToken(e.target.value)}
                placeholder="SSO 토큰을 붙여넣기 해주세요"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  인증 중...
                </>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              사내 SSO 시스템을 통해 발급받은 토큰으로 로그인하세요.
              <br />
              문의사항은 AI Platform팀으로 연락해 주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
