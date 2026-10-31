import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function AddStaffModal({ isOpen, onClose, onStaffAdded }) {
  const { authFetch } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'staff'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const checkPasswordRequirements = (pw) => ({
    length: pw.length > 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw)
  });

  const pwChecks = checkPasswordRequirements(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!pwChecks.length || !pwChecks.hasUpper || !pwChecks.hasLower || !pwChecks.hasSpecial) {
      setError('Password must be >8 characters and include uppercase, lowercase, and special characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch('/users/staff', {
        method: 'POST',
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff member');
      }

      onStaffAdded(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
            <h3 className="font-bold text-base">Add New Staff Member</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="e.g. alex_support"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="alex@brightloop.io"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="staff">Staff (Support & Billing Operations)</option>
              <option value="admin">Administrator (Full System Control)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password *</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="••••••••••••"
            />

            {/* Checklist */}
            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] space-y-1">
              <span className="font-semibold text-slate-600 block">Password Rules:</span>
              <div className="grid grid-cols-2 gap-1">
                <span className={pwChecks.length ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                  {pwChecks.length ? '✓' : '•'} &gt; 8 characters
                </span>
                <span className={pwChecks.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                  {pwChecks.hasUpper ? '✓' : '•'} Uppercase (A-Z)
                </span>
                <span className={pwChecks.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                  {pwChecks.hasLower ? '✓' : '•'} Lowercase (a-z)
                </span>
                <span className={pwChecks.hasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                  {pwChecks.hasSpecial ? '✓' : '•'} Special (!@#$)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

