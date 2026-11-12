import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy Admin entry point — the monolithic 1,669-line Admin page has been
 * decomposed into nested routes under `src/admin/AdminLayout.tsx` and `src/admin/pages/*`.
 */
export const Admin: React.FC = () => <Navigate to="/admin/dashboard" replace />;
