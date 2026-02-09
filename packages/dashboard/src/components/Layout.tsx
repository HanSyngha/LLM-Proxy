import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  { label: '모델 관리', path: '/admin/models', icon: <Cpu size={18} /> },
  { label: '사용자 관리', path: '/admin/users', icon: <Users size={18} /> },
  { label: '토큰 관리', path: '/admin/tokens', icon: <Key size={18} /> },
  { label: '사용량 분석', path: '/admin/usage', icon: <BarChart3 size={18} /> },
  { label: 'Rate Limits', path: '/admin/rate-limits', icon: <Gauge size={18} /> },
  { label: 'Request Logs', path: '/admin/logs', icon: <FileText size={18} /> },
  { label: '시스템', path: '/admin/system', icon: <Server size={18} /> },
  { label: '휴일 관리', path: '/admin/holidays', icon: <Calendar size={18} /> },
  { label: 'LLM Test', path: '/admin/llm-test', icon: <FlaskConical size={18} /> },
  { label: '관리자', path: '/admin/management', icon: <Shield size={18} /> },
  { label: 'Audit Log', path: '/admin/audit', icon: <ClipboardList size={18} /> },
];

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
        <nav className="space-y-0.5">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/' || item.path === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-500/20 text-brand-300 shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-900 transition-all duration-300 lg:relative lg:translate-x-0 ${
          collapsed ? 'w-16' : 'w-64'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
          <div className="flex items-center justify-center w-8 h-8 bg-brand-500 rounded-lg">
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
        <div className="border-t border-slate-800 p-3">
          {user && (
            <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold">
                {(user.username || user.loginid).charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.username || user.loginid}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user.deptname}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 bg-brand-500 rounded">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900 text-sm">LLM Gateway</span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
