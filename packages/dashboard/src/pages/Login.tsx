import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Zap, LogIn, Loader2, AlertCircle } from 'lucide-react';

// SSO 설정 (환경변수로 오버라이드 가능)
const SSO_BASE_URL = import.meta.env.VITE_SSO_URL || 'https://genai.samsungds.net:36810';
const SSO_PATH = '/direct_sso';

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingCallback, setProcessingCallback] = useState(false);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // SSO 콜백 처리 (URL에서 data 파라미터 확인)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const data = urlParams.get('data');

    if (data) {
      setProcessingCallback(true);
      handleSSOCallback(data);
    }
  }, []);

  // SSO 콜백 데이터 처리
  const handleSSOCallback = async (dataString: string) => {
    try {
      // Parse SSO data (decode URL-encoded string first)
      const decodedData = decodeURIComponent(dataString);
      const ssoData = JSON.parse(decodedData);

      if (!ssoData.loginid || !ssoData.username) {
        throw new Error('Invalid SSO data');
      }

      // Generate a temporary token from SSO data for backend verification
      // Use encodeURIComponent + unescape for Unicode-safe base64 encoding
      const jsonData = JSON.stringify({
        loginid: ssoData.loginid,
        username: ssoData.username,
        deptname: ssoData.deptname || '',
        timestamp: Date.now(),
      });
      const ssoToken = btoa(unescape(encodeURIComponent(jsonData)));

      // Exchange SSO data for session token
      await login(`sso.${ssoToken}`);

      // Clear URL params to prevent re-submission
      window.history.replaceState({}, document.title, window.location.pathname);

      // Redirect to dashboard
      navigate('/', { replace: true });
    } catch (err) {
      console.error('SSO callback error:', err);
      setError('SSO 인증 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } finally {
      setProcessingCallback(false);
    }
  };

  // SSO 로그인 시작 (SSO 서버로 리다이렉트)
  const handleSSOLogin = () => {
    setLoading(true);
    setError('');

    // Build redirect URL (current page)
    const redirectUrl = window.location.origin + window.location.pathname;

    // Build SSO URL
    const ssoUrl = new URL(SSO_PATH, SSO_BASE_URL);
    ssoUrl.searchParams.set('redirect_url', redirectUrl);

    // Redirect to SSO
    window.location.href = ssoUrl.toString();
  };

  // 로딩 중 (SSO 콜백 처리)
  if (processingCallback) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center w-16 h-16 bg-brand-500 rounded-2xl mx-auto mb-6">
            <Zap size={32} className="text-white" />
          </div>
          <Loader2 size={32} className="text-brand-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300 text-sm">SSO 인증 처리 중...</p>
          <p className="text-slate-500 text-xs mt-2">잠시만 기다려주세요</p>
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
          <h2 className="text-xl font-semibold text-white mb-2 text-center">
            로그인
          </h2>
          <p className="text-sm text-slate-400 mb-6 text-center">SSO를 통해 로그인하세요</p>

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            onClick={handleSSOLogin}
            disabled={loading}
            className="w-full py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                SSO 페이지로 이동 중...
              </>
            ) : (
              <>
                <LogIn size={18} />
                SSO로 로그인
              </>
            )}
          </button>

          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="text-xs text-slate-400 text-center leading-relaxed">
              Samsung DS 계정으로 로그인됩니다
              <br />
              문의사항은 AI Platform팀으로 연락해 주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
