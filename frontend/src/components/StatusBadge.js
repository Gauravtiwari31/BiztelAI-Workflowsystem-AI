import React from 'react';

const map = {
  ok:         { cls: 'bg-green-100 text-green-700',  label: 'OK' },
  reviewed:   { cls: 'bg-blue-100 text-blue-700',    label: 'Reviewed' },
  warning:    { cls: 'bg-yellow-100 text-yellow-700',label: 'Warning' },
  error:      { cls: 'bg-red-100 text-red-700',      label: 'Error' },
  processing: { cls: 'bg-purple-100 text-purple-700',label: 'Processing' },
  failed:     { cls: 'bg-gray-100 text-gray-700',    label: 'Failed' },
  pending:    { cls: 'bg-gray-100 text-gray-500',    label: 'Pending' },
};

export default function StatusBadge({ status }) {
  const { cls, label } = map[status] || { cls: 'bg-gray-100 text-gray-500', label: status };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}
