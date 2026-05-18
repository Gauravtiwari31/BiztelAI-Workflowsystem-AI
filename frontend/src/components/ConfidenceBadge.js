import React from 'react';

export default function ConfidenceBadge({ confidence }) {
  if (confidence === undefined || confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const cls = pct >= 75 ? 'bg-green-100 text-green-700'
            : pct >= 50 ? 'bg-yellow-100 text-yellow-700'
            :              'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {pct}%
    </span>
  );
}
