import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function PaymentModal({ isOpen, invoice, onClose, onPaymentRecorded }) {
  const { authFetch } = useAuth();

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [transactionId, setTransactionId] = useState('');
  const [status, setStatus] = useState('success');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (invoice && isOpen) {
      setAmount((invoice.total_amount || 0).toFixed(2));
      setPaymentMethod('credit_card');
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      setTransactionId(`TXN-${new Date().getFullYear()}-${randomSuffix}`);
      setStatus('success');
      setNotes('');
      setError(null);
    }
  }, [invoice, isOpen]);

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!transactionId.trim()) {
      setError('Transaction ID is required.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        invoice_id: invoice.id,
        amount: numAmount,
        payment_method: paymentMethod,
        transaction_id: transactionId.trim(),
        status: status,
        notes: notes.trim() || null
      };

      const res = await authFetch('/payments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment.');
      }

      onPaymentRecorded(data.payment, data.invoice);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="font-bold text-base">Record Payment</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Invoice Summary Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Invoice Number:</span>
              <span className="font-mono font-bold text-indigo-700">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Customer:</span>
              <span className="font-semibold text-slate-800">
                {invoice.customer_name || `Customer #${invoice.customer_id}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Total Balance Due:</span>
              <span className="font-extrabold text-slate-900">
                ${(invoice.total_amount || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Amount & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Amount ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              >
                <option value="credit_card">💳 Credit Card</option>
                <option value="bank_transfer">🏦 Bank Transfer</option>
                <option value="upi">📱 UPI</option>
                <option value="cash">💵 Cash</option>
              </select>
            </div>
          </div>

          {/* Transaction ID & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Transaction ID *
              </label>
              <input
                type="text"
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full font-mono text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Payment Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
              >
                <option value="success">Success (Marks Invoice Paid)</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Payment Reference / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Wire reference #99210 or card auth code..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
            />
          </div>

          <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center space-x-1.5"
            >
              {loading && (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>Record Payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

