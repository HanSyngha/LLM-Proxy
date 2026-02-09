import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { auth } from './services/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import MyTokens from './pages/MyTokens';
import MyUsage from './pages/MyUsage';
import ModelList from './pages/ModelList';
import AdminDashboard from './pages/AdminDashboard';
import AdminModels from './pages/AdminModels';
import AdminUsers from './pages/AdminUsers';
import AdminTokens from './pages/AdminTokens';
import AdminUsage from './pages/AdminUsage';
import AdminRateLimits from './pages/AdminRateLimits';
import AdminRequestLogs from './pages/AdminRequestLogs';
import AdminSystemHealth from './pages/AdminSystemHealth';
import AdminManagement from './pages/AdminManagement';
import AdminAuditLog from './pages/AdminAuditLog';
import AdminHolidays from './pages/AdminHolidays';
import AdminLLMTest from './pages/AdminLLMTest';

// ==================== Types ====================
interface User {
  id: string;
  loginid: string;
  deptname: string;
  username: string;
}

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  adminRole: string | null;
  isDeveloper: boolean;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

// ==================== Auth Context ====================
const AuthContext = createContext<AuthState>({
  user: null,
  isAdmin: false,
  adminRole: null,
  isDeveloper: false,
  loading: true,
  login: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('llm_proxy_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await auth.check();
      setUser(data.user);
      setIsAdmin(data.isAdmin);
      setAdminRole(data.adminRole);
      setIsDeveloper(data.isDeveloper);
    } catch {
      localStorage.removeItem('llm_proxy_token');
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (token: string) => {
    localStorage.setItem('llm_proxy_token', token);
    try {
      const data = await auth.login(token);
      if (data.sessionToken) {
        localStorage.setItem('llm_proxy_token', data.sessionToken);
      }
      setUser(data.user);
      setIsAdmin(data.isAdmin);
      setAdminRole(data.adminRole);
      setIsDeveloper(data.isDeveloper || false);
    } catch {
      localStorage.removeItem('llm_proxy_token');
      throw new Error('Login failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('llm_proxy_token');
    setUser(null);
    setIsAdmin(false);
    setAdminRole(null);
    setIsDeveloper(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, adminRole, isDeveloper, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ==================== Route Guards ====================
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// ==================== App ====================
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<MyTokens />} />
                    <Route path="/usage" element={<MyUsage />} />
                    <Route path="/models" element={<ModelList />} />
                    {/* Admin routes */}
                    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="/admin/models" element={<AdminRoute><AdminModels /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
                    <Route path="/admin/tokens" element={<AdminRoute><AdminTokens /></AdminRoute>} />
                    <Route path="/admin/usage" element={<AdminRoute><AdminUsage /></AdminRoute>} />
                    <Route path="/admin/rate-limits" element={<AdminRoute><AdminRateLimits /></AdminRoute>} />
                    <Route path="/admin/logs" element={<AdminRoute><AdminRequestLogs /></AdminRoute>} />
                    <Route path="/admin/system" element={<AdminRoute><AdminSystemHealth /></AdminRoute>} />
                    <Route path="/admin/management" element={<AdminRoute><AdminManagement /></AdminRoute>} />
                    <Route path="/admin/audit" element={<AdminRoute><AdminAuditLog /></AdminRoute>} />
                    <Route path="/admin/holidays" element={<AdminRoute><AdminHolidays /></AdminRoute>} />
                    <Route path="/admin/llm-test" element={<AdminRoute><AdminLLMTest /></AdminRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
