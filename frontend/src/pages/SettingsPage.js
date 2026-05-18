import React, { useState, useEffect, useCallback } from 'react';
import {
  Key, CheckCircle, XCircle, Loader, Eye, EyeOff,
  ExternalLink, Zap, Info, RefreshCw, ChevronDown,
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function SettingsPage() {
  const [status,    setStatus]    = useState(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey,   setShowKey]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [feedback,  setFeedback]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  // Model list
  const [models,       setModels]       = useState([]);
  const [selectedModel,setSelectedModel]= useState('');
  const [loadingModels,setLoadingModels]= useState(false);
  const [modelError,   setModelError]   = useState('');

  const fetchStatus = useCallback(() =>
    fetch(`${API}/api-key-status`)
      .then(r => r.json())
      .then(d => { setStatus(d); setLoading(false); })
      .catch(() => setLoading(false)),
  []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Load model list whenever key changes (debounced) or on mount if key exists
  const fetchModels = useCallback(async (keyOverride) => {
    const key = (keyOverride ?? geminiKey).trim();
    if (!key) { setModels([]); setModelError(''); return; }

    // First ensure the key is persisted so backend can use it
    if (key) {
      await fetch(`${API}/set-api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_key: key, model_name: '' }),
      }).catch(() => {});
    }

    setLoadingModels(true);
    setModelError('');
    try {
      const r    = await fetch(`${API}/list-models`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed to load models');
      setModels(data.models || []);
      // Auto-select current active model or first in list
      const currentModel = status?.active_model || os_getenv_model();
      const match = (data.models || []).find(m => m.name === currentModel);
      if (match) setSelectedModel(match.name);
      else if (data.models?.length) setSelectedModel(data.models[0].name);
    } catch (e) {
      setModelError(e.message);
    } finally {
      setLoadingModels(false);
    }
  }, [geminiKey, status]);

  // helper shim (no window.ENV in CRA)
  function os_getenv_model() { return ''; }

  // When status loads and there's an active model, pre-select it
  useEffect(() => {
    if (status?.active_model) setSelectedModel(status.active_model);
  }, [status]);

  const save = async () => {
    if (!selectedModel) { setFeedback({ ok: false, msg: 'Please select a Gemini model.' }); return; }
    setSaving(true); setFeedback(null);
    try {
      const r = await fetch(`${API}/set-api-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_key:  geminiKey.trim(),
          model_name:  selectedModel,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed to save');
      setFeedback({ ok: true, msg: data.message || 'Settings saved.' });
      setGeminiKey('');
      fetchStatus();
    } catch (e) {
      setFeedback({ ok: false, msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const canSave = (geminiKey.trim() || status?.gemini_key) && selectedModel && !saving;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Settings — Gemini AI</h1>

      {/* Status */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Current Status</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader className="w-4 h-4 animate-spin" /> Checking…
          </div>
        ) : status?.configured ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle className="w-5 h-5" />
              <span>Gemini ready</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold">
                <Zap className="w-3 h-3" />
                {status.active_model?.replace('models/', '') || 'Gemini'}
              </span>
            </div>
            {status.gemini_key && (
              <p className="text-xs text-slate-400">
                Key: <code className="bg-slate-100 px-1 rounded">{status.gemini_key}</code>
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <XCircle className="w-5 h-5" />
            <span>Not configured — enter your key below</span>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-sm text-blue-800">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">How this works</p>
          <p>
            Paste your Gemini API key, click <strong>Load Models</strong> to fetch the models
            available on your key, pick the one you want, then click <strong>Save</strong>.
            The key and model are written to <code className="bg-blue-100 px-1 rounded">backend/.env</code> immediately —
            no restart needed.
          </p>
        </div>
      </div>

      {/* Key + model inputs */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-700">Gemini API Key</h2>

        {/* Key input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              API Key{' '}
              {status?.gemini_key && (
                <span className="text-slate-400 font-normal text-xs">
                  (current: <code>{status.gemini_key}</code>)
                </span>
              )}
            </label>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank" rel="noreferrer"
              className="text-xs text-indigo-600 underline flex items-center gap-0.5"
            >
              Get free key <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={e => { setGeminiKey(e.target.value); setFeedback(null); setModels([]); setSelectedModel(''); }}
                placeholder={status?.gemini_key ? 'Enter new key to change…' : 'AIzaSy…'}
                className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={() => fetchModels()}
              disabled={loadingModels || (!geminiKey.trim() && !status?.gemini_key)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200
                text-slate-700 rounded-lg text-sm font-medium transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loadingModels
                ? <Loader className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              Load Models
            </button>
          </div>
          {modelError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {modelError}
            </p>
          )}
        </div>

        {/* Model selector — shown once models are loaded */}
        {models.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <Zap className="w-4 h-4 text-indigo-500" />
              Select Model
              <span className="ml-auto text-xs text-slate-400 font-normal">
                {models.length} model{models.length !== 1 ? 's' : ''} available
              </span>
            </label>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-8 border border-slate-200 rounded-lg
                  text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-mono"
              >
                <option value="">— choose a model —</option>
                {models.map(m => (
                  <option key={m.name} value={m.name}>
                    {m.display_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {selectedModel && (
              <p className="text-xs text-slate-400">
                Selected: <code className="bg-slate-100 px-1 rounded">{selectedModel.replace('models/', '')}</code>
              </p>
            )}
          </div>
        )}

        {/* Pre-fill model from status even without loading */}
        {models.length === 0 && status?.active_model && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <Zap className="w-4 h-4 text-indigo-500" /> Current Model
            </label>
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-600">
              {status.active_model.replace('models/', '')}
            </div>
            <p className="text-xs text-slate-400">
              Click <strong>Load Models</strong> to change the model.
            </p>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
            feedback.ok
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'}`}>
            {feedback.ok
              ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <XCircle    className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {feedback.msg}
          </div>
        )}

        <button
          onClick={save}
          disabled={!canSave}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white
            rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed
            font-medium text-sm transition-colors"
        >
          {saving
            ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Key className="w-4 h-4" /> Save Settings</>}
        </button>
      </div>

      {/* Quick tip */}
      <div className="text-xs text-slate-400 text-center">
        Tip: if you hit a quota error, click <strong>Load Models</strong> and switch to a different model
        (e.g. <code>gemini-2.5-flash</code>) that has available quota on your key.
      </div>
    </div>
  );
}
