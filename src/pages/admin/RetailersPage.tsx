import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card } from '../../components/common';
import { useStore } from '../../store';
import { Plus, Minus, Phone, X, RotateCcw } from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { retailersService } from '../../services/retailers';
import { rgbService } from '../../services/rgb';

interface RetailerForm {
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  deliveryLocation: string;
}

const BLANK_FORM: RetailerForm = {
  shopName: '',
  ownerName: '',
  mobileNumber: '',
  address: '',
  deliveryLocation: '',
};

export const RetailersPage: React.FC = () => {
  const navigate = useNavigate();
  const store = useStore();
  const [isAddRetailerModalOpen, setIsAddRetailerModalOpen] = useState(false);
  const [isCratesPanelOpen, setIsCratesPanelOpen] = useState(false);
  const [addRetailerForm, setAddRetailerForm] = useState<RetailerForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RetailerForm, string>>>();

  // Use store data
  const mockRetailers = store.retailers;

  // Inline Standalone RGB Return state
  const [openReturnRetailerId, setOpenReturnRetailerId] = useState<string | null>(null);
  const [returnFormValues, setReturnFormValues] = useState<Record<string, number>>({});
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    store.fetchInitialData();
  }, [store.fetchInitialData]);

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
      store.fetchRetailers();
      store.fetchRGBItems();
      store.addNotification('success', 'Crates return recorded successfully');
      setOpenReturnRetailerId(null);
      setReturnFormValues({});
    } catch (err: any) {
      store.addNotification('error', err.response?.data?.message || 'Failed to record crate return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // outstanding comes directly from the API on each retailer object (ledger-sourced running balance)
  // — no longer computed from store.bills (unreliable: pagination + stale state)

  const handleAddRetailer = async () => {
    const errors: Partial<Record<keyof RetailerForm, string>> = {};

    if (!addRetailerForm.shopName.trim()) errors.shopName = 'Shop name is required.';
    if (!addRetailerForm.ownerName.trim()) errors.ownerName = 'Owner name is required.';
    if (!addRetailerForm.address.trim()) errors.address = 'Address is required.';
    if (addRetailerForm.mobileNumber && !/^\d{11}$/.test(addRetailerForm.mobileNumber)) {
      errors.mobileNumber = 'Phone number must be exactly 11 digits.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return; // Keep modal open, show inline errors
    }
    setFormErrors({});

    try {
      await retailersService.create({
        shopName: addRetailerForm.shopName,
        ownerName: addRetailerForm.ownerName,
        mobileNumber: addRetailerForm.mobileNumber,
        address: addRetailerForm.address,
        deliveryLocation: addRetailerForm.deliveryLocation,
      });
      store.fetchRetailers();
      setAddRetailerForm(BLANK_FORM);
      setFormErrors({});
      setIsAddRetailerModalOpen(false);
      store.addNotification('success', 'Retailer added successfully');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to add retailer';
      setFormErrors({ shopName: msg }); // Show server error inline
    }
  };

  const handleCloseModal = () => {
    setIsAddRetailerModalOpen(false);
    setFormErrors({});
    // Do NOT reset form — preserve entered data on close
  };

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Retailer Management</h1>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Button variant="secondary" onClick={() => setIsCratesPanelOpen(!isCratesPanelOpen)} className="text-xs sm:text-sm py-2 px-3">
              📦 View Crates with Retailers
            </Button>
            <Button onClick={() => setIsAddRetailerModalOpen(true)} className="text-xs sm:text-sm py-2 px-3">
              <Plus size={16} className="mr-1.5" />
              Add Retailer
            </Button>
          </div>
        </div>

        {/* Inline Expandable Crates with Retailers Section */}
        {isCratesPanelOpen && (
          <Card title="📦 Crates Out with Retailers" className="mb-6 border-amber-200 bg-amber-50/20">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-600">
                Retailers currently holding returnable glass bottle (crate) balances.
              </p>
              <button
                onClick={() => setIsCratesPanelOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
              >
                ✕ Close
              </button>
            </div>

            {(() => {
              const retailersWithCrates = mockRetailers.filter((r) => {
                const pending = r.rgbBalances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;
                return pending > 0;
              });

              if (retailersWithCrates.length === 0) {
                return (
                  <div className="py-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
                    No retailers currently owe RGB crates.
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {retailersWithCrates.map((r) => {
                    const activeBalances = r.rgbBalances?.filter((b) => b.balance > 0) || [];
                    const totalPending = activeBalances.reduce((sum, b) => sum + b.balance, 0);
                    const isOpen = openReturnRetailerId === r.id;

                    return (
                      <div key={r.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900 text-sm">{r.shopName}</h4>
                              <p className="text-xs text-gray-500">{r.ownerName} · {r.mobileNumber}</p>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              {totalPending} total crates
                            </span>
                          </div>

                          <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                            {activeBalances.map((b) => (
                              <div key={b.id} className="flex justify-between text-xs text-gray-700">
                                <span>{b.rgbItem?.name ?? b.rgbItemId}</span>
                                <span className="font-bold text-amber-700">{b.balance} crates</span>
                              </div>
                            ))}
                          </div>

                          {/* RGB Return Drawer Button / Inline Form */}
                          <div className="mt-3 pt-2 border-t border-gray-100">
                            {!isOpen ? (
                              <button
                                onClick={() => {
                                  setOpenReturnRetailerId(r.id);
                                  const initialVals: Record<string, number> = {};
                                  activeBalances.forEach(b => { initialVals[b.rgbItemId] = 0; });
                                  setReturnFormValues(initialVals);
                                }}
                                className="w-full py-1.5 text-xs font-bold rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center justify-center gap-1.5"
                              >
                                <RotateCcw size={12} />
                                RGB Return
                              </button>
                            ) : (
                              <div className="space-y-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/80">
                                <div className="flex justify-between items-center">
                                  <p className="text-xs font-bold text-amber-900">Record Crate Return</p>
                                  <button
                                    onClick={() => setOpenReturnRetailerId(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {activeBalances.map((b) => {
                                  const returnQty = returnFormValues[b.rgbItemId] ?? 0;
                                  return (
                                    <div key={b.id} className="flex items-center justify-between text-xs gap-2">
                                      <span className="font-medium text-gray-800 flex-1 truncate">{b.rgbItem?.name}</span>
                                      <div className="flex items-center gap-1">
                                        <div className="flex items-center border border-green-300 rounded-lg overflow-hidden h-7 bg-white">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const current = returnFormValues[b.rgbItemId] ?? 0;
                                              setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: Math.max(0, current - 1) }));
                                            }}
                                            disabled={returnQty <= 0}
                                            className="w-6 h-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold flex items-center justify-center"
                                          >
                                            <Minus size={11} />
                                          </button>
                                          <input
                                            type="number"
                                            min="0"
                                            max={b.balance}
                                            value={returnQty === 0 ? '' : returnQty}
                                            placeholder="0"
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const val = Math.min(b.balance, Math.max(0, parseInt(e.target.value) || 0));
                                              setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: val }));
                                            }}
                                            className="w-8 text-center text-xs font-bold border-0 bg-transparent focus:outline-none p-0 text-green-950 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const current = returnFormValues[b.rgbItemId] ?? 0;
                                              setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: Math.min(b.balance, current + 1) }));
                                            }}
                                            disabled={returnQty >= b.balance}
                                            className="w-6 h-full bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold flex items-center justify-center"
                                          >
                                            <Plus size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                <div className="flex justify-end gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => { setOpenReturnRetailerId(null); setReturnFormValues({}); }}
                                    className="text-xs py-1"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    loading={submittingReturn}
                                    onClick={() => handleStandaloneReturnSubmit(r.id)}
                                    disabled={!Object.values(returnFormValues).some(v => v > 0)}
                                    className="text-xs py-1"
                                  >
                                    Confirm Return
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mb-6">
          <Card>
            <p className="text-gray-600 text-xs sm:text-sm">Total Retailers</p>
            <p className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{mockRetailers.length}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-xs sm:text-sm">Total Outstanding Credit</p>
            <p className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2 text-orange-600">
              ₨{mockRetailers.reduce((sum, r) => sum + Number(r.outstanding ?? 0), 0).toFixed(0)}
            </p>
          </Card>
        </div>

        {/* Retailers Table */}
        <Card title="Retailers">
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4">Shop Name</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-left py-3 px-4">Contact</th>
                  <th className="text-right py-3 px-4">Outstanding</th>
                  <th className="text-center py-3 px-4">RGB Crates</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockRetailers.map((retailer) => {
                  const outstanding = Number(retailer.outstanding ?? 0);
                  const totalCratesPending = retailer.rgbBalances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

                  return (
                    <tr key={retailer.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{retailer.shopName}</td>
                      <td className="py-3 px-4">{retailer.ownerName}</td>
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-1 text-blue-600">
                          <Phone size={14} />
                          {retailer.mobileNumber}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">₨{outstanding.toFixed(0)}</td>
                      <td className="py-3 px-4 text-center">
                        {totalCratesPending > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            {totalCratesPending} crates pending
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => navigate(`/admin/retailers/${retailer.id}`)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Add Retailer Modal — properly sized, inline validation */}
        {isAddRetailerModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
                <h2 className="text-lg font-bold text-gray-900">Add New Retailer</h2>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              {/* Body — scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Shop Name <span className="text-red-500">*</span></label>
                  <input
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                      formErrors?.shopName ? 'border-red-500' : 'border-gray-200'
                    }`}
                    value={addRetailerForm.shopName}
                    onChange={(e) => setAddRetailerForm((f) => ({ ...f, shopName: e.target.value }))}
                    placeholder="e.g., Ali General Store"
                  />
                  {formErrors?.shopName && <p className="text-red-500 text-xs mt-1">{formErrors.shopName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Owner Name <span className="text-red-500">*</span></label>
                  <input
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                      formErrors?.ownerName ? 'border-red-500' : 'border-gray-200'
                    }`}
                    value={addRetailerForm.ownerName}
                    onChange={(e) => setAddRetailerForm((f) => ({ ...f, ownerName: e.target.value }))}
                    placeholder="e.g., Ali Khan"
                  />
                  {formErrors?.ownerName && <p className="text-red-500 text-xs mt-1">{formErrors.ownerName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mobile Number <span className="text-gray-400 font-normal">(11 digits)</span></label>
                  <input
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                      formErrors?.mobileNumber ? 'border-red-500' : 'border-gray-200'
                    }`}
                    value={addRetailerForm.mobileNumber}
                    onChange={(e) => setAddRetailerForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                    placeholder="03001234567"
                    maxLength={11}
                  />
                  {formErrors?.mobileNumber && <p className="text-red-500 text-xs mt-1">{formErrors.mobileNumber}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Address <span className="text-red-500">*</span></label>
                  <input
                    className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                      formErrors?.address ? 'border-red-500' : 'border-gray-200'
                    }`}
                    value={addRetailerForm.address}
                    onChange={(e) => setAddRetailerForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="City, Province"
                  />
                  {formErrors?.address && <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Delivery Location</label>
                  <input
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                    value={addRetailerForm.deliveryLocation}
                    onChange={(e) => setAddRetailerForm((f) => ({ ...f, deliveryLocation: e.target.value }))}
                    placeholder="Specific delivery point"
                  />
                </div>

              </div>

              {/* Footer — always visible */}
              <div className="flex gap-2 px-6 py-4 border-t flex-shrink-0">
                <Button onClick={handleAddRetailer} className="flex-1">Add Retailer</Button>
                <Button variant="secondary" onClick={handleCloseModal} className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </Layout>
  );
};
