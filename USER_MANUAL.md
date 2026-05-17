# QRA — QR Code Restaurant Ordering System
## User Manual

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Getting Started](#2-getting-started)
3. [Customer Guide — Dine-In](#3-customer-guide--dine-in)
4. [Customer Guide — Takeaway](#4-customer-guide--takeaway)
5. [Admin Guide](#5-admin-guide)
   - 5.1 [Dashboard](#51-dashboard)
   - 5.2 [Orders Management](#52-orders-management)
   - 5.3 [Menu Management](#53-menu-management)
   - 5.4 [Categories](#54-categories)
   - 5.5 [Tables & QR Codes](#55-tables--qr-codes)
   - 5.6 [Bills & Payments](#56-bills--payments)
   - 5.7 [Users Management](#57-users-management)
   - 5.8 [Settings](#58-settings)
6. [Kitchen Staff Guide](#6-kitchen-staff-guide)
7. [Super Admin Guide](#7-super-admin-guide)
8. [Push Notifications](#8-push-notifications)
9. [Roles & Permissions Summary](#9-roles--permissions-summary)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. System Overview

**QRA** is a web-based restaurant ordering system that allows customers to browse the menu and place orders by scanning a QR code at their table — no app download required.

### How it works

```
Customer scans QR code
        ↓
Browses digital menu on phone
        ↓
Adds items to cart & places order
        ↓
Kitchen receives order instantly
        ↓
Admin tracks, prepares & serves
        ↓
Admin generates bill & marks paid
```

### User Roles

| Role | Who uses it | Access |
|------|-------------|--------|
| **Customer** | Restaurant guests | Menu, Cart, Order history |
| **Admin** | Restaurant manager/owner | Full restaurant management |
| **Kitchen** | Kitchen staff | Kitchen display only |
| **Super Admin** | Platform owner (you) | All restaurants |

---

## 2. Getting Started

### Accessing the System

| Page | URL |
|------|-----|
| Customer menu (via QR) | Scanned automatically |
| Staff login | `https://your-domain.com/login` |
| Admin panel | `https://your-domain.com/admin` |
| Kitchen display | `https://your-domain.com/kitchen` |

### Logging In (Staff)

1. Open your browser and go to `/login`
2. Enter your **Username** and **Password**
3. Click **Login**
4. You will be automatically redirected based on your role:
   - **Admin / Super Admin** → Admin Dashboard
   - **Kitchen** → Kitchen Display

### Default Super Admin Credentials

> ⚠️ Change these immediately after first login!

| Field | Value |
|-------|-------|
| Username | `superadmin` |
| Password | `super123` |

To change: Go to **Admin → Settings → Change Password**

---

## 3. Customer Guide — Dine-In

### Step 1 — Scan the QR Code

Each table has a unique QR code printed on it. Customers use their phone camera to scan it. This opens the restaurant menu directly in the browser — no app download needed.

### Step 2 — Browse the Menu

- The menu is organized by **categories** (e.g., Starters, Main Course, Desserts, Drinks)
- Tap a category to filter items
- Each item shows:
  - Name & description
  - Price
  - Discounted price (if a discount is applied, shown in red with original price crossed out)
  - Photo (if uploaded)
  - Availability status

### Step 3 — Add Items to Cart

1. Tap the **+** button on any item to add it to the cart
2. Optionally tap the item to add a **special note** (e.g., "no onions", "extra spicy")
3. Use **+** / **−** to adjust quantity
4. Tap the cart icon or **View Cart** button to review your order

### Step 4 — Review Cart & Place Order

1. Review all items, quantities, and notes
2. Adjust or remove items if needed
3. Tap **Place Order**
4. You will see an **Order Confirmation** page with your Order ID

### Step 5 — Track Your Order

- After placing the order, you can see its current status:
  - **Pending** — Received, waiting to be prepared
  - **Preparing** — Kitchen is cooking your order
  - **Ready** — Order is ready to be served
  - **Served** — Order has been delivered to your table
- Tap **Order History** to see all orders placed from your table during your visit

### Ordering More Items

You can place **multiple orders** during your visit. Each new order is added to your table's running bill, which the admin can view and print when you're ready to pay.

---

## 4. Customer Guide — Takeaway

### Step 1 — Scan the Takeaway QR Code

The restaurant has a separate **Takeaway QR code** (usually displayed at the counter). Scan it with your phone.

### Step 2 — Browse & Add to Cart

Same as dine-in — browse categories, add items, add notes.

### Step 3 — Place the Order

1. Review your cart
2. Enter your **Name** (so the kitchen can call you when ready)
3. Tap **Place Order**
4. You'll receive an Order Confirmation

---

## 5. Admin Guide

Access the admin panel at `/admin` after logging in.

---

### 5.1 Dashboard

The dashboard is your home screen showing a quick overview:

| Stat | What it shows |
|------|---------------|
| Today's Orders | Total orders placed today |
| Active Orders | Orders currently being processed |
| Today's Revenue | Total revenue from completed orders today |

From the dashboard you can quickly navigate to Orders, Menu, Tables, and Bills.

---

### 5.2 Orders Management

**Path:** Admin → Orders

This is the real-time order management screen. It auto-refreshes every few seconds.

#### Status Tabs

| Tab | Shows |
|-----|-------|
| **All** | Every order |
| **Takeaway** | Takeaway orders only |
| **Pending** | New orders waiting to be prepared |
| **Preparing** | Orders in the kitchen |
| **Ready** | Orders ready to serve |
| **Served** | Completed orders |

#### Managing an Order

1. Find the order card — it shows table number (or customer name for takeaway), items, total, and time
2. Click the **status button** to advance the order:
   - Pending → **Start Preparing**
   - Preparing → **Mark Ready**
   - Ready → **Mark Served**
3. Click the **print icon** to print a receipt for that individual order

#### Manual Order

You can manually place an order on behalf of a customer:
1. Click **New Order**
2. Select the table (for dine-in) or enter customer name (for takeaway)
3. Add items and quantities
4. Submit

---

### 5.3 Menu Management

**Path:** Admin → Menu

#### Adding a New Menu Item

1. Click **Add Item**
2. Fill in the details:

| Field | Description |
|-------|-------------|
| **Name** | Item name (e.g., "Grilled Chicken Burger") |
| **Description** | Short description (optional) |
| **Category** | Select from existing categories |
| **Price** | Full price in your currency |
| **Discount %** | Enter 0–100 to apply a discount (e.g., 10 = 10% off) |
| **Available** | Toggle on/off to show or hide the item on the customer menu |
| **Image** | Upload a photo (JPEG/PNG, max 5MB) |

3. Click **Save**

> 💡 The effective (discounted) price is calculated automatically. Customers see both the original and discounted price.

#### Editing a Menu Item

1. Find the item in the list
2. Click the **edit (pencil) icon**
3. Update any fields
4. Click **Save**

#### Deleting a Menu Item

1. Click the **delete (trash) icon** on the item
2. Confirm the deletion

> ⚠️ Deleting an item does not affect past orders — historical order records are preserved.

#### Toggling Availability

Click the **Available** toggle on any item to instantly show or hide it from the customer menu without deleting it. Useful for items that are temporarily sold out.

---

### 5.4 Categories

**Path:** Admin → Menu (Categories section)

Categories organize your menu (e.g., Starters, Mains, Drinks, Desserts).

#### Adding a Category

1. In the Categories panel, type the category name
2. Click **Add**

#### Renaming a Category

1. Click the **edit icon** next to the category name
2. Type the new name
3. Press Enter or click Save

#### Deleting a Category

1. Click the **delete icon** next to the category
2. Confirm

> ⚠️ You cannot delete a category that has menu items assigned to it. Reassign or delete those items first.

---

### 5.5 Tables & QR Codes

**Path:** Admin → Tables

#### Adding a Table

1. Click **Add Table**
2. Enter:
   - **Table Number** (e.g., 1, 2, 3…)
   - **Seats** (number of seats at the table)
3. Click **Save**

A unique QR code is generated automatically for each table.

#### Editing a Table

Click the **edit icon** to update the table number or seat count.

#### Deleting a Table

Click the **delete icon** and confirm. The QR code for that table will no longer work.

#### Printing QR Codes

| Option | How |
|--------|-----|
| Print one table's QR | Click the **print icon** on that table row |
| Print all QR codes | Click **Print All QR Codes** button |

> 💡 Print QR codes and laminate them for each table. When customers scan, they land directly on that table's menu page.

#### Takeaway QR Code

At the bottom of the Tables page, there is a **Takeaway QR Code**:
- This is a single QR code for walk-in/takeaway customers
- Print and display it at the counter
- Click **Print Takeaway QR** to print it

#### Activating / Deactivating Tables

Toggle the **Active** switch on any table to enable or disable it. Inactive tables will not accept new orders.

---

### 5.6 Bills & Payments

**Path:** Admin → Bills

This screen manages table sessions (the full visit of a customer/group, which may include multiple orders).

#### Understanding Sessions

When a customer scans a QR code and places their first order, a **session** is created for that table. All subsequent orders from the same table are grouped into the same session until you mark it as **Paid**.

#### Viewing a Bill

1. Find the table in the **Open Sessions** list
2. Click the table row to expand the bill
3. The bill shows:
   - All items from all orders during the session
   - Subtotal
   - Service charge (if configured)
   - Tax (if configured)
   - **Grand Total**

#### Printing a Bill

1. Open the session
2. Click **Print Bill** — a print-ready receipt opens in a new tab

#### Marking as Paid

1. Open the session
2. Click **Mark as Paid**
3. Confirm — the table session closes and moves to **Paid History**

> After marking as paid, the table is ready to accept a new session from the next customer.

#### Viewing Payment History

Click the **Paid** tab to see all past paid sessions with their totals and timestamps.

---

### 5.7 Users Management

**Path:** Admin → Users

Manage your restaurant staff accounts.

#### Creating a New User

1. Click **Add User**
2. Fill in:

| Field | Description |
|-------|-------------|
| **Name** | Full name of the staff member |
| **Username** | Login username (must be unique) |
| **Password** | Initial password |
| **Role** | Admin or Kitchen |

3. Click **Save**
4. Share the username and password with the staff member and ask them to change it on first login

#### Roles Explained

| Role | What they can access |
|------|---------------------|
| **Admin** | Full admin panel — orders, menu, tables, bills, users, settings |
| **Kitchen** | Kitchen display only — cannot access admin panel |

#### Editing a User

Click the **edit icon** to update name, username, password, or role.

#### Deleting a User

Click the **delete icon** and confirm.

> ⚠️ You cannot delete your own account.

---

### 5.8 Settings

**Path:** Admin → Settings

#### Update Your Profile

1. Update your **Name**, **Username**, or **Password**
2. Click **Save Changes**

#### Service Charge & Tax

Configure charges that are automatically added to bills:

| Setting | Description |
|---------|-------------|
| **Service Charge %** | Added to dine-in bills only (e.g., 10 for 10%) |
| **Tax %** | Added to all orders (e.g., 8 for 8%) |

1. Enter the percentages
2. Click **Save** — a live preview shows how the charges affect a sample bill
3. These percentages apply to all future bills for your restaurant

#### Logging Out

Click **Logout** in the top-right corner or in the Settings page.

---

## 6. Kitchen Staff Guide

**Path:** `/kitchen` (auto-redirected after login)

The Kitchen Display System (KDS) is designed for kitchen screens — it uses a dark theme and large text for easy reading.

### Screen Layout

- Shows **Pending** and **Preparing** orders side by side
- Each order card shows:
  - Table number (or customer name for takeaway)
  - Order type (Dine-In / Takeaway)
  - List of items with quantities and notes
  - Time since order was placed
  - Current status

### Processing an Order

| Action | Button |
|--------|--------|
| Start cooking | **Start Preparing** (moves from Pending → Preparing) |
| Mark as ready | **Ready** (moves from Preparing → Ready) |

> Once marked **Ready**, it disappears from the kitchen screen. The admin then marks it as **Served** after delivering to the table.

### Auto-Refresh

The kitchen screen automatically refreshes every few seconds. New orders appear instantly without needing to reload the page.

### Push Notifications

If you enable push notifications in your browser, you will receive a notification on your device every time a new order is placed — even if the browser is in the background.

To enable:
1. When prompted by the browser, click **Allow** for notifications
2. Notifications will show the table number, item count, and total

---

## 7. Super Admin Guide

The Super Admin manages the entire platform and can create multiple restaurants.

### Accessing the Super Admin Panel

Log in with super admin credentials → you are redirected to **Admin → Restaurants**.

---

### Managing Restaurants

**Path:** Admin → Restaurants

#### Creating a New Restaurant

1. Click **Add Restaurant**
2. Fill in:

| Field | Description |
|-------|-------------|
| **Restaurant Name** | Display name of the restaurant |
| **Admin Username** | Login username for the restaurant's admin |
| **Admin Password** | Initial password for the admin |
| **Admin Name** | Full name of the admin |

3. Click **Create** — the restaurant and its initial admin account are created

#### Viewing Restaurant Details

Click a restaurant row to expand:
- Restaurant name and active status
- List of all users (admin + kitchen staff) in that restaurant

#### Editing a Restaurant Name

Click the **edit icon** next to the restaurant name and update it.

#### Activating / Deactivating a Restaurant

Toggle the **Active** switch:
- **Active ON** — Restaurant is live; staff can log in, customers can order
- **Active OFF** — Restaurant is suspended; all logins are blocked

#### Impersonating a User

The impersonate feature lets you log in as any user in any restaurant for support or debugging:

1. Expand the restaurant
2. Find the user in the list
3. Click **Impersonate**
4. You are now logged in as that user with their full access
5. To return to super admin: log out and log back in with your super admin credentials

> ⚠️ Use impersonation only for legitimate support purposes.

---

## 8. Push Notifications

Push notifications alert kitchen staff and admins when new orders arrive.

### Enabling Notifications (Staff)

1. Log in to the admin or kitchen panel
2. Your browser will ask for notification permission — click **Allow**
3. Notifications are now active for your device

### What Triggers a Notification

- A customer places a new dine-in order
- A customer places a new takeaway order

### Notification Content

```
🍽️ New Order — Table 5
3 items · $24.50
```

### Disabling Notifications

Go to **Settings → Notifications** or use your browser's site settings to revoke notification permission.

---

## 9. Roles & Permissions Summary

| Feature | Customer | Kitchen | Admin | Super Admin |
|---------|----------|---------|-------|-------------|
| Browse menu | ✓ | — | ✓ | ✓ |
| Place order | ✓ | — | ✓ | ✓ |
| View order history | ✓ | — | ✓ | ✓ |
| Kitchen display | — | ✓ | ✓ | ✓ |
| Update order status | — | ✓ | ✓ | ✓ |
| Manage menu items | — | — | ✓ | ✓ |
| Manage categories | — | — | ✓ | ✓ |
| Manage tables | — | — | ✓ | ✓ |
| Generate QR codes | — | — | ✓ | ✓ |
| View & print bills | — | — | ✓ | ✓ |
| Mark table as paid | — | — | ✓ | ✓ |
| Manage staff users | — | — | ✓ | ✓ |
| Configure charges | — | — | ✓ | ✓ |
| Create restaurants | — | — | — | ✓ |
| Deactivate restaurant | — | — | — | ✓ |
| Impersonate users | — | — | — | ✓ |

---

## 10. Troubleshooting

### Customers

| Problem | Solution |
|---------|----------|
| QR code doesn't open | Check internet connection; ask staff to verify the table is active |
| Menu items not showing | The item may be marked unavailable; contact staff |
| Order placed but nothing happened | Wait a moment and refresh; if nothing, ask staff to check |
| Can't see my previous orders | Order history is specific to the table — try the same table QR |

---

### Admin & Kitchen Staff

| Problem | Solution |
|---------|----------|
| Can't log in | Check username/password; ensure Caps Lock is off; contact super admin |
| Restaurant says "inactive" | Super admin has suspended the restaurant; contact platform support |
| Orders not appearing | Refresh the page; check internet connection |
| Kitchen display is empty | No pending/preparing orders at this time |
| Image upload fails | Check file is JPG/PNG and under 5MB; check internet connection |
| Bill totals look wrong | Verify service charge and tax % in Settings |
| Push notifications not working | Check browser notification permissions; re-enable in browser settings |

---

### Super Admin

| Problem | Solution |
|---------|----------|
| Can't create restaurant | Check all required fields are filled; username must be unique |
| Impersonate not working | Refresh and try again; check the target user account exists |
| Backend is slow to respond | Render free tier sleeps after 15 min — first request after inactivity takes ~30 seconds |

---

## Quick Reference Card

### Staff Login URLs
```
Admin Panel:    https://your-domain.com/login
Kitchen:        Automatic after login with Kitchen role
```

### Order Status Flow
```
Pending → Preparing → Ready → Served
```

### Bill Flow
```
Customer scans QR → Places order(s) → Admin prints bill → Admin marks Paid
```

### QR Code Setup
```
1. Admin → Tables → Add tables
2. Print QR codes
3. Place QR codes on tables
4. Customers scan to order
```

---

*QRA Restaurant Ordering System — User Manual*
*For technical support, contact your system administrator.*
