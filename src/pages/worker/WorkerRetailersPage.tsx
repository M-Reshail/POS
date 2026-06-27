import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
import { useStore } from '../../store';
import { retailersService } from '../../services/retailers';
import { ShoppingCart, Users, Search, Plus, X, Phone, MapPin } from 'lucide-react';
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
      await retailersService.create({ ...addForm, creditLimit: 0, priceTier: 'standard' });
      store.addNotification('success', 'Retailer added');
      setShowAddModal(false);
      setAddForm({ shopName: '', ownerName: '', mobileNumber: '', address: '', deliveryLocation: '' });
      loadRetailers();
    } catch (err: any) {
      setAddError(err.response?.data?.message || 'Failed to add retailer');
    }
  };

  // Outstanding per retailer from bills
  const outstandingMap = store.bills.reduce((acc, b) => {
    acc[b.retailerId] = (acc[b.retailerId] || 0) + Number(b.pendingAmount);
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
              return (
                <div key={retailer.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{retailer.shopName}</p>
                      <p className="text-sm text-gray-500">{retailer.ownerName}</p>
                    </div>
                    {outstanding > 0 && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                        Udhari: ₨{outstanding.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
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
