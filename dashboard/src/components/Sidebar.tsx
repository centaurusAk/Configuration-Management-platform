'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', roles: ['Admin', 'Editor', 'Viewer'] },
    { href: '/dashboard/configs', label: 'Configurations', roles: ['Admin', 'Editor', 'Viewer'] },
    { href: '/dashboard/rules', label: 'Rules', roles: ['Admin', 'Editor', 'Viewer'] },
    { href: '/dashboard/audit', label: 'Audit Logs', roles: ['Admin', 'Editor', 'Viewer'] },
    { href: '/dashboard/api-keys', label: 'API Keys', roles: ['Admin'] },
    { href: '/dashboard/projects', label: 'Projects', roles: ['Admin'] },
  ];

  const visibleItems = navItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  return (
    <div style={{
      width: '250px',
      backgroundColor: '#1e293b',
      color: 'white',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #334155' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Config Manager</h2>
      </div>

      <nav style={{ flex: 1, padding: '1rem' }}>
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '0.75rem 1rem',
              marginBottom: '0.5rem',
              borderRadius: '4px',
              textDecoration: 'none',
              color: 'white',
              backgroundColor: pathname === item.href ? '#334155' : 'transparent',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ padding: '1rem', borderTop: '1px solid #334155' }}>
        <div style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
          <div style={{ fontWeight: 500 }}>{user?.email}</div>
          <div style={{ color: '#94a3b8' }}>{user?.organizationName}</div>
          <div style={{ color: '#94a3b8' }}>Role: {user?.role}</div>
        </div>
        <button
          onClick={logout}
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
