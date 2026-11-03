import crypto from 'crypto';
import { todayInManila } from './dates.js';

/**
 * Generates a unique, collision-resistant booking reference in format:
 * LKB-YYYYMMDD-XXXX
 * Example: LKB-20261015-8F3A
 */
export const generateBookingReference = () => {
  // Business date (Asia/Manila), not the server-local date
  const dateSegment = todayInManila().replace(/-/g, '');
  
  // 4 random alphanumeric characters in uppercase
  const randomSegment = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `LKB-${dateSegment}-${randomSegment}`;
};
