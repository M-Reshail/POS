import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
import { useStore } from '../../store';
import { retailersService } from '../../services/retailers';
import { rgbService } from '../../services/rgb';
import { ShoppingCart, Users, Search, Plus, Minus, X, Phone, MapPin, RotateCcw } from 'lucide-react';
import { Retailer } from '../../types';

const WORKER_SIDEBAR = [
  { label: 'Create Sale', icon: <ShoppingCart size={18} />, path: '/worker/sales' },
  { label: 'Retailers', icon: <Users size={18} />, path: '/worker/retailers' },
];

export const WorkerRetailersPage: React.FC = () => {
  const store = useStore();
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    shopName: '', ownerName: '', mobileNumber: '', address: '', deliveryLocation: '',
  });
  const [addError, setAddError] = useState('');

  // Standalone RGB Return state
  const [openReturnRetailerId, setOpenReturnRetailerId] = useState<string | null>(null);
  const [returnFormValues, setReturnFormValues] = useState<Record<string, number>>({});
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const handleStandaloneReturnSubmit = async (retailerId: string) => {
    setSubmittingReturn(true);
    try {
      const promises = Object.entries(returnFormValues)
        .filter(([, qty]) => qty > 0)
        .map(([rgbItemId, quantity]) =>
          rgbService.returnStandalone(rgbItemId, { retailerId, quantity })
        );
      if (promises.length === 0) return;
      await Promise.all(promises);
      store.fetchRGBItems();
      store.addNotification('success', 'Crates return recorded successfully');
      setOpenReturnRetailerId(null);
      setReturnFormValues({});
      loadRetailers();
    } catch (err: any) {
      store.addNotification('error', err.response?.data?.message || 'Failed to record crate return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const loadRetailers = async () => {
    setLoading(true);
    try {
      const data = await retailersService.getAll();
      setRetailers(data);
    } catch {
      store.addNotification('error', 'Failed to load retailers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRetailers(); }, []);

  const filteredRetailers = retailers.filter((r) => {
    const s = searchTerm.toLowerCase();
    return (
      !s ||
      r.shopName.toLowerCase().includes(s) ||
      r.ownerName.toLowerCase().includes(s) ||
      r.mobileNumber.includes(s)
    );
  });

  const handleAdd = async () => {
    setAddError('');
    if (!addForm.shopName || !addForm.ownerName) {
      setAddError('Shop name and owner name are required.');
      return;
    }
    try {
      await retailersService.create({ ...addForm });
      store.addNotification('success', 'Retailer added');
      setShowAddModal(false);
      setAddForm({ shopName: '', ownerName: '', mobileNumber: '', address: '', deliveryLocation: '' });
      loadRetailers();
    } catch (err: any) {
      setAddError(err.response?.data?.message || 'Failed to add retailer');
    }
  };

  // Use ledger-sourced outstanding from the local retailers state (from retailersService.getAll())
  // — previously used store.bills aggregation which was unreliable (pagination + stale state)
  const outstandingMap = retailers.reduce((acc, r) => {
    acc[r.id] = Number(r.outstanding ?? 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout sidebarItems={WORKER_SIDEBAR}>
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Retailers</h1>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} className="mr-1" /> Add Retailer
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card>
            <p className="text-xs text-gray-500">Total Retailers</p>
            <p className="text-2xl font-bold mt-1">{retailers.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Total Outstanding</p>
            <p className="text-2xl font-bold mt-1 text-orange-600">
              ₨{Object.values(outstandingMap).reduce((s, v) => s + v, 0).toFixed(0)}
            </p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-400 focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-2.5 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Retailer List */}
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
        ) : filteredRetailers.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <Users size={40} className="text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">
                {searchTerm ? 'No retailers match your search' : 'No retailers yet'}
              </p>
              {!searchTerm && (
                <Button size="sm" className="mt-3" onClick={() => setShowAddModal(true)}>
                  Add First Retailer
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredRetailers.map((retailer) => {
              const outstanding = outstandingMap[retailer.id] || 0;
              const activeBalances = retailer.rgbBalances?.filter(b => b.balance > 0) || [];
              const totalCratesPending = activeBalances.reduce((s, b) => s + b.balance, 0);
              const isOpen = openReturnRetailerId === retailer.id;

              return (
                <div key={retailer.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{retailer.shopName}</p>
                      <p className="text-sm text-gray-500">{retailer.ownerName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {outstanding > 0 && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                          Udhari: ₨{outstanding.toFixed(0)}
                        </span>
                      )}
                      {totalCratesPending > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                          📦 {totalCratesPending} crates owed
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex gap-4">
                      {retailer.mobileNumber && (
                        <div className="flex items-center gap-1">
                          <Phone size={11} /> {retailer.mobileNumber}
                        </div>
                      )}
                      {retailer.address && (
                        <div className="flex items-center gap-1">
                          <MapPin size={11} /> {retailer.address}
                        </div>
                      )}
                    </div>
                    {totalCratesPending > 0 && (
                      <button
                        onClick={() => {
                          if (isOpen) {
                            setOpenReturnRetailerId(null);
                            setReturnFormValues({});
                          } else {
                            setOpenReturnRetailerId(retailer.id);
                            const initial: Record<string, number> = {};
                            activeBalances.forEach((b) => { initial[b.rgbItemId] = 0; });
                            setReturnFormValues(initial);
                          }
                        }}
                        className="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors flex items-center gap-1"
                      >
                        <RotateCcw size={12} />
                        {isOpen ? 'Cancel Return' : 'RGB Return'}
                      </button>
                    )}
                  </div>

                  {/* Inline Standalone Return Panel */}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-amber-200 bg-amber-50/50 p-3 rounded-lg">
                      <p className="text-xs font-bold text-gray-800 mb-2 flex items-center gap-1">
                        📦 Record Crate Return — {retailer.shopName}
                      </p>
                      <div className="space-y-2 mb-3">
                        {activeBalances.map((b) => {
                          const itemName = b.rgbItem?.name || 'RGB Crate';
                          const returnQty = returnFormValues[b.rgbItemId] ?? 0;
                          return (
                            <div key={b.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-amber-100">
                              <div>
                                <span className="font-semibold text-gray-800">{itemName}</span>
                                <span className="ml-2 text-amber-700 font-medium">(Owes: {b.balance})</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500 text-[11px]">Return:</span>
                                <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded overflow-hidden h-6">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = Math.max(0, returnQty - 1);
                                      setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: val }));
                                    }}
                                    disabled={returnQty <= 0}
                                    className="w-5 h-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold flex items-center justify-center"
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={b.balance}
                                    value={returnQty === 0 ? '' : returnQty}
                                    placeholder="0"
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => {
                                      const parsed = parseInt(e.target.value) || 0;
                                      const val = Math.min(b.balance, Math.max(0, parsed));
                                      setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: val }));
                                    }}
                                    className="w-8 text-center text-xs font-bold bg-transparent border-0 focus:outline-none p-0 text-green-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = Math.min(b.balance, returnQty + 1);
                                      setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: val }));
                                    }}
                                    disabled={returnQty >= b.balance}
                                    className="w-5 h-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold flex items-center justify-center"
                                  >
                                    <Plus size={10} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => { setOpenReturnRetailerId(null); setReturnFormValues({}); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          loading={submittingReturn}
                          onClick={() => handleStandaloneReturnSubmit(retailer.id)}
                          disabled={!Object.values(returnFormValues).some(v => v > 0)}
                        >
                          Confirm Return
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Add Retailer</h3>
                <button onClick={() => setShowAddModal(false)}><X size={18} className="text-gray-400" /></button>
              </div>
              {addError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{addError}</div>
              )}
              <div className="space-y-3">
                {[
                  { label: 'Shop Name *', key: 'shopName', placeholder: 'e.g. Ali Store' },
                  { label: 'Owner Name *', key: 'ownerName', placeholder: 'e.g. Ali Khan' },
                  { label: 'Phone', key: 'mobileNumber', placeholder: '03001234567' },
                  { label: 'Address', key: 'address', placeholder: 'City' },
                  { label: 'Delivery Location', key: 'deliveryLocation', placeholder: 'Specific delivery point' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <input
                      type="text"
                      value={addForm[key as keyof typeof addForm]}
                      onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleAdd} className="flex-1">Add Retailer</Button>
                <Button variant="secondary" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
