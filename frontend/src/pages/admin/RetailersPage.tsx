import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, PageContainer } from '../../components/Layout';
import { Button, Modal } from '../../components/common';
import { Card, Figure } from '../../components/ui/Card';
import { useStore } from '../../store';
import { Plus, Minus, Phone, RotateCcw, Users } from 'lucide-react';
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
  };

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          {/* Summary Card (Single Card, Single Column) */}
          <div className="w-full sm:w-auto min-w-[280px]">
            <Card variant="default" className="p-3 sm:p-3.5">
              <div className="flex flex-col divide-y divide-border">
                <div className="py-1.5 px-2 flex items-center justify-between gap-4">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Total Retailers</span>
                  <span className="text-xs sm:text-sm font-extrabold text-ink">
                    <Figure>{mockRetailers.length}</Figure>
                  </span>
                </div>
                <div className="py-1.5 px-2 flex items-center justify-between gap-4">
                  <span className="text-[11px] text-ink-muted font-bold uppercase tracking-wider">Total Outstanding Credit</span>
                  <span className="text-xs sm:text-sm font-extrabold text-danger-500">
                    ₨<Figure>{mockRetailers.reduce((sum, r) => sum + Number(r.outstanding ?? 0), 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })}</Figure>
                  </span>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={() => setIsCratesPanelOpen(!isCratesPanelOpen)}
              className="flex-1 sm:flex-initial h-9 sm:h-10 px-2.5 sm:px-4 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <span>📦 View Crates<span className="hidden sm:inline"> with Retailers</span></span>
            </Button>
            <Button
              onClick={() => setIsAddRetailerModalOpen(true)}
              className="flex-1 sm:flex-initial h-9 sm:h-10 px-2.5 sm:px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <Plus size={15} />
              <span>Add Retailer</span>
            </Button>
          </div>
        </div>

        {/* Inline Expandable Crates with Retailers Section */}
        {isCratesPanelOpen && (
          <Card variant="default" className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                📦 Crates Out with Retailers
              </h3>
              <button
                onClick={() => setIsCratesPanelOpen(false)}
                className="text-xs text-ink-subtle hover:text-ink font-semibold cursor-pointer"
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
                  <div className="py-8 text-center text-sm text-ink-subtle bg-surface-card rounded-card border border-border">
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
                      <div key={r.id} className="bg-surface-card p-4 rounded-card border border-border shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-bold text-ink text-sm">{r.shopName}</h4>
                              <p className="text-xs text-ink font-medium">{r.ownerName} · {r.mobileNumber}</p>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-control text-xs font-bold bg-surface-muted text-ink border border-border">
                              <Figure>{totalPending}</Figure> crates
                            </span>
                          </div>

                          <div className="border-t border-border pt-2 mt-2 space-y-1">
                            {activeBalances.map((b) => (
                              <div key={b.id} className="flex justify-between text-xs text-ink">
                                <span className="font-medium text-ink">{b.rgbItem?.name ?? b.rgbItemId}</span>
                                <span className="font-bold text-ink"><Figure>{b.balance}</Figure> crates</span>
                              </div>
                            ))}
                          </div>

                          {/* RGB Return Drawer Button / Inline Form */}
                          <div className="mt-3 pt-2 border-t border-border">
                            {!isOpen ? (
                              <button
                                onClick={() => {
                                  setOpenReturnRetailerId(r.id);
                                  const initialVals: Record<string, number> = {};
                                  activeBalances.forEach(b => { initialVals[b.rgbItemId] = 0; });
                                  setReturnFormValues(initialVals);
                                }}
                                className="w-full btn-secondary text-xs py-1.5 flex items-center justify-center gap-1.5"
                              >
                                <RotateCcw size={12} />
                                RGB Return
                              </button>
                            ) : (
                              <div className="space-y-2 bg-surface-muted/50 p-2.5 rounded-control border border-border">
                                <div className="flex justify-between items-center">
                                  <p className="text-xs font-bold text-ink">Record Crate Return</p>
                                  <button
                                    onClick={() => setOpenReturnRetailerId(null)}
                                    className="text-xs text-ink-subtle hover:text-ink"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {activeBalances.map((b) => {
                                  const returnQty = returnFormValues[b.rgbItemId] ?? 0;
                                  return (
                                    <div key={b.id} className="flex items-center justify-between text-xs gap-2">
                                      <span className="font-medium text-ink flex-1 truncate">{b.rgbItem?.name}</span>
                                      <div className="flex items-center gap-1">
                                        <div className="flex items-center border border-success-500/40 rounded-control overflow-hidden h-7 bg-surface-card">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const current = returnFormValues[b.rgbItemId] ?? 0;
                                              setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: Math.max(0, current - 1) }));
                                            }}
                                            disabled={returnQty <= 0}
                                            className="w-6 h-full bg-success-500 hover:bg-success-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold flex items-center justify-center"
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
                                            className="w-8 text-center text-xs font-bold border-0 bg-transparent focus:outline-none p-0 text-ink [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const current = returnFormValues[b.rgbItemId] ?? 0;
                                              setReturnFormValues(prev => ({ ...prev, [b.rgbItemId]: Math.min(b.balance, current + 1) }));
                                            }}
                                            disabled={returnQty >= b.balance}
                                            className="w-6 h-full bg-success-500 hover:bg-success-600 disabled:bg-surface-muted disabled:text-ink-subtle text-white font-bold flex items-center justify-center"
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



        {/* Retailers Table */}
        <Card variant="default">
          <h3 className="text-sm sm:text-base font-bold text-ink mb-4">Retailers</h3>
          {mockRetailers.length === 0 ? (
            /* Empty state — per DESIGN_TOKENS.md: no fixed min-height, show explicit empty state */
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-card bg-surface-muted flex items-center justify-center">
                <Users size={22} className="text-ink-subtle" />
              </div>
              <p className="text-sm text-ink-muted font-medium">No retailers added yet</p>
              <Button
                onClick={() => setIsAddRetailerModalOpen(true)}
                size="sm"
              >
                <Plus size={14} className="mr-1" /> Add Retailer
              </Button>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-270px)] border border-border rounded-card">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-surface-muted text-ink-subtle font-bold uppercase tracking-wider text-[11px] border-b border-border-strong">
                    <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">Shop Name</th>
                    <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">Owner</th>
                    <th className="sticky top-0 z-20 bg-surface-muted text-left py-3 px-4">Contact</th>
                    <th className="sticky top-0 z-20 bg-surface-muted text-right py-3 px-4">Outstanding</th>
                    <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-4">RGB Crates</th>
                    <th className="sticky top-0 z-20 bg-surface-muted text-center py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockRetailers.map((retailer) => {
                    const outstanding = Number(retailer.outstanding ?? 0);
                    const totalCratesPending = retailer.rgbBalances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

                    return (
                      <tr key={retailer.id} className="border-b border-border hover:bg-surface-muted/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-ink">{retailer.shopName}</td>
                        <td className="py-3 px-4 text-ink-muted">{retailer.ownerName}</td>
                        <td className="py-3 px-4 text-xs">
                          <div className="flex items-center gap-1 text-brand-600">
                            <Phone size={14} />
                            {retailer.mobileNumber}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-ink">
                          ₨<Figure>{outstanding.toFixed(0)}</Figure>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {totalCratesPending > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-control text-xs font-semibold bg-surface-muted text-ink-muted border border-border">
                              <Figure>{totalCratesPending}</Figure> crates pending
                            </span>
                          ) : (
                            <span className="text-ink-subtle text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => navigate(`/admin/retailers/${retailer.id}`)}
                            className="text-brand-600 hover:text-brand-700 text-sm font-semibold"
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
          )}
        </Card>

        {/* Add Retailer Modal — portal-rendered via shared Modal component for true viewport centering */}
        <Modal
          isOpen={isAddRetailerModalOpen}
          title="Add New Retailer"
          onClose={handleCloseModal}
          footer={
            <>
              <Button onClick={handleAddRetailer} className="flex-1">Add Retailer</Button>
              <Button variant="secondary" onClick={handleCloseModal} className="flex-1">Cancel</Button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Shop Name <span className="text-danger-500">*</span></label>
              <input
                className={`input-field text-sm ${formErrors?.shopName ? 'border-danger-500 focus:ring-danger-500/50 focus:border-danger-500' : ''}`}
                value={addRetailerForm.shopName}
                onChange={(e) => setAddRetailerForm((f) => ({ ...f, shopName: e.target.value }))}
                placeholder="e.g., Ali General Store"
              />
              {formErrors?.shopName && <p className="text-danger-500 text-xs mt-1">{formErrors.shopName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Owner Name <span className="text-danger-500">*</span></label>
              <input
                className={`input-field text-sm ${formErrors?.ownerName ? 'border-danger-500 focus:ring-danger-500/50 focus:border-danger-500' : ''}`}
                value={addRetailerForm.ownerName}
                onChange={(e) => setAddRetailerForm((f) => ({ ...f, ownerName: e.target.value }))}
                placeholder="e.g., Ali Khan"
              />
              {formErrors?.ownerName && <p className="text-danger-500 text-xs mt-1">{formErrors.ownerName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Mobile Number <span className="text-ink-subtle font-normal">(11 digits)</span></label>
              <input
                className={`input-field text-sm ${formErrors?.mobileNumber ? 'border-danger-500 focus:ring-danger-500/50 focus:border-danger-500' : ''}`}
                value={addRetailerForm.mobileNumber}
                onChange={(e) => setAddRetailerForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                placeholder="03001234567"
                maxLength={11}
              />
              {formErrors?.mobileNumber && <p className="text-danger-500 text-xs mt-1">{formErrors.mobileNumber}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Address <span className="text-danger-500">*</span></label>
              <input
                className={`input-field text-sm ${formErrors?.address ? 'border-danger-500 focus:ring-danger-500/50 focus:border-danger-500' : ''}`}
                value={addRetailerForm.address}
                onChange={(e) => setAddRetailerForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="City, Province"
              />
              {formErrors?.address && <p className="text-danger-500 text-xs mt-1">{formErrors.address}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Delivery Location</label>
              <input
                className="input-field text-sm"
                value={addRetailerForm.deliveryLocation}
                onChange={(e) => setAddRetailerForm((f) => ({ ...f, deliveryLocation: e.target.value }))}
                placeholder="Specific delivery point"
              />
            </div>
          </div>
        </Modal>
      </PageContainer>
    </Layout>
  );
};
