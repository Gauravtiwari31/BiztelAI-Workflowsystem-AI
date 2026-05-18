import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Upload, History, Cpu, Settings, AlertCircle } from 'lucide-react';

const API = 'http://localhost:8000';

const links = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'upload',    label: 'Upload',    icon: Upload },
  { id: 'history',   label: 'History',   icon: History },
];

export default function Navbar({ page, navigate }) {
  const [keyMissing, setKeyMissing] = useState(false);

  useEffect(() => {
    fetch(`${API}/api-key-status`)
      .then(r => r.json())
      .then(d => setKeyMissing(!d.configured))
      .catch(() => {});
  }, [page]); // re-check whenever page changes

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <button onClick={() => navigate('dashboard')} className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
          <Cpu className="w-6 h-6" />
          BiztelAI Workflow
        </button>
        <nav className="flex items-center gap-1">
          {links.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${page === id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}

          {/* Settings — shows red dot if key is missing */}
          <button
            onClick={() => navigate('settings')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${page === 'settings'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Settings className="w-4 h-4" />
            Settings
            {keyMissing && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" title="API key not configured" />
            )}
          </button>
        </nav>
      </div>

      {/* Banner when key is missing */}
      {keyMissing && page !== 'settings' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            Gemini API key is not configured — document processing is disabled.{' '}
            <button onClick={() => navigate('settings')} className="font-semibold underline">
              Go to Settings →
            </button>
          </span>
        </div>
      )}
    </header>
  );
}
