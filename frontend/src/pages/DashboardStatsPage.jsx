import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export default function DashboardStatsPage() {
  const { authFetch } = useAuth();

  const [stats, setStats] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, paymentsRes, invoicesRes] = await Promise.all([
        authFetch('/dashboard/stats'),
        authFetch('/payments'),
        authFetch('/invoices')
      ]);

      const [statsData, paymentsData, invoicesData] = await Promise.all([
        statsRes.json(),
        paymentsRes.json(),
        invoicesRes.json()
      ]);

      if (!statsRes.ok) {
        throw new Error(statsData.error || 'Failed to fetch dashboard metrics.');
      }

      setStats(statsData);

      if (paymentsRes.ok) {
        const pList = Array.isArray(paymentsData) ? paymentsData : paymentsData.payments || [];
        setRecentPayments(pList.slice(0, 5));
      }

      if (invoicesRes.ok) {
        const iList = Array.isArray(invoicesData) ? invoicesData : invoicesData.invoices || [];
        setRecentInvoices(iList.slice(0, 5));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Financial Analytics & Business Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time insights on recurring revenue, cash flow, subscription volume, and receivables.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Metrics'}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="p-16 text-center text-slate-500 space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold">Computing MRR & Financial Metrics...</p>
        </div>
      ) : (
        <>
          {/* Top 4 KPI Hero Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: MRR */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200 block">
                  Monthly Recurring Revenue (MRR)
                </span>
                <span className="text-3xl font-extrabold tracking-tight mt-2 block">
                  ${(stats?.mrr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-indigo-100">
                <span>Annualized (ARR):</span>
                <span className="font-bold text-white">${((stats?.mrr || 0) * 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Card 2: Total Collected */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Total Revenue Collected
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2 block">
                  ${(stats?.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Successful Payments:</span>
                <span className="font-bold text-emerald-700">{stats?.total_payments_count || 0}</span>
              </div>
            </div>

            {/* Card 3: Active Subscriptions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Active Subscriptions
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2 block">
                  {stats?.active_subscriptions || 0}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Billing Status:</span>
                <span className="font-bold text-blue-700">Healthy & Active</span>
              </div>
            </div>

            {/* Card 4: Overdue Invoices */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Overdue Receivables
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                </div>
                <span className="text-3xl font-extrabold text-rose-700 tracking-tight mt-2 block">
                  ${(stats?.overdue_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Overdue Invoices:</span>
                <span className="font-bold text-rose-700">{stats?.overdue_invoices_count || 0}</span>
              </div>
            </div>
          </div>

          {/* Pending Receivables & Cash Flow Banner */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg">
                ⏳
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-950">Outstanding Pending Receivables</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Currently ${(stats?.pending_amount || 0).toFixed(2)} in issued invoices pending customer settlement.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-base font-extrabold text-amber-900">
                ${(stats?.pending_amount || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Recent Activity Split Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Payments */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Recent Payment Transactions</h3>
                <span className="text-[11px] text-slate-400 font-medium">Last 5 audit entries</span>
              </div>

              {recentPayments.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No payment transactions yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-slate-800 block">
                          {p.transaction_id}
                        </span>
                        <span className="text-[11px] text-slate-500 capitalize">
                          {p.customer_name || 'Customer'} • {p.payment_method.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-700 block">
                          +${(p.amount || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Invoices */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Recent Invoices Generated</h3>
                <span className="text-[11px] text-slate-400 font-medium">Last 5 bills</span>
              </div>

              {recentInvoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No invoices generated yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentInvoices.map((i) => (
                    <div
                      key={i.id}
                      className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-indigo-700 block">
                          {i.invoice_number}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {i.customer_name || 'Customer'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 block">
                          ${(i.total_amount || 0).toFixed(2)}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            i.status === 'paid'
                              ? 'text-emerald-600'
                              : i.status === 'overdue' || i.is_overdue
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {i.is_overdue ? 'Overdue' : i.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
