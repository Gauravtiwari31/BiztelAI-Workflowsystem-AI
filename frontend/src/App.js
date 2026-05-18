import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import ReviewPage from './pages/ReviewPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [reviewRecordId, setReviewRecordId] = useState(null);

  const navigate = (target, extra) => {
    if (target === 'review' && extra) setReviewRecordId(extra);
    setPage(target);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar page={page} navigate={navigate} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {page === 'dashboard' && <Dashboard navigate={navigate} />}
        {page === 'upload'    && <UploadPage navigate={navigate} />}
        {page === 'review'    && <ReviewPage recordId={reviewRecordId} navigate={navigate} />}
        {page === 'history'   && <HistoryPage navigate={navigate} />}
        {page === 'settings'  && <SettingsPage />}
      </main>
    </div>
  );
}
