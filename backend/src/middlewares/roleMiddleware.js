import { sendError } from '../utils/apiResponse.js';

/**
 * Middleware factory to enforce role-based access control.
 * Admins automatically satisfy any staff role requirement.
 * 
 * @param  {...string} allowedRoles Allowed roles (e.g. 'admin', 'coordinator', 'support', 'guide', 'customer')
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required before checking permissions', 401);
    }

    const userRole = req.user.role;

    // Admin has superuser access to all staff-protected endpoints
    if (userRole === 'admin') {
      return next();
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    return sendError(
      res,
      `Forbidden: Access requires one of [${allowedRoles.join(', ')}] role(s). Current role: "${userRole}"`,
      403
    );
  };
};

/**
 * Shorthand role middlewares for common role sets
 */
export const requireCustomer = requireRoles('customer');
export const requireCoordinator = requireRoles('coordinator');
export const requireSupport = requireRoles('support');
export const requireGuide = requireRoles('guide');
export const requireOperator = requireRoles('operator');
export const requireStaff = requireRoles('coordinator', 'support', 'guide', 'admin');
export const requireOperatorOrStaff = requireRoles('operator', 'coordinator', 'support', 'guide', 'admin');
export const requireAdminOnly = requireRoles('admin');
