# Beverage POS System

A comprehensive **Wholesale & Retail Beverage Management System** built with **React** and **Tailwind CSS**. Designed for shopkeepers and wholesalers dealing in soft drinks, juices, water, and related FMCG products.

## 🎯 Purpose

This system prioritizes simplicity for shop workers (PC-based) and control/visibility for owners or admins (mobile-ready). It supports:

- ✅ Inventory tracking by PET-equivalent units
- ✅ Credit (Udhari) management
- ✅ Worker accountability
- ✅ Profit analysis
- ✅ Automated billing with print support
- ✅ Price variance tracking
- ✅ Role-based access control
- ✅ Dynamic, Image-Centric UI

## 👥 User Roles

### Admin (Owner/Manager)

- Full access to all modules
- Can use PC or mobile app
- Controls pricing, stock, workers, reports
- Inventory management
- Retailer credit management
- Advanced reporting & analytics

### Worker (Shop/Warehouse Staff)

- PC-only access (can be extended to mobile)
- Create sales bills
- Select products & quantities
- **Cannot:** Change prices, edit past bills, view reports

## 🏗️ Project Structure

```
src/
├── components/
│   ├── common/           # Reusable UI components (Button, Input, Card, etc.)
│   └── Layout/           # Main layout with sidebar
├── pages/
│   ├── auth/            # LoginPage
│   ├── worker/          # SalesPage
│   └── admin/           # Dashboard, Inventory, Retailers, Reports
├── store/               # Zustand state management
├── types/               # TypeScript interfaces
├── App.tsx              # Main app with routing
├── index.css            # Global Tailwind styles
└── main.tsx             # React DOM entry
public/
└── images/              # Product brand images (pepsi.png, dew.png, etc.)
```

## 🚀 Features Implemented

### 1. **Authentication**

- Role-based login (Admin / Worker)
- Demo credentials included

### 2. **Worker Module**

- Sales bill creation
- Brand-first drill-down UI with images
- PET-based quantity management
- Price override during billing
- Cart management
- Print preview

### 3. **Admin Dashboard**

- Real-time sales metrics
- Today's sales, retailer count, product inventory
- Low stock and expiry alerts
- Recent bill activity
- Credit limit monitoring

### 4. **Inventory Management**

- Add stock with batch tracking
- Expiry date monitoring
- Stock adjustments (damage, theft, corrections)
- FIFO-ready structure
- Stock value calculations

### 5. **Retailer Management (CRM)**

- Complete retailer profiles
- Credit limit tracking
- Price tier management (Standard, Premium, Discount)
- RGB (crate) tracking
- Ledger integration

### 6. **Reporting & Analytics**

- Sales trends (Daily, Weekly, Monthly, Yearly)
- Product performance reports
- Worker performance tracking
- **Price Variance Flagging** - Automatic detection of below-default sales
- Credit & ledger analytics
- Export to CSV (ready)

### 7. **Security & Audit**

- Role-based access control
- Bill audit trail
- Price change history
- Voided bill logging
- All changes timestamped

## 📦 Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation Steps

```bash
# Navigate to project directory
cd POS

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The app will be available at `http://localhost:3000`

## 📝 Demo Credentials

### Admin Account

```
Email: admin@pos.com
Password: admin123
```

### Worker Account

```
Email: worker@pos.com
Password: worker123
```

## 🎨 UI/UX Features

- Clean, modern interface with Tailwind CSS
- Responsive design (works on tablets/mobiles)
- Brand-first product selection with image cards
- Dark mode ready (theme system in place)
- Intuitive navigation with sidebar menu
- Real-time notifications
- Modal dialogs for forms
- Data tables with sorting capability
- Progress bars for credit usage
- Color-coded status indicators

## 🧮 Key Business Logic

### PET (Bottle Equivalent Unit) System

All stock is managed in PET units internally:

- Pepsi 1.5L → 12 bottles = 1 PET
- Can pack → 24 cans = 1 PET
- Water 5L → 4 bottles = 1 PET

### Credit Management

- Automatic ledger per retailer
- Outstanding balance tracking
- Payment mode support (Cash, Bank Transfer)
- Credit limit alerts
- Over-credit warnings

### Pricing Tiers

- **Standard**: Regular retail price
- **Premium**: Discounted rate for bulk orders
- **Discount**: Special bulk pricing

### Stock Tracking

- Batch-based management
- Expiry date alerts
- Low stock warnings
- Multiple adjustment reasons
- Full audit trail

## 🔐 Security Features

- Role-based access control (RBAC)
- Protected routes
- Session management
- Bill immutability (no deletion)
- Comprehensive audit logs
- Price variance detection
- Worker accountability tracking

## 📊 Reports Available

1. **Sales Report** - Daily, Weekly, Monthly, Yearly summaries
2. **Product Performance** - Fast-moving vs slow-moving products
3. **Worker Performance** - Sales, discounts, accountability
4. **Price Variance** - Below-minimum price sales (flagged)
5. **Credit Report** - Outstanding balances, payment history
6. **Expiry Risk** - Products approaching expiry
7. **Voided Bills** - Cancelled bill audit

## 🎯 Future Enhancements

- 📱 Mobile admin app for iOS/Android
- 🔌 Barcode scanning support
- 📱 WhatsApp bill sharing
- 📲 SMS payment reminders
- 💰 GST/Tax module
- 📦 RGB/Crate management enhancement
- ☁️ Cloud sync & backup
- 📊 Advanced BI dashboards
- 🔔 Push notifications

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS 3
- **State Management**: Zustand
- **Routing**: React Router v6
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Date Handling**: date-fns

## 📱 Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## 🐛 Known Limitations

- Currently uses mock data (ready to connect to real API)
- Local storage not implemented (add persistence)
- Print functionality is preview only
- No offline mode yet
- Mobile optimization needed for some views

## 📝 Development Notes

### Adding a New Feature

1. Define types in `src/types/index.ts`
2. Create component in appropriate folder under `src/components/` or `src/pages/`
3. Add store actions if needed in `src/store/index.ts`
4. Wire up routing in `src/App.tsx`
5. Use common components from `src/components/common/`

### State Management

Using Zustand for global state:

- Current user
- Retailers
- Products
- Stock
- Bills
- Notifications

### Styling

- Tailwind CSS for all styling
- Custom utility classes in `src/index.css`
- Component-level CSS via className

## 🤝 Contributing

This is a demonstration project. For modifications:

1. Follow React best practices
2. Maintain type safety
3. Use Tailwind utilities
4. Keep components small and reusable

## 📄 License

This project is for educational/commercial use. Modify as needed.

## 📞 Support

For questions or issues, review the code documentation and component PropTypes.

---

**Last Updated**: February 2026
**Version**: 1.1.0
