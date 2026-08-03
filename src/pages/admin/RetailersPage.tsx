import React, { useState, useEffect } from 'react';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Card, Badge } from '../../components/common';
import { useStore } from '../../store';
import { Plus, Phone, X } from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { retailersService } from '../../services/retailers';

interface RetailerForm {
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  deliveryLocation: string;
  creditLimit: string;
  priceTier: 'standard' | 'premium' | 'discount';
}

const BLANK_FORM: RetailerForm = {
  shopName: '',
  ownerName: '',
  mobileNumber: '',
  address: '',
  deliveryLocation: '',
  creditLimit: '',
  priceTier: 'standard',
};

export const RetailersPage: React.FC = () => {
  const store = useStore();
  const [isAddRetailerModalOpen, setIsAddRetailerModalOpen] = useState(false);
  const [isCratesPanelOpen, setIsCratesPanelOpen] = useState(false);
  const [addRetailerForm, setAddRetailerForm] = useState<RetailerForm>(BLANK_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RetailerForm, string>>>();

  // Use store data
  const mockRetailers = store.retailers;

  useEffect(() => {
    store.fetchInitialData();
  }, [store.fetchInitialData]);

  // Compute ledger dynamically from bills
  const retailerLedger = mockRetailers.reduce((acc, retailer) => {
    const retailerBills = store.bills.filter(b => b.retailerId === retailer.id);
    acc[retailer.id] = {
      outstanding: retailerBills.reduce((sum, b) => sum + b.pendingAmount, 0),
      paid: retailerBills.reduce((sum, b) => sum + b.paidAmount, 0),
      rgbBalance: 0,
    };
    return acc;
  }, {} as Record<string, { outstanding: number; paid: number; rgbBalance: number }>);

  const handleAddRetailer = async () => {
    const errors: Partial<Record<keyof RetailerForm, string>> = {};

    if (!addRetailerForm.shopName.trim()) errors.shopName = 'Shop name is required.';
    if (!addRetailerForm.ownerName.trim()) errors.ownerName = 'Owner name is required.';
    if (!addRetailerForm.address.trim()) errors.address = 'Address is required.';
    if (!addRetailerForm.creditLimit) errors.creditLimit = 'Credit limit is required.';
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
        creditLimit: parseFloat(addRetailerForm.creditLimit),
        priceTier: addRetailerForm.priceTier,
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

  const getCreditStatusColor = (outstanding: number, limit: number) => {
    const percentage = (outstanding / limit) * 100;
    if (percentage === 0) return 'success';
    if (percentage < 70) return 'info';
    if (percentage < 90) return 'warning';
    return 'danger';
  };

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Retailer Management</h1>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={() => setIsCratesPanelOpen(!isCratesPanelOpen)}>
              📦 View Crates with Retailers
            </Button>
            <Button onClick={() => setIsAddRetailerModalOpen(true)}>
              <Plus size={18} className="mr-2" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {retailersWithCrates.map((r) => {
                    const activeBalances = r.rgbBalances?.filter((b) => b.balance > 0) || [];
                    const totalPending = activeBalances.reduce((sum, b) => sum + b.balance, 0);

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
                                <span>{b.rgbItem?.name || 'RGB Crate'}</span>
                                <span className="font-semibold text-amber-700">{b.balance} crates</span>
                              </div>
                            ))}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <p className="text-gray-600 text-sm">Total Retailers</p>
            <p className="text-2xl font-bold mt-2">{mockRetailers.length}</p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Total Outstanding Credit</p>
            <p className="text-2xl font-bold mt-2 text-orange-600">
              ₨{Object.values(retailerLedger).reduce((sum, l) => sum + Number(l.outstanding), 0).toFixed(0)}
            </p>
          </Card>
          <Card>
            <p className="text-gray-600 text-sm">Total Credit Limit</p>
            <p className="text-2xl font-bold mt-2">
              ₨{mockRetailers.reduce((sum, r) => sum + Number(r.creditLimit), 0).toFixed(0)}
            </p>
          </Card>
        </div>

        {/* Retailers Table */}
        <Card title="Retailers">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4">Shop Name</th>
                  <th className="text-left py-3 px-4">Owner</th>
                  <th className="text-left py-3 px-4">Contact</th>
                  <th className="text-right py-3 px-4">Credit Limit</th>
                  <th className="text-right py-3 px-4">Outstanding</th>
                  <th className="text-center py-3 px-4">Credit Status</th>
                  <th className="text-center py-3 px-4">RGB Crates</th>
                  <th className="text-center py-3 px-4">Tier</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockRetailers.map((retailer) => {
                  const ledger = retailerLedger[retailer.id] || { outstanding: 0, paid: 0, rgbBalance: 0 };
                  const creditLimit = Number(retailer.creditLimit) || 0;
                  const outstanding = Number(ledger.outstanding) || 0;
                  const creditStatusColor = getCreditStatusColor(outstanding, creditLimit);
                  const usagePercentage = creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0;
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
                      <td className="py-3 px-4 text-right">₨{creditLimit.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right font-semibold">₨{outstanding.toFixed(0)}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="w-24 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                          <div
                            className={`h-full ${
                              creditStatusColor === 'success'
                                ? 'bg-green-600'
                                : creditStatusColor === 'info'
                                ? 'bg-blue-600'
                                : creditStatusColor === 'warning'
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs mt-1">{usagePercentage.toFixed(0)}% used</p>
                      </td>
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
                        <Badge
                          variant={
                            retailer.priceTier === 'premium'
                              ? 'success'
                              : retailer.priceTier === 'discount'
                              ? 'danger'
                              : 'info'
                          }
                        >
                          {retailer.priceTier}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          className="text-blue-600 hover:text-blue-700 text-sm"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Credit Limit (₨) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                        formErrors?.creditLimit ? 'border-red-500' : 'border-gray-200'
                      }`}
                      value={addRetailerForm.creditLimit}
                      onChange={(e) => setAddRetailerForm((f) => ({ ...f, creditLimit: e.target.value }))}
                      placeholder="100000"
                    />
                    {formErrors?.creditLimit && <p className="text-red-500 text-xs mt-1">{formErrors.creditLimit}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Price Tier</label>
                    <select
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
                      value={addRetailerForm.priceTier}
                      onChange={(e) => setAddRetailerForm((f) => ({ ...f, priceTier: e.target.value as any }))}
                    >
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="discount">Discount</option>
                    </select>
                  </div>
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
