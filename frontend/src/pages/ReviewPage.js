import React, { useEffect, useState } from 'react';
import { Save, ArrowLeft, AlertTriangle, XCircle, CheckCircle, Loader } from 'lucide-react';
import ConfidenceBadge from '../components/ConfidenceBadge';
import StatusBadge from '../components/StatusBadge';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const FIELDS = [
  { key: 'date',             label: 'Date',           type: 'date'   },
  { key: 'shift',            label: 'Shift',          type: 'select', options: ['Morning','Day','Evening','Night','A','B','C'] },
  { key: 'employee_number',  label: 'Employee #',     type: 'text'   },
  { key: 'operation_code',   label: 'Operation Code', type: 'text'   },
  { key: 'machine_number',   label: 'Machine #',      type: 'text'   },
  { key: 'work_order_number',label: 'Work Order #',   type: 'text'   },
  { key: 'quantity_produced',label: 'Qty Produced',   type: 'number' },
  { key: 'time_taken',       label: 'Time Taken',     type: 'text'   },
];

function IssueTag({ issue }) {
  const cls = issue.severity === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-yellow-50 border-yellow-200 text-yellow-700';
  const Icon = issue.severity === 'error' ? XCircle : AlertTriangle;
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${cls}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{issue.message}</span>
    </div>
  );
}

export default function ReviewPage({ recordId, navigate }) {
  const [record, setRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    if (!recordId) { setLoading(false); return; }
    fetch(`${API}/record/${recordId}`)
      .then(r => r.json())
      .then(d => {
        setRecord(d);
        const src = d.reviewed_data || d.raw_extracted || {};
        const init = {};
        FIELDS.forEach(({ key }) => {
          const fv = src[key];
          init[key] = { value: fv?.value ?? '', confidence: fv?.confidence ?? null, flagged: fv?.flagged ?? false };
        });
        setFormData(init);
        setIssues(d.validation_issues || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [recordId]);

  const setValue = (key, val) => {
    setFormData(prev => ({ ...prev, [key]: { ...prev[key], value: val } }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    const r = await fetch(`${API}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record_id: recordId, reviewed_data: formData }),
    });
    const data = await r.json();
    setIssues(data.validation_issues || []);
    setSaving(false);
    setSaved(true);
    // refresh record status
    fetch(`${API}/record/${recordId}`).then(r => r.json()).then(setRecord);
  };

  if (loading) return <div className="flex justify-center py-20 text-slate-400"><Loader className="w-6 h-6 animate-spin" /></div>;

  if (!recordId || !record) return (
    <div className="max-w-xl mx-auto text-center py-20 space-y-4">
      <p className="text-slate-500">No record selected. Upload a document first.</p>
      <button onClick={() => navigate('upload')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Go to Upload</button>
    </div>
  );

  const errCount  = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('history')} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-bold text-slate-800 flex-1">Review Record</h1>
        <StatusBadge status={record.status} />
      </div>

      {/* Meta */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-6 text-sm">
        <div><span className="text-slate-500">File:</span> <span className="font-medium">{record.filename}</span></div>
        <div><span className="text-slate-500">Uploaded:</span> <span className="font-medium">{new Date(record.upload_time).toLocaleString()}</span></div>
        {record.review_time && <div><span className="text-slate-500">Reviewed:</span> <span className="font-medium">{new Date(record.review_time).toLocaleString()}</span></div>}
      </div>

      {/* Validation summary */}
      {issues.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Validation: {errCount > 0 && <span className="text-red-600">{errCount} error{errCount > 1 ? 's' : ''}</span>}
            {errCount > 0 && warnCount > 0 && ', '}
            {warnCount > 0 && <span className="text-yellow-600">{warnCount} warning{warnCount > 1 ? 's' : ''}</span>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {issues.map((issue, i) => <IssueTag key={i} issue={issue} />)}
          </div>
        </div>
      )}

      {/* Editable fields */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Extracted Fields — Edit & Correct</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, type, options }) => {
            const fv = formData[key] || {};
            const fieldIssues = issues.filter(i => i.field === key);
            const hasErr  = fieldIssues.some(i => i.severity === 'error');
            const hasWarn = fieldIssues.some(i => i.severity === 'warning');
            const borderCls = hasErr ? 'border-red-300 ring-red-100' : hasWarn ? 'border-yellow-300 ring-yellow-100' : 'border-slate-200';
            return (
              <div key={key} className={`p-3 rounded-lg border ${hasErr ? 'bg-red-50' : hasWarn ? 'bg-yellow-50' : 'bg-slate-50'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">{label}</label>
                  <div className="flex items-center gap-1">
                    {fv.flagged && <span className="text-xs text-red-500">⚠ flagged</span>}
                    <ConfidenceBadge confidence={fv.confidence} />
                  </div>
                </div>
                {type === 'select' ? (
                  <select
                    value={fv.value || ''}
                    onChange={e => setValue(key, e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border bg-white text-sm text-slate-800 outline-none focus:ring-2 ${borderCls}`}
                  >
                    <option value="">— select —</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                    value={fv.value ?? ''}
                    onChange={e => setValue(key, e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg border bg-white text-sm text-slate-800 outline-none focus:ring-2 ${borderCls}`}
                    placeholder={label}
                  />
                )}
                {fieldIssues.map((iss, i) => (
                  <p key={i} className={`text-xs mt-1 ${iss.severity === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>
                    {iss.message}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Raw text */}
      {(record.raw_extracted?.raw_text || record.reviewed_data?.raw_text) && (
        <details className="bg-white rounded-xl border border-slate-200 p-5">
          <summary className="text-sm font-semibold text-slate-700 cursor-pointer">Raw Extracted Text</summary>
          <pre className="mt-3 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            {record.raw_extracted?.raw_text || record.reviewed_data?.raw_text}
          </pre>
        </details>
      )}

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-300 font-medium transition-colors"
      >
        {saving ? <><Loader className="w-5 h-5 animate-spin" /> Saving…</>
                : saved ? <><CheckCircle className="w-5 h-5" /> Saved!</>
                        : <><Save className="w-5 h-5" /> Save Review</>}
      </button>
    </div>
  );
}
