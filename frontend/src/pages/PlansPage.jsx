import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import PlanModal from '../components/plans/PlanModal';

export default function PlansPage() {
  const { isStaff, isAdmin, authFetch } = useAuth();

  const [plans, setPlans] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

  // Modal State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState(null);

  // Deletion confirm state
  const [deletingPlanId, setDeletingPlanId] = useState(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch plans including inactive ones so admin/staff can manage and view status
      const res = await authFetch('/plans?include_inactive=true');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch subscription plans.');
      }

      const list = Array.isArray(data) ? data : (data.plans || []);
      setPlans(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const fetchProductsForDropdown = useCallback(async () => {
    try {
      const res = await authFetch('/products');
      const data = await res.json();
      if (res.ok) {
        const list = Array.isArray(data) ? data : (data.products || []);
        setProducts(list);
      }
    } catch {
      // Non-critical if products fail to load for dropdown
    }
  }, [authFetch]);

  useEffect(() => {
    fetchPlans();
    fetchProductsForDropdown();
  }, [fetchPlans, fetchProductsForDropdown]);

  // Plan CRUD handlers
  const handleOpenCreatePlan = () => {
    setPlanToEdit(null);
    setIsPlanModalOpen(true);
  };

  const handleOpenEditPlan = (plan) => {
    setPlanToEdit(plan);
    setIsPlanModalOpen(true);
  };

  const handlePlanSaved = (savedPlan) => {
    setPlans((prev) => {
      const exists = prev.some((p) => p.id === savedPlan.id);
      if (exists) {
        return prev.map((p) => (p.id === savedPlan.id ? savedPlan : p));
      }
      return [savedPlan, ...prev];
    });
    setActionMessage('Subscription plan saved successfully.');
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleConfirmDeletePlan = async () => {
    if (!deletingPlanId) return;
    try {
      const res = await authFetch(`/plans/${deletingPlanId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to deactivate plan.');
      }

      setPlans((prev) =>
        prev.map((p) => (p.id === deletingPlanId ? { ...p, is_active: false } : p))
      );
      setActionMessage('Subscription plan deactivated successfully.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingPlanId(null);
    }
  };

  // Filter plans based on search, interval, and status
  const filteredPlans = plans.filter((plan) => {
    const matchesSearch =
      !searchQuery.trim() ||
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plan.product_name && plan.product_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (plan.description && plan.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesInterval =
      intervalFilter === 'all' || plan.billing_interval === intervalFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && plan.is_active) ||
      (statusFilter === 'inactive' && !plan.is_active);

    return matchesSearch && matchesInterval && matchesStatus;
  });

  // KPI Statistics
  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.is_active).length;
  const monthlyPlans = plans.filter((p) => p.billing_interval === 'monthly').length;
  const yearlyPlans = plans.filter((p) => p.billing_interval === 'yearly').length;

  const renderIntervalBadge = (interval) => {
    switch (interval) {
      case 'daily':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
            Daily
          </span>
        );
      case 'weekly':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
            Weekly
          </span>
        );
      case 'monthly':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
            Monthly
          </span>
        );
      case 'yearly':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 uppercase">
            Yearly
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
            {interval}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Subscription Plans</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Module 3
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure recurrent billing cycles (daily, weekly, monthly, yearly), linked products, and trial days.
          </p>
        </div>

        {(isStaff || isAdmin) && (
          <button
            onClick={handleOpenCreatePlan}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-100 transition-all hover:shadow-md"
          >
            <span className="mr-1.5 text-base leading-none">+</span> Add Plan
          </button>
        )}
      </div>

      {/* Action / Success Banner */}
      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-800 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Plans</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalPlans}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active Plans</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">{activePlans}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Monthly Cadence</span>
          <div className="text-2xl font-black text-blue-600 mt-1">{monthlyPlans}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Yearly Cadence</span>
          <div className="text-2xl font-black text-purple-600 mt-1">{yearlyPlans}</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plan or product name..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center space-x-1 text-xs">
            <span className="text-slate-500 font-semibold">Interval:</span>
            <select
              value={intervalFilter}
              onChange={(e) => setIntervalFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Intervals</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="flex items-center space-x-1 text-xs">
            <span className="text-slate-500 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <button
            onClick={fetchPlans}
            disabled={loading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Plans Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-xs font-medium">Loading subscription plans...</p>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto text-2xl">
              📅
            </div>
            <h3 className="font-bold text-slate-800 text-sm">No subscription plans found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery || intervalFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Get started by creating your first subscription plan.'}
            </p>
            {(isStaff || isAdmin) && (
              <button
                onClick={handleOpenCreatePlan}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm"
              >
                + Create Plan
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5">Plan Name</th>
                  <th className="px-4 py-3.5">Linked Product</th>
                  <th className="px-4 py-3.5 text-right">Price</th>
                  <th className="px-4 py-3.5 text-center">Billing Interval</th>
                  <th className="px-4 py-3.5 text-center">Trial Days</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name & Description */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900">{plan.name}</div>
                      {plan.description && (
                        <div className="text-slate-400 text-[11px] truncate max-w-xs">
                          {plan.description}
                        </div>
                      )}
                    </td>

                    {/* Linked Product */}
                    <td className="px-4 py-3.5">
                      {plan.product_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          📦 {plan.product_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Standalone (None)
                        </span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5 text-right font-mono">
                      <span className="font-bold text-slate-900 text-sm">
                        ${Number(plan.price || 0).toFixed(2)}
                      </span>
                      <span className="text-slate-400 text-[10px] block">
                        per {plan.billing_interval}
                      </span>
                    </td>

                    {/* Billing Interval */}
                    <td className="px-4 py-3.5 text-center">
                      {renderIntervalBadge(plan.billing_interval)}
                    </td>

                    {/* Trial Days */}
                    <td className="px-4 py-3.5 text-center font-mono">
                      {plan.trial_days > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {plan.trial_days} days
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None (0)</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-center">
                      {plan.is_active ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Edit Plan (Staff/Admin) */}
                        {(isStaff || isAdmin) && (
                          <button
                            onClick={() => handleOpenEditPlan(plan)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          >
                            Edit
                          </button>
                        )}

                        {/* Soft-delete (Admin Only) */}
                        {isAdmin && plan.is_active && (
                          <button
                            onClick={() => setDeletingPlanId(plan.id)}
                            title="Deactivate Plan"
                            className="px-2 py-1 text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan Modal */}
      <PlanModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        planToEdit={planToEdit}
        products={products}
        onPlanSaved={handlePlanSaved}
      />

      {/* Admin Deactivation Confirmation Modal */}
      {deletingPlanId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-slate-900">Deactivate Plan?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              This will soft-delete the subscription plan (set status to Inactive). Existing customer subscriptions on this plan will not be terminated.
            </p>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setDeletingPlanId(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeletePlan}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                Yes, Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

