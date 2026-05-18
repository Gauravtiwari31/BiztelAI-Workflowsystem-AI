import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, Loader, CheckCircle, AlertTriangle, XCircle, AlertCircle, ChevronRight } from 'lucide-react';
import ConfidenceBadge from '../components/ConfidenceBadge';
import StatusBadge from '../components/StatusBadge';

const API = 'http://localhost:8000';

const FIELD_LABELS = {
  date: 'Date', shift: 'Shift', employee_number: 'Employee #',
  operation_code: 'Operation Code', machine_number: 'Machine #',
  work_order_number: 'Work Order #', quantity_produced: 'Qty Produced',
  time_taken: 'Time Taken',
};

function IssueTag({ issue }) {
  const cls = issue.severity === 'error'
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-yellow-50 border-yellow-200 text-yellow-700';
  const Icon = issue.severity === 'error' ? XCircle : AlertTriangle;
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${cls}`}>
      <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span><strong>{FIELD_LABELS[issue.field] || issue.field}:</strong> {issue.message}</span>
    </div>
  );
}

function RowCard({ rec, index, navigate }) {
  const hasErr  = rec.validation_issues?.some(i => i.severity === 'error');
  const hasWarn = rec.validation_issues?.some(i => i.severity === 'warning');
  const borderCls = hasErr ? 'border-red-300 bg-red-50' : hasWarn ? 'border-yellow-300 bg-yellow-50' : 'border-green-200 bg-green-50';

  return (
    <div className={`rounded-xl border ${borderCls} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Row {index + 1}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={rec.status} />
          <button
            onClick={() => navigate('review', rec.record_id)}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700"
          >
            Review <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Field grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(FIELD_LABELS).map(([key, label]) => {
          const fv = rec.extracted?.[key];
          const val = fv?.value ?? '—';
          const conf = fv?.confidence;
          const flagged = fv?.flagged;
          return (
            <div key={key} className={`p-2 rounded-lg border ${flagged ? 'border-red-200 bg-red-50' : 'border-white bg-white'}`}>
              <p className="text-xs text-slate-400 mb-0.5">{label}</p>
              <div className="flex items-center gap-1 flex-wrap">
                <p className="text-xs font-semibold text-slate-800 flex-1 truncate">{String(val)}</p>
                <ConfidenceBadge confidence={conf} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Issues */}
      {rec.validation_issues?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {rec.validation_issues.map((iss, i) => <IssueTag key={i} issue={iss} />)}
        </div>
      )}
    </div>
  );
}

export default function UploadPage({ navigate }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const ALLOWED = ['application/pdf','image/png','image/jpeg','image/jpg','image/tiff','image/bmp','image/webp'];

  const handleFile = f => {
    if (!f) return;
    if (!ALLOWED.includes(f.type) && !f.name.match(/\.(pdf|png|jpg|jpeg|tiff|bmp|webp)$/i)) {
      setError('Unsupported file type. Upload a PDF or image.');
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const onDrop = e => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const process = async () => {
    if (!file) return;
    setProcessing(true); setError(null); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch(`${API}/process-document`, { method: 'POST', body: fd });
      const data = await r.json();
      setResult(data);
    } catch (e) {
      setError('Failed to reach backend: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const totalErrors   = result?.records?.reduce((n, r) => n + (r.validation_issues?.filter(i => i.severity === 'error').length || 0), 0) || 0;
  const totalWarnings = result?.records?.reduce((n, r) => n + (r.validation_issues?.filter(i => i.severity === 'warning').length || 0), 0) || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Upload Document</h1>
      <p className="text-slate-500 text-sm">Upload handwritten or semi-structured operational documents. Multiple rows in a table will each be extracted as separate records.</p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'}`}
      >
        <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp"
          onChange={e => handleFile(e.target.files[0])} className="hidden" />
        <div className="flex flex-col items-center gap-3">
          {file ? (
            <>
              {file.type === 'application/pdf'
                ? <FileText className="w-14 h-14 text-indigo-400" />
                : <Image    className="w-14 h-14 text-indigo-400" />}
              <p className="font-semibold text-slate-700">{file.name}</p>
              <p className="text-slate-400 text-sm">{(file.size / 1024).toFixed(1)} KB — click to change</p>
            </>
          ) : (
            <>
              <Upload className="w-14 h-14 text-slate-300" />
              <p className="text-lg font-medium text-slate-600">Drop your file here or click to browse</p>
              <p className="text-slate-400 text-sm">PDF, PNG, JPG, TIFF, BMP, WEBP supported</p>
            </>
          )}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-600 mb-2">Preview</p>
          <img src={preview} alt="preview" className="max-h-64 mx-auto rounded-lg object-contain" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Process button */}
      <button
        onClick={process}
        disabled={!file || processing}
        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl
          hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-medium transition-colors"
      >
        {processing
          ? <><Loader className="w-5 h-5 animate-spin" /> Extracting all rows with Gemini AI…</>
          : <><Upload className="w-5 h-5" /> Process Document</>}
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            !result.success ? 'bg-red-50 border-red-200'
            : totalErrors > 0 ? 'bg-yellow-50 border-yellow-200'
            : 'bg-green-50 border-green-200'}`}>
            {!result.success
              ? <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              : totalErrors > 0
                ? <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                : <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />}
            <div className="flex-1">
              <p className="font-semibold text-slate-800">
                {!result.success
                  ? 'Extraction failed'
                  : `${result.total_rows} row${result.total_rows !== 1 ? 's' : ''} extracted from ${result.filename}`}
              </p>
              {result.success && (totalErrors > 0 || totalWarnings > 0) && (
                <p className="text-sm text-slate-500">
                  {totalErrors > 0 && <span className="text-red-600">{totalErrors} error{totalErrors !== 1 ? 's' : ''}</span>}
                  {totalErrors > 0 && totalWarnings > 0 && ', '}
                  {totalWarnings > 0 && <span className="text-yellow-600">{totalWarnings} warning{totalWarnings !== 1 ? 's' : ''}</span>}
                  {' '}— review each row below
                </p>
              )}
              {result.error && <p className="text-sm text-slate-500">{result.error}</p>}
            </div>
          </div>

          {/* Per-row cards */}
          {result.records?.map((rec, idx) => (
            <RowCard key={rec.record_id} rec={rec} index={idx} navigate={navigate} />
          ))}

          {/* Raw extracted text */}
          {result.records?.[0]?.extracted?.raw_text && (
            <details className="bg-white rounded-xl border border-slate-200 p-5">
              <summary className="text-sm font-semibold text-slate-700 cursor-pointer">Raw Extracted Text</summary>
              <pre className="mt-3 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {result.records[0].extracted.raw_text}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
