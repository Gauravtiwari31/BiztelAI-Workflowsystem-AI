import React, { useEffect, useState, useCallback  } from 'react';
import { Search, Filter, RefreshCw, Loader } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const STATUS_OPTS = ['', 'ok', 'reviewed', 'warning', 'error', 'failed', 'processing'];

export default function HistoryPage({ navigate }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`${API}/history?${params}`)
      .then(r => r.json())
      .then(d => { setRecords(d); setLoading(false); })
      .catch(() => setLoading(false));
}, [search, status, page]); {
  };

useEffect(() => {
  load();
}, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Upload History</h1>
        <button onClick={load} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search by filename…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); }}
            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 appearance-none"
          >
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
        </div>
        <button onClick={load}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
          Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12 text-slate-400">
            <Loader className="w-6 h-6 animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No records found.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Row</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Reviewed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700 max-w-xs truncate">{r.filename}</td>
                  <td className="px-4 py-3 text-slate-500 text-center">#{(r.row_index ?? 0) + 1}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs uppercase">{r.file_type}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.upload_time).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.review_time ? new Date(r.review_time).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate('review', r.id)}
                      className="text-indigo-600 hover:underline text-xs font-medium"
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-400">{records.length} record{records.length !== 1 ? 's' : ''} shown</p>
    </div>
  );
}
