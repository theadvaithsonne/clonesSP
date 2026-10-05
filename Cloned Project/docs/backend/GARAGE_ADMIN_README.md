# Garage Admin Module

A separate administrative system for managing garage operations with its own authentication and user management.

## Features

- **Separate Authentication**: Independent OTP-based login system
- **Role-based Access**: Super Admin and Admin roles
- **Admin Management**: Invite, activate/deactivate admins
- **Secure Access**: Token-based authentication with JWT
- **Modern UI**: Clean, professional admin interface

## Backend Components

### Models

- `GarageAdmin` - Admin user model with roles and permissions

### Controllers

- `garageAdmin.controller.ts` - Handles admin operations (invite, login, management)

### Routes

- `/garage-admin/request-otp` - Request OTP for login
- `/garage-admin/login` - Verify OTP and login
- `/garage-admin/profile` - Get admin profile
- `/garage-admin/admins` - List all admins
- `/garage-admin/invite` - Invite new admin (Super Admin only)
- `/garage-admin/admins/:id/toggle` - Toggle admin status (Super Admin only)

### Middleware

- `garageAdminAuth.ts` - Authentication middleware for garage admin routes

## Frontend Components

### Pages

- `/garage-admin/login` - Admin login with OTP
- `/garage-admin/dashboard` - Admin dashboard with management features
- `/garage-admin` - Root redirect page

### Features

- **Login Page**: Clean OTP-based authentication
- **Dashboard**: Admin management interface with:
  - Admin statistics
  - Invite new admins (Super Admin only)
  - View all admins
  - Toggle admin status
  - Role-based UI elements

## Initialization

The system automatically initializes `shorupan@gmail.com` as a Super Admin when the backend starts.

## Security

- Separate token system from regular users
- Role-based permissions
- OTP-based authentication
- Secure admin management

## Usage

1. Navigate to `/garage-admin/login`
2. Enter admin email to receive OTP
3. Verify OTP to access dashboard
4. Super Admins can invite new admins
5. Manage admin accounts and permissions

## Integration

The garage admin system is completely separate from the regular user system and doesn't interfere with existing functionality.
