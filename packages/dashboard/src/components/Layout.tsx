import { ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  Zap,
  Key,
  BarChart3,
  Cpu,
  LayoutDashboard,
  Users,
  Gauge,
  FileText,
  Server,
  Calendar,
  FlaskConical,
  Shield,
  ClipboardList,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const userNavItems: NavItem[] = [
  { label: 'API Keys', path: '/', icon: <Key size={18} /> },
  { label: '사용량', path: '/usage', icon: <BarChart3 size={18} /> },
  { label: '모델 목록', path: '/models', icon: <Cpu size={18} /> },
];

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard size={18} /> },
  { label: '사용량 분석', path: '/admin/usage', icon: <BarChart3 size={18} /> },
  { label: '모델 관리', path: '/admin/models', icon: <Cpu size={18} /> },
  { label: '사용자 관리', path: '/admin/users', icon: <Users size={18} /> },
  { label: '토큰 관리', path: '/admin/tokens', icon: <Key size={18} /> },
  { label: 'Rate Limits', path: '/admin/rate-limits', icon: <Gauge size={18} /> },
  { label: '휴일 관리', path: '/admin/holidays', icon: <Calendar size={18} /> },
  { label: 'LLM Test', path: '/admin/llm-test', icon: <FlaskConical size={18} /> },
  { label: '시스템', path: '/admin/system', icon: <Server size={18} /> },
  { label: 'Request Logs', path: '/admin/logs', icon: <FileText size={18} /> },
  { label: 'Audit Log', path: '/admin/audit', icon: <ClipboardList size={18} /> },
];

const pageTitles: Record<string, string> = {
  '/': 'API Keys',
  '/usage': '내 사용량',
  '/models': '모델 목록',
  '/admin': 'Admin Dashboard',
  '/admin/models': '모델 관리',
  '/admin/users': '사용자 관리',
  '/admin/tokens': '토큰 관리',
  '/admin/usage': '사용량 분석',
  '/admin/rate-limits': 'Rate Limits',
  '/admin/logs': 'Request Logs',
  '/admin/system': '시스템 상태',
  '/admin/holidays': '휴일 관리',
  '/admin/llm-test': 'LLM Test',
  '/admin/audit': 'Audit Log',
};

function NavSection({ title, items, collapsed }: { title: string; items: NavItem[]; collapsed: boolean }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-300 transition-colors"
      >
        {!collapsed && <span>{title}</span>}
        {!collapsed && (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
      </button>
      {(open || collapsed) && (
        <nav className="space-y-0.5 px-1">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/' || item.path === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-300 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { user, isAdmin, adminRole, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const pageTitle = pageTitles[location.pathname] || 'LLM Gateway';

  const roleLabel = adminRole === 'SUPER_ADMIN' ? '슈퍼관리자' :
                    adminRole === 'ADMIN' ? '관리자' :
                    adminRole === 'VIEWER' ? '뷰어' : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 transition-all duration-300 lg:translate-x-0 ${
          collapsed ? 'w-16' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex items-center justify-center w-9 h-9 bg-brand-500 rounded-xl shadow-lg shadow-brand-500/25">
            <Zap size={18} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">LLM Gateway</h1>
              <p className="text-[10px] text-slate-400 -mt-0.5">Dashboard</p>
            </div>
          )}
          {/* Mobile close */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <NavSection title="My" items={userNavItems} collapsed={collapsed} />
          {isAdmin && <NavSection title="Admin" items={adminNavItems} collapsed={collapsed} />}
        </div>

        {/* User section */}
        <div className="border-t border-slate-800 p-4">
          {user && (
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                {(user.username || user.loginid).charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">
                      {user.username || user.loginid}
                    </p>
                    {isAdmin && roleLabel && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-brand-500/20 text-brand-300 rounded">
                        <Shield size={10} />
                        {roleLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{user.deptname}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="로그아웃"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className={collapsed ? 'lg:ml-16' : 'lg:ml-64'}>
        {/* Top header bar */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-lg border-b border-gray-200">
          <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-3">
                {/* Mobile logo */}
                <div className="flex items-center gap-2 lg:hidden">
                  <div className="flex items-center justify-center w-7 h-7 bg-brand-500 rounded-lg">
                    <Zap size={14} className="text-white" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {pageTitle}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-700 font-medium">Online</span>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-brand-400 to-brand-600 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-white">
                  {(user?.username || user?.loginid || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
