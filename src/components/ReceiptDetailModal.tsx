import { useState, useEffect } from 'react';
import { X, Calendar, Edit2, Info, Loader2, ShoppingCart } from 'lucide-react';
import { SupabaseService } from '../services/supabaseService';
import { ProductHistory, Product, Receipt } from '../lib/supabase';

interface ReceiptDetailModalProps {
  receiptId: number;
  familyId: number;
  receipts: Receipt[];
  onClose: () => void;
  onDateUpdated: () => void;
}

const ReceiptDetailModal = ({ 
  receiptId, 
  familyId,
  receipts,
  onClose, 
  onDateUpdated 
}: ReceiptDetailModalProps) => {
  const [products, setProducts] = useState<Array<ProductHistory & { product?: Product }>>([]);
  const [loading, setLoading] = useState(true);
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [updating, setUpdating] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  useEffect(() => {
    loadReceiptDetails();
  }, [receiptId]);

  const loadReceiptDetails = async () => {
    try {
      setLoading(true);
      
      // Get receipt info
      const receiptData = receipts.find(r => r.id === receiptId);
      setReceipt(receiptData);
      setNewDate(receiptData?.date || '');
      
      // Get products from this receipt
      const receiptProducts = await SupabaseService.getReceiptProducts(receiptId, familyId);
      setProducts(receiptProducts);
    } catch (error) {
      console.error('Error loading receipt details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDate = async () => {
    try {
      setUpdating(true);
      await SupabaseService.updateReceiptDate(receiptId, familyId, newDate);
      
      // Refresh data
      await loadReceiptDetails();
      onDateUpdated();
      setEditingDate(false);
    } catch (error) {
      console.error('Error updating date:', error);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
          <div className="text-center py-8">
            <Loader2 size={48} className="mx-auto text-indigo-600 mb-4 animate-spin" />
            <p className="text-gray-600">Загрузка чека...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Детали чека</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Date Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar size={20} />
                <span className="font-medium">Дата покупки:</span>
              </div>
              {!editingDate && (
                <button
                  onClick={() => setEditingDate(true)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Изменить дату"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>

            {editingDate ? (
              <div className="space-y-2">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateDate}
                    disabled={updating || !newDate || newDate === receipt?.date}
                    className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? 'Обновление...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingDate(false);
                      setNewDate(receipt?.date || '');
                    }}
                    disabled={updating}
                    className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Info size={14} className="flex-shrink-0" />
                  При изменении даты будет пересчитана статистика для старого и нового месяца
                </p>
              </div>
            ) : (
              <div className="text-lg font-semibold text-gray-900">
                {receipt ? new Date(receipt.date).toLocaleDateString('ru-RU', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                }) : '—'}
              </div>
            )}
          </div>

          {/* Receipt Summary */}
          <div className="mt-4 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm text-gray-500">Товаров</div>
              <div className="text-xl font-bold text-gray-900">{products.length}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Сумма</div>
              <div className="text-xl font-bold text-indigo-600">
                €{receipt?.total_amount?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="p-6 space-y-3">
          <h3 className="font-semibold text-gray-900 mb-4">Продукты в чеке:</h3>
          {products.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart size={48} className="mx-auto mb-3 opacity-50" />
              <p>Нет продуктов в чеке</p>
            </div>
          ) : (
            products.map((item, index) => (
              <div 
                key={index} 
                className="bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {item.product?.name || 'Неизвестный товар'}
                    </h4>
                    {item.product?.original_name && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.product.original_name}
                      </div>
                    )}
                  </div>
                  <div className="text-lg font-bold text-indigo-600">
                    €{item.price.toFixed(2)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                  <div>
                    <div className="text-gray-500">Количество</div>
                    <div className="font-medium text-gray-900">{item.quantity}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Цена за ед.</div>
                    <div className="font-medium text-gray-900">€{item.unit_price.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Калории</div>
                    <div className="font-medium text-gray-900">
                      {item.product?.calories || 0} ккал
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptDetailModal;

