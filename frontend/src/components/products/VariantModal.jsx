import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function VariantModal({ isOpen, onClose, product, variantToEdit, onVariantSaved }) {
  const { authFetch } = useAuth();

  const [formData, setFormData] = useState({
    variant_name: '',
    sku: '',
    sales_price_override: '',
    cost_price_override: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (variantToEdit) {
      setFormData({
        variant_name: variantToEdit.variant_name || '',
        sku: variantToEdit.sku || '',
        sales_price_override: variantToEdit.sales_price_override !== null && variantToEdit.sales_price_override !== undefined
          ? String(variantToEdit.sales_price_override)
          : '',
        cost_price_override: variantToEdit.cost_price_override !== null && variantToEdit.cost_price_override !== undefined
          ? String(variantToEdit.cost_price_override)
          : ''
      });
    } else {
      setFormData({
        variant_name: '',
        sku: '',
        sales_price_override: '',
        cost_price_override: ''
      });
    }
    setError(null);
  }, [variantToEdit, isOpen]);

  if (!isOpen || !product) return null;

  const isEditing = Boolean(variantToEdit && variantToEdit.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.variant_name.trim()) {
      setError('Variant name is required.');
      return;
    }
    if (!formData.sku.trim()) {
      setError('Variant SKU is required.');
      return;
    }

    let salesPriceOverride = null;
    if (formData.sales_price_override.trim() !== '') {
      const sp = parseFloat(formData.sales_price_override);
      if (isNaN(sp) || sp < 0) {
        setError('Sales price override must be a non-negative number.');
        return;
      }
      salesPriceOverride = sp;
    }

    let costPriceOverride = null;
    if (formData.cost_price_override.trim() !== '') {
      const cp = parseFloat(formData.cost_price_override);
      if (isNaN(cp) || cp < 0) {
        setError('Cost price override must be a non-negative number.');
        return;
      }
      costPriceOverride = cp;
    }

    setLoading(true);

    try {
      const endpoint = isEditing
        ? `/products/variants/${variantToEdit.id}`
        : `/products/${product.id}/variants`;
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        variant_name: formData.variant_name.trim(),
        sku: formData.sku.trim().toUpperCase(),
        sales_price_override: salesPriceOverride,
        cost_price_override: costPriceOverride
      };

      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save variant.');
      }

      const savedVariant = data.variant || data;
      onVariantSaved(savedVariant);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-lg">
              🏷️
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isEditing ? 'Edit Product Variant' : 'Add Product Variant'}
              </h3>
              <p className="text-xs text-slate-500">
                Product: <span className="font-semibold text-slate-800">{product.name}</span> ({product.code})
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Variant Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.variant_name}
              onChange={(e) => setFormData({ ...formData, variant_name: e.target.value })}
              placeholder="e.g. 16GB RAM / 512GB SSD"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              SKU (Stock Keeping Unit) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              placeholder="e.g. VPS-RAM16-SSD512"
              className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sales Price Override ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sales_price_override}
                  onChange={(e) => setFormData({ ...formData, sales_price_override: e.target.value })}
                  placeholder={String(product.sales_price ?? '0.00')}
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Base price: ${Number(product.sales_price || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cost Price Override ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-slate-400 font-semibold">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_price_override}
                  onChange={(e) => setFormData({ ...formData, cost_price_override: e.target.value })}
                  placeholder={String(product.cost_price ?? '0.00')}
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Base cost: ${Number(product.cost_price || 0).toFixed(2)}
              </p>
            </div>
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
              className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center space-x-2"
            >
              {loading && <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />}
              <span>{isEditing ? 'Save Variant' : 'Add Variant'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

