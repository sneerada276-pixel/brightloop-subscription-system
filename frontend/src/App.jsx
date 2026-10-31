import React, { useState, useEffect } from 'react';

function App() {
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkBackendHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/health');
      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }
      const data = await response.json();
      setHealthStatus(data);
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server');
      setHealthStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
  }, []);

  const modules = [
    { id: 1, name: "User Auth & Roles", desc: "Admin, Staff & Customer role-based access" },
    { id: 2, name: "Product & Variants", desc: "Product catalog, sales/cost price & SKUs" },
    { id: 3, name: "Subscription Plans", desc: "Daily, Weekly, Monthly & Yearly billing" },
    { id: 4, name: "Quotations & Templates", desc: "Estimates and terms before subscribing" },
    { id: 5, name: "Subscription Lifecycle", desc: "Draft, Active, Paused, Renewed & Closed" },
    { id: 6, name: "Automated Invoicing", desc: "Configurable taxes & invoice state machine" },
    { id: 7, name: "Discounts & Promo", desc: "Fixed/percentage codes, limits & expiry" },
    { id: 8, name: "Payment Tracking", desc: "Multi-method audit log & receipts" },
    { id: 9, name: "Business Dashboard", desc: "Active count, revenue, overdue & MRR" },
    { id: 10, name: "Customer Portal", desc: "Customer profiles & password reset" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-indigo-200">
              BL
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                BrightLoop
              </span>
              <span className="text-xs font-medium text-slate-500 block">Subscription Management System</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-800">
              Odoo Make-A-Ton 9.0
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Welcome Hero */}
        <section className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 rounded-2xl p-8 sm:p-10 text-white shadow-xl shadow-indigo-100">
          <div className="max-w-3xl space-y-4">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-white/20 backdrop-blur rounded-full">
              Hour 1: Project Setup Complete
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Subscription Management Platform
            </h1>
            <p className="text-indigo-100 text-base sm:text-lg leading-relaxed">
              Full-stack architecture running React + Tailwind CSS on the frontend, Python Flask on the backend, and SQLite for data persistence.
            </p>
          </div>
        </section>

        {/* System Health Check Card */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Backend Communication Status</h2>
              <p className="text-sm text-slate-500">Live communication test between React frontend and Flask API</p>
            </div>
            <button
              onClick={checkBackendHealth}
              disabled={loading}
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Checking...' : 'Refresh Status'}
            </button>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-lg text-slate-600">
                <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
                <span className="text-sm font-medium">Connecting to Flask server on http://localhost:5000/api/health...</span>
              </div>
            ) : healthStatus ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div className="text-sm">
                    <span className="font-bold">Backend Online & Healthy: </span>
                    {healthStatus.service} ({healthStatus.version}) - {healthStatus.database}
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Available API Endpoints:</span>
                  <div className="flex flex-wrap gap-2">
                    {healthStatus.endpoints?.map((ep, idx) => (
                      <span key={idx} className="font-mono text-xs px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700">
                        {ep}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm">Notice: Backend is not currently running.</span>
                </div>
                <p className="text-xs text-amber-700">
                  To start the Flask backend, open a terminal in the <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">backend/</code> folder and run:
                  <code className="block font-mono bg-white border border-amber-200 p-2 mt-1 rounded text-slate-800">python app.py</code>
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 10 Architectural Modules Grid */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Project Architecture & Modules</h2>
            <p className="text-sm text-slate-500">
              The underlying database models and API blueprints are structured to accommodate all 10 problem statement modules:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {modules.map((m) => (
              <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all">
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mb-2">
                  Module {m.id}
                </span>
                <h3 className="font-semibold text-slate-900 text-sm">{m.name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
