import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ProductModal({ isOpen, onClose, productToEdit, onProductSaved }) {
  const { authFetch } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    sales_price: '0.00',
    cost_price: '0.00',
    is_active: true
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (productToEdit) {
      setFormData({
        name: productToEdit.name || '',
        code: productToEdit.code || '',
        description: productToEdit.description || '',
        sales_price: productToEdit.sales_price !== undefined ? String(productToEdit.sales_price) : '0.00',
        cost_price: productToEdit.cost_price !== undefined ? String(productToEdit.cost_price) : '0.00',
        is_active: productToEdit.is_active !== undefined ? productToEdit.is_active : true
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        sales_price: '0.00',
        cost_price: '0.00',
        is_active: true
      });
    }
    setError(null);
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(productToEdit && productToEdit.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!formData.code.trim()) {
      setError('Product code is required.');
      return;
    }

    const salesPriceNum = parseFloat(formData.sales_price);
    const costPriceNum = parseFloat(formData.cost_price);

    if (isNaN(salesPriceNum) || salesPriceNum < 0) {
      setError('Sales price must be a valid non-negative number.');
      return;
    }
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      setError('Cost price must be a valid non-negative number.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isEditing ? `/products/${productToEdit.id}` : '/products';
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        sales_price: salesPriceNum,
        cost_price: costPriceNum,
        is_active: formData.is_active
      };

      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save product.');
      }

      const savedProduct = data.product || data;
      onProductSaved(savedProduct);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
              📦
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Product' : 'Create New Product'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEditing ? 'Update catalog specifications and pricing' : 'Add a new product to your catalog'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
            <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Cloud Compute VPS"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Code / Identifier <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g. VPS-COMPUTE-01"
                className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sales Price ($) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.sales_price}
                  onChange={(e) => setFormData({ ...formData, sales_price: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cost Price ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide a detailed description of this product..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="is_active_toggle"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
            />
            <label htmlFor="is_active_toggle" className="text-xs font-medium text-slate-700 cursor-pointer">
              Active in catalog (available for plans and sales)
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              {loading && <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />}
              <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

