import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import NavbarUserMenu from './components/auth/NavbarUserMenu';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import CustomersPage from './pages/CustomersPage';
import ProductsPage from './pages/ProductsPage';
import PlansPage from './pages/PlansPage';
import SubscriptionsPage from './pages/SubscriptionsPage';
import QuotationsPage from './pages/QuotationsPage';
import InvoicesPage from './pages/InvoicesPage';
import PaymentsPage from './pages/PaymentsPage';
import DashboardStatsPage from './pages/DashboardStatsPage';

function AppContent() {
  const { user, isAuthenticated, isAdmin, isStaff } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'customers', 'users', 'products', 'subscriptions', 'invoices'
  const [productSubTab, setProductSubTab] = useState('products'); // 'products', 'plans'
  const [subscriptionSubTab, setSubscriptionSubTab] = useState('subscriptions'); // 'subscriptions', 'quotations'
  const [invoiceSubTab, setInvoiceSubTab] = useState('invoices'); // 'invoices', 'payments', 'stats'
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
    { id: 1, name: "User Auth & Roles", desc: "Admin, Staff & Customer role-based access", ready: true },
    { id: 2, name: "Product & Variants", desc: "Product catalog, sales/cost price & SKUs", ready: true },
    { id: 3, name: "Subscription Plans", desc: "Daily, Weekly, Monthly & Yearly billing", ready: true },
    { id: 4, name: "Quotations & Templates", desc: "Estimates and terms before subscribing", ready: true },
    { id: 5, name: "Subscription Lifecycle", desc: "Draft, Active, Paused, Renewed & Closed", ready: true },
    { id: 6, name: "Automated Invoicing", desc: "Configurable taxes & invoice state machine", ready: true },
    { id: 7, name: "Discounts & Promo", desc: "Fixed/percentage codes, limits & expiry", ready: true },
    { id: 8, name: "Payment Tracking", desc: "Multi-method audit log & receipts", ready: true },
    { id: 9, name: "Business Dashboard", desc: "Active count, revenue, overdue & MRR", ready: true },
    { id: 10, name: "Customer Portal", desc: "Customer profiles & password reset", ready: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-indigo-200">
              BL
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                BrightLoop
              </span>
              <span className="text-[11px] font-medium text-slate-400 block -mt-1">Subscription Management</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'overview'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              System Overview
            </button>

            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'customers'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Customers
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  activeTab === 'users'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                User Management
              </button>
            )}

            <button
              onClick={() => setActiveTab('products')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'products'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Products & Plans
            </button>

            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'subscriptions'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Subscriptions
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'invoices'
                  ? 'bg-indigo-50 text-indigo-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Invoices & Billing
            </button>
          </nav>

          {/* User Menu & Actions */}
          <div className="flex items-center space-x-3">
            <span className="hidden lg:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
              Odoo Make-A-Ton 9.0
            </span>
            <NavbarUserMenu onOpenAuthModal={() => setIsAuthModalOpen(true)} />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* TAB 1: SYSTEM OVERVIEW & ARCHITECTURE */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Welcome Hero */}
            <section className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-600 rounded-2xl p-8 sm:p-10 text-white shadow-xl shadow-indigo-100">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-white/20 backdrop-blur rounded-full">
                    Module 1 Integrated
                  </span>
                  <span className="inline-block px-3 py-1 text-xs font-semibold bg-emerald-400/20 text-emerald-100 border border-emerald-400/30 backdrop-blur rounded-full">
                    Auth & Customers Live
                  </span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Subscription Management Platform
                </h1>
                <p className="text-indigo-100 text-base sm:text-lg leading-relaxed">
                  Full-stack architecture running React + Tailwind CSS on the frontend, Python Flask on the backend, and SQLite for data persistence.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('customers')}
                    className="px-4 py-2 bg-white text-indigo-600 font-bold text-xs rounded-lg shadow-sm hover:bg-indigo-50 transition-colors"
                  >
                    Open Customer Directory →
                  </button>
                  {!isAuthenticated && (
                    <button
                      onClick={() => setIsAuthModalOpen(true)}
                      className="px-4 py-2 bg-indigo-500/30 hover:bg-indigo-500/40 text-white font-semibold text-xs rounded-lg border border-white/20 transition-colors"
                    >
                      Sign In / Register
                    </button>
                  )}
                </div>
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
                  Status of module implementation across the team:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {modules.map((m) => (
                  <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block">
                        Module {m.id}
                      </span>
                      {m.ready ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Live
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                          In Progress
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm">{m.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{m.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: CUSTOMERS (MEMBER 1) */}
        {activeTab === 'customers' && (
          <div>
            {!isAuthenticated ? (
              <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Authentication Required</h3>
                <p className="text-sm text-slate-500 mt-2 mb-6">
                  Please sign in with your staff or administrator account to manage customers, or register as a customer.
                </p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
                >
                  Sign In to Continue
                </button>
              </div>
            ) : (
              <CustomersPage />
            )}
          </div>
        )}

        {/* TAB 3: USERS (ADMIN ONLY - MEMBER 1) */}
        {activeTab === 'users' && <UsersPage />}

        {/* TAB 4: PRODUCTS & PLANS (MEMBER 2) */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl w-fit">
              <button
                onClick={() => setProductSubTab('products')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  productSubTab === 'products'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📦 Products & Variants
              </button>
              <button
                onClick={() => setProductSubTab('plans')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  productSubTab === 'plans'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 Subscription Plans
              </button>
            </div>

            {productSubTab === 'products' ? <ProductsPage /> : <PlansPage />}
          </div>
        )}

        {/* TAB 5: SUBSCRIPTIONS & QUOTATIONS (MEMBER 3) */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl w-fit">
              <button
                onClick={() => setSubscriptionSubTab('subscriptions')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  subscriptionSubTab === 'subscriptions'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔄 Subscriptions Lifecycle
              </button>
              <button
                onClick={() => setSubscriptionSubTab('quotations')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  subscriptionSubTab === 'quotations'
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📝 Quotations & Templates
              </button>
            </div>

            {subscriptionSubTab === 'subscriptions' ? <SubscriptionsPage /> : <QuotationsPage />}
          </div>
        )}

        {/* TAB 6: INVOICES, PAYMENTS & DASHBOARD (MEMBER 4) */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl w-fit">
              <button
                onClick={() => setInvoiceSubTab('invoices')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  invoiceSubTab === 'invoices'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🧾 Invoices & Billing
              </button>
              <button
                onClick={() => setInvoiceSubTab('payments')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  invoiceSubTab === 'payments'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💳 Payments & Audit
              </button>
              <button
                onClick={() => setInvoiceSubTab('stats')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  invoiceSubTab === 'stats'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📊 Financial Analytics
              </button>
            </div>

            {invoiceSubTab === 'invoices' && <InvoicesPage />}
            {invoiceSubTab === 'payments' && <PaymentsPage />}
            {invoiceSubTab === 'stats' && <DashboardStatsPage />}
          </div>
        )}
      </main>

      {/* Auth Modal (Login / Register / Reset) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-md w-full">
            <button
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-bold shadow-lg hover:bg-slate-800 transition-colors z-10"
            >
              ✕
            </button>
            <LoginPage onSuccess={() => setIsAuthModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
