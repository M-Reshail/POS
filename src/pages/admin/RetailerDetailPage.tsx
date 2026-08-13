import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, PageContainer } from '../../components/Layout';
import { Card, Button, Modal } from '../../components/common';
import { useStore } from '../../store';
import {
  ArrowLeft,
  Store,
  User,
  Phone,
  MapPin,
  CreditCard,
  Boxes,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { ADMIN_SIDEBAR } from '../../constants/navigation';
import { retailersService } from '../../services/retailers';
import { Retailer, LedgerEntry } from '../../types';

const ENTRY_TYPE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  sale: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Sale' },
  payment: { bg: 'bg-green-100', text: 'text-green-800', label: 'Payment' },
  return: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Return' },
  adjustment: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Adjustment' },
};

const PAGE_SIZE = 15;

interface RetailerEditForm {
  shopName: string;
  ownerName: string;
  mobileNumber: string;
  address: string;
  deliveryLocation: string;
}

export const RetailerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useStore();

  const [retailer, setRetailer] = useState<Retailer | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [outstanding, setOutstanding] = useState(0);

  const [loadingRetailer, setLoadingRetailer] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // Edit Retailer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<RetailerEditForm>({
    shopName: '',
    ownerName: '',
    mobileNumber: '',
    address: '',
    deliveryLocation: '',
  });
  const [editFormErrors, setEditFormErrors] = useState<Partial<Record<keyof RetailerEditForm, string>>>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Load retailer profile details
  useEffect(() => {
    if (!id) return;
    setLoadingRetailer(true);
    retailersService
      .getById(id)
      .then((data) => {
        setRetailer(data);
        if (typeof data.outstanding === 'number') {
          setOutstanding(data.outstanding);
        }
      })
      .catch((err) => {
        const msg = err.response?.data?.message || err.message || 'Failed to load retailer profile.';
        setError(msg);
      })
      .finally(() => setLoadingRetailer(false));
  }, [id]);

  // Load paginated ledger entries
  useEffect(() => {
    if (!id) return;
    setLoadingLedger(true);
    const offset = (page - 1) * PAGE_SIZE;
    retailersService
      .getLedger(id, PAGE_SIZE, offset)
      .then((data) => {
        setLedgerEntries(data.entries || []);
        setTotalEntries(data.pagination?.total || 0);
        if (typeof data.outstanding === 'number') {
          setOutstanding(data.outstanding);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch ledger:', err);
      })
      .finally(() => setLoadingLedger(false));
  }, [id, page]);

  const openEditModal = () => {
    if (!retailer) return;
    setEditForm({
      shopName: retailer.shopName || '',
      ownerName: retailer.ownerName || '',
      mobileNumber: retailer.mobileNumber || '',
      address: retailer.address || '',
      deliveryLocation: retailer.deliveryLocation || '',
    });
    setEditFormErrors({});
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!retailer) return;
    const errors: Partial<Record<keyof RetailerEditForm, string>> = {};
    if (!editForm.shopName.trim()) errors.shopName = 'Shop name is required.';
    if (!editForm.ownerName.trim()) errors.ownerName = 'Owner name is required.';
    if (!editForm.mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required.';
    if (!editForm.address.trim()) errors.address = 'Address is required.';

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    setSubmittingEdit(true);
    try {
      const updated = await retailersService.update(retailer.id, {
        shopName: editForm.shopName.trim(),
        ownerName: editForm.ownerName.trim(),
        mobileNumber: editForm.mobileNumber.trim(),
        address: editForm.address.trim(),
        deliveryLocation: editForm.deliveryLocation.trim() || undefined,
      });

      setRetailer((prev) => (prev ? { ...prev, ...updated } : updated));
      store.addNotification('success', 'Retailer profile updated successfully');
      store.fetchRetailers();
      setIsEditModalOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to update retailer.';
      store.addNotification('error', msg);
    } finally {
      setSubmittingEdit(false);
    }
  };

  const totalPages = Math.ceil(totalEntries / PAGE_SIZE) || 1;

  if (loadingRetailer) {
    return (
      <Layout sidebarItems={ADMIN_SIDEBAR}>
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Loading retailer details…</p>
            </div>
          </div>
        </PageContainer>
      </Layout>
    );
  }

  if (error || !retailer) {
    return (
      <Layout sidebarItems={ADMIN_SIDEBAR}>
        <PageContainer>
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto my-8">
            <p className="text-red-700 font-semibold mb-2">Error Loading Retailer</p>
            <p className="text-sm text-red-500 mb-4">{error || 'Retailer not found.'}</p>
            <Button onClick={() => navigate('/admin/retailers')} variant="secondary">
              Back to Retailers List
            </Button>
          </div>
        </PageContainer>
      </Layout>
    );
  }

  const totalCratesOwed = retailer.rgbBalances?.reduce((sum, b) => sum + (b.balance || 0), 0) || 0;

  return (
    <Layout sidebarItems={ADMIN_SIDEBAR}>
      <PageContainer>
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/admin/retailers')}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Retailers
            </button>
            <span className="text-xs text-gray-400">
              Retailer ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{retailer.id.slice(0, 8)}</code>
            </span>
          </div>

          {/* Overview Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Shop Profile Details */}
            <Card className="md:col-span-1">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">{retailer.shopName}</h3>
                    <p className="text-xs text-gray-500">Retailer Profile</p>
                  </div>
                </div>
                <button
                  onClick={openEditModal}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Retailer Details"
                >
                  <Pencil size={16} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Owner:</span>
                  <span className="text-gray-900">{retailer.ownerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Phone:</span>
                  <a href={`tel:${retailer.mobileNumber}`} className="text-blue-600 hover:underline">
                    {retailer.mobileNumber}
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-700">Address: </span>
                    <span className="text-gray-900">{retailer.address}</span>
                    {retailer.deliveryLocation && (
                      <p className="text-gray-400 italic text-[11px] mt-0.5">
                        Note: {retailer.deliveryLocation}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Customer Since:</span>
                  <span className="text-gray-500">
                    {new Date(retailer.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>

            {/* Financial Summary */}
            <Card className="md:col-span-1">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Financial Ledger</h3>
                  <p className="text-xs text-gray-500">Outstanding Balance</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Net Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    ₨{Number(outstanding).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {outstanding > 0 ? 'Retailer owes pending balance' : 'No outstanding debt'}
                  </p>
                </div>
              </div>
            </Card>

            {/* RGB Crate Balances */}
            <Card className="md:col-span-1">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">RGB Crates Summary</h3>
                  <p className="text-xs text-gray-500">{totalCratesOwed} Total Crates Pending</p>
                </div>
              </div>

              {retailer.rgbBalances && retailer.rgbBalances.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {retailer.rgbBalances.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 text-xs"
                    >
                      <span className="font-medium text-gray-700 capitalize">
                        {b.rgbItem?.name || 'Crate Item'}
                      </span>
                      <span className={`font-semibold px-2 py-0.5 rounded-md ${b.balance > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'}`}>
                        {b.balance} crates
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl text-center text-xs text-gray-400 italic">
                  No empty crate balances recorded for this retailer.
                </div>
              )}
            </Card>
          </div>

          {/* Ledger Entries Table Card */}
          <Card title="Ledger Audit Statement">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-500">
                Double-entry transaction audit log detailing sales, payments, and balance adjustments.
              </p>
              {loadingLedger && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                  <RefreshCw size={12} className="animate-spin" />
                  Refreshing…
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase border-b border-gray-200 font-semibold">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Bill Ref</th>
                    <th className="py-3 px-4">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Running Balance</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledgerEntries.length > 0 ? (
                    ledgerEntries.map((entry) => {
                      const badge = ENTRY_TYPE_BADGES[entry.entryType.toLowerCase()] || {
                        bg: 'bg-gray-100',
                        text: 'text-gray-700',
                        label: entry.entryType,
                      };

                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleString('en-PK', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-gray-800">
                            {entry.bill?.billNumber ? `#${entry.bill.billNumber}` : '—'}
                          </td>
                          <td className="py-3 px-4 capitalize text-gray-600">
                            {entry.paymentMode ? entry.paymentMode.replace('_', ' ') : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">
                            ₨{Number(entry.amount).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            ₨{Number(entry.balance).toLocaleString('en-PK', { minimumFractionDigits: 0 })}
                          </td>
                          <td className="py-3 px-4 text-gray-500 max-w-xs truncate">
                            {entry.notes || '—'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 italic">
                        {loadingLedger ? 'Loading statement…' : 'No ledger transactions recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalEntries > 0 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 text-xs">
                <p className="text-gray-500">
                  Showing <span className="font-semibold text-gray-700">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
                  <span className="font-semibold text-gray-700">{Math.min(page * PAGE_SIZE, totalEntries)}</span> of{' '}
                  <span className="font-semibold text-gray-700">{totalEntries}</span> entries
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page === 1 || loadingLedger}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-gray-600"
                  >
                    <ChevronLeft size={14} />
                    Previous
                  </button>

                  <span className="px-2 font-medium text-gray-600">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page >= totalPages || loadingLedger}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-gray-600"
                  >
                    Next
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </PageContainer>

      {/* Edit Retailer Details Modal */}
      <Modal
        isOpen={isEditModalOpen}
        title="Edit Retailer Details"
        onClose={() => setIsEditModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold rounded-lg py-2.5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={submittingEdit}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              {submittingEdit ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Shop Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.shopName ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.shopName}
              onChange={(e) => setEditForm({ ...editForm, shopName: e.target.value })}
              placeholder="e.g. Al-Madina Traders"
            />
            {editFormErrors.shopName && <p className="text-red-500 text-xs mt-1">{editFormErrors.shopName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Owner Name <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.ownerName ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.ownerName}
              onChange={(e) => setEditForm({ ...editForm, ownerName: e.target.value })}
              placeholder="e.g. Muhammad Ali"
            />
            {editFormErrors.ownerName && <p className="text-red-500 text-xs mt-1">{editFormErrors.ownerName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Mobile Number <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.mobileNumber ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.mobileNumber}
              onChange={(e) => setEditForm({ ...editForm, mobileNumber: e.target.value })}
              placeholder="e.g. 03001234567"
            />
            {editFormErrors.mobileNumber && <p className="text-red-500 text-xs mt-1">{editFormErrors.mobileNumber}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 ${
                editFormErrors.address ? 'border-red-400' : 'border-gray-200'
              }`}
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              placeholder="e.g. Shop #12, Main Bazaar, Lahore"
            />
            {editFormErrors.address && <p className="text-red-500 text-xs mt-1">{editFormErrors.address}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Delivery Directions / Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              value={editForm.deliveryLocation}
              onChange={(e) => setEditForm({ ...editForm, deliveryLocation: e.target.value })}
              placeholder="e.g. Near Bus Stop"
            />
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
