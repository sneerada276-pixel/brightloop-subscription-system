import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onSuccess }) {
  const { login, registerCustomer, requestPasswordReset, resetPassword, loading } = useAuth();

  const [activeTab, setActiveTab] = useState('login'); // 'login', 'register', 'reset'
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Login form state
  const [loginForm, setLoginForm] = useState({
    identifier: 'admin@brightloop.io',
    password: 'Admin@BrightLoop2026!'
  });

  // Customer registration form state
  const [regForm, setRegForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    address: ''
  });

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedTokenInfo, setGeneratedTokenInfo] = useState(null);

  // Password complexity live check helper
  const checkPasswordRequirements = (pw) => ({
    length: pw.length > 8,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw)
  });

  const regPwChecks = checkPasswordRequirements(regForm.password);
  const resetPwChecks = checkPasswordRequirements(newPassword);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      await login(loginForm.identifier, loginForm.password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const checks = checkPasswordRequirements(regForm.password);
    if (!checks.length || !checks.hasUpper || !checks.hasLower || !checks.hasSpecial) {
      setError('Please satisfy all password complexity requirements before submitting.');
      return;
    }

    try {
      await registerCustomer(regForm);
      setSuccessMessage('Registration successful! You are now logged in as a customer.');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRequestResetToken = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await requestPasswordReset(resetEmail);
      setGeneratedTokenInfo(res);
      setResetToken(res.reset_token);
      setSuccessMessage('Reset token generated. Since external SMTP email is not configured, your token is provided below.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const checks = checkPasswordRequirements(newPassword);
    if (!checks.length || !checks.hasUpper || !checks.hasLower || !checks.hasSpecial) {
      setError('Please satisfy all password complexity requirements for the new password.');
      return;
    }

    try {
      const res = await resetPassword(resetToken, newPassword);
      setSuccessMessage(res.message);
      setActiveTab('login');
      setLoginForm((prev) => ({ ...prev, password: newPassword }));
    } catch (err) {
      setError(err.message);
    }
  };

  const fillQuickDemo = (type) => {
    setError(null);
    if (type === 'admin') {
      setLoginForm({
        identifier: 'admin@brightloop.io',
        password: 'Admin@BrightLoop2026!'
      });
    } else if (type === 'staff') {
      setLoginForm({
        identifier: 'staff@brightloop.io',
        password: 'StaffPassword2026!'
      });
    }
  };

  return (
    <div className="max-w-md w-full mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-6 text-white text-center">
        <h2 className="text-2xl font-bold tracking-tight">BrightLoop Identity</h2>
        <p className="text-indigo-100 text-xs mt-1">Role-Based Access & Customer Portal</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-semibold">
        <button
          onClick={() => { setActiveTab('login'); setError(null); }}
          className={`flex-1 py-3 text-center transition-colors ${activeTab === 'login' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setActiveTab('register'); setError(null); }}
          className={`flex-1 py-3 text-center transition-colors ${activeTab === 'register' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Register Customer
        </button>
        <button
          onClick={() => { setActiveTab('reset'); setError(null); }}
          className={`flex-1 py-3 text-center transition-colors ${activeTab === 'reset' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Reset Password
        </button>
      </div>

      {/* Form Content Area */}
      <div className="p-6">
        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium flex items-start space-x-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium flex items-start space-x-2">
            <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. LOGIN TAB */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email or Username</label>
              <input
                type="text"
                required
                value={loginForm.identifier}
                onChange={(e) => setLoginForm({ ...loginForm, identifier: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="e.g. admin@brightloop.io"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>

            {/* Quick Demo Pre-fill Pill for Hackathon Judges */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 text-center">
                Demo Quick-Fill
              </span>
              <div className="flex justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => fillQuickDemo('admin')}
                  className="px-2.5 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors font-medium"
                >
                  Admin Demo
                </button>
              </div>
            </div>
          </form>
        )}

        {/* 2. CUSTOMER REGISTRATION TAB */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Jane Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={regForm.username}
                  onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="janedoe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="jane@company.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="+1 555-0100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                <input
                  type="text"
                  value={regForm.company}
                  onChange={(e) => setRegForm({ ...regForm, company: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Acme Inc."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={regForm.address}
                onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="123 Tech Parkway, Suite 100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
              <input
                type="password"
                required
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••••••"
              />
              {/* Password complexity checklist */}
              <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-md text-[11px] space-y-1">
                <span className="font-semibold text-slate-600 block">Password Requirements:</span>
                <div className="grid grid-cols-2 gap-1">
                  <div className={`flex items-center space-x-1 ${regPwChecks.length ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                    <span>{regPwChecks.length ? '✓' : '•'}</span>
                    <span>&gt; 8 characters</span>
                  </div>
                  <div className={`flex items-center space-x-1 ${regPwChecks.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                    <span>{regPwChecks.hasUpper ? '✓' : '•'}</span>
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center space-x-1 ${regPwChecks.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                    <span>{regPwChecks.hasLower ? '✓' : '•'}</span>
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center space-x-1 ${regPwChecks.hasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
                    <span>{regPwChecks.hasSpecial ? '✓' : '•'}</span>
                    <span>Special (!@#$)</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 mt-3"
            >
              {loading ? 'Creating Account...' : 'Complete Customer Registration'}
            </button>
          </form>
        )}

        {/* 3. RESET PASSWORD TAB */}
        {activeTab === 'reset' && (
          <div className="space-y-4">
            {/* Step 1: Request Token */}
            <form onSubmit={handleRequestResetToken} className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Step 1: Request Reset Token</label>
              <div className="flex space-x-2">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shrink-0"
                >
                  Get Token
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Note: External SMTP is not configured. The token is generated and displayed on screen for testing.
              </p>
            </form>

            {/* Generated Token Box */}
            {generatedTokenInfo && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                <div className="font-bold text-amber-900">Generated Token (Demo):</div>
                <div className="font-mono text-[11px] bg-white p-1.5 rounded border border-amber-300 break-all select-all text-slate-800">
                  {generatedTokenInfo.reset_token}
                </div>
              </div>
            )}

            {/* Step 2: Set New Password */}
            <form onSubmit={handleResetSubmit} className="space-y-3 pt-3 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700">Step 2: Enter Token & New Password</label>
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste Reset Token"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />

              {/* Reset Password complexity checklist */}
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-md text-[11px] space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <span className={resetPwChecks.length ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                    {resetPwChecks.length ? '✓' : '•'} &gt; 8 characters
                  </span>
                  <span className={resetPwChecks.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                    {resetPwChecks.hasUpper ? '✓' : '•'} Uppercase (A-Z)
                  </span>
                  <span className={resetPwChecks.hasLower ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                    {resetPwChecks.hasLower ? '✓' : '•'} Lowercase (a-z)
                  </span>
                  <span className={resetPwChecks.hasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                    {resetPwChecks.hasSpecial ? '✓' : '•'} Special (!@#$)
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm"
              >
                Reset Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

