import crypto from 'crypto';

/**
 * Generates a unique, collision-resistant booking reference in format:
 * LKB-YYYYMMDD-XXXX
 * Example: LKB-20261015-8F3A
 */
export const generateBookingReference = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateSegment = `${year}${month}${day}`;
  
  // 4 random alphanumeric characters in uppercase
  const randomSegment = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `LKB-${dateSegment}-${randomSegment}`;
};
