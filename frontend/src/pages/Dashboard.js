import React, { useEffect, useState } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Upload, AlertTriangle, CheckCircle, Package, Activity, Clock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const API = 'http://localhost:8000';
const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

function Stat({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4">
      <div className={`p-3 rounded-lg ${color}`}><Icon className="w-5 h-5 text-white" /></div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard({ navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/dashboard`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20 text-slate-400">Loading dashboard…</div>;
  if (!data)   return <div className="flex justify-center py-20 text-red-500">Could not reach backend. Is it running?</div>;

  const shiftData = Object.entries(data.shift_summary || {}).map(([k, v]) => ({ name: k, count: v }));
  const machData  = Object.entries(data.machine_summary || {}).slice(0, 8).map(([k, v]) => ({ name: k, count: v }));
  const statusData = Object.entries(data.by_status || {}).map(([k, v]) => ({ name: k, value: v }));
  const dailyData  = Object.entries(data.daily_uploads || {}).sort().slice(-7).map(([k, v]) => ({ date: k.slice(5), count: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Operations Dashboard</h1>
        <button onClick={() => navigate('upload')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
          <Upload className="w-4 h-4" /> Upload Document
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Upload}        label="Total Uploads"      value={data.total_uploads}          color="bg-indigo-500" />
        <Stat icon={CheckCircle}   label="Reviewed"           value={data.by_status?.reviewed || 0} color="bg-green-500" />
        <Stat icon={AlertTriangle} label="Validation Errors"  value={data.validation_errors}      color="bg-red-500"
              sub={`+ ${data.validation_warnings} warnings`} />
        <Stat icon={Package}       label="Total Qty Produced" value={data.total_quantity.toFixed(0)} color="bg-amber-500" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shift summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Records by Shift</h2>
          {shiftData.length === 0 ? <p className="text-slate-400 text-sm">No data yet</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={shiftData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {shiftData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Status Breakdown</h2>
          {statusData.length === 0 ? <p className="text-slate-400 text-sm">No data yet</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily uploads */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Uploads (Last 7 Days)</h2>
          {dailyData.length === 0 ? <p className="text-slate-400 text-sm">No data yet</p> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Machine summary */}
      {machData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Machine-wise Records</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={machData} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#22c55e" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quantity by shift */}
      {Object.keys(data.quantity_by_shift || {}).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Quantity Produced by Shift</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={Object.entries(data.quantity_by_shift).map(([k,v]) => ({ shift: k, qty: Math.round(v) }))}>
              <XAxis dataKey="shift" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent uploads */}
      {data.recent_uploads?.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Recent Uploads</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2 font-medium">File</th>
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent_uploads.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2.5 text-slate-700">{r.filename}</td>
                  <td className="py-2.5 text-slate-500">{new Date(r.upload_time).toLocaleString()}</td>
                  <td className="py-2.5"><StatusBadge status={r.status} /></td>
                  <td className="py-2.5">
                    <button onClick={() => navigate('review', r.id)}
                      className="text-indigo-600 hover:underline text-xs">Review →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
