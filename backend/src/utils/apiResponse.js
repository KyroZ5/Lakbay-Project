/**
 * Standardized API response utilities for Lakbay backend
 */

export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const responsePayload = {
    success: false,
    message,
  };

  if (errors !== null && errors !== undefined) {
    responsePayload.errors = errors;
  }

  return res.status(statusCode).json(responsePayload);
};

/**
 * Build an Error carrying an HTTP status, so validation failures thrown inside
 * Firestore transactions reach the errorHandler as 4xx instead of 500.
 */
export const httpError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};
