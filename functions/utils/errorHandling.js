/**
 * Unified error handling utilities for SUNDOWNER
 * Provides consistent error responses across all API routes
 */

// Error type constants
export const ErrorTypes = {
  // Client errors (4xx)
  INVALID_REQUEST: 'invalid_request_error',
  AUTHENTICATION_ERROR: 'authentication_error',
  PERMISSION_DENIED: 'permission_denied',
  NOT_FOUND: 'not_found_error',
  CONFLICT: 'conflict_error',
  RATE_LIMIT: 'rate_limit_error',

  // Server errors (5xx)
  INTERNAL_ERROR: 'internal_server_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  DATABASE_ERROR: 'database_error',
  EXTERNAL_SERVICE_ERROR: 'external_service_error',
};

// Error code to HTTP status mapping
const ERROR_STATUS_MAP = {
  [ErrorTypes.INVALID_REQUEST]: 400,
  [ErrorTypes.AUTHENTICATION_ERROR]: 401,
  [ErrorTypes.PERMISSION_DENIED]: 403,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.CONFLICT]: 409,
  [ErrorTypes.RATE_LIMIT]: 429,
  [ErrorTypes.INTERNAL_ERROR]: 500,
  [ErrorTypes.SERVICE_UNAVAILABLE]: 503,
  [ErrorTypes.DATABASE_ERROR]: 500,
  [ErrorTypes.EXTERNAL_SERVICE_ERROR]: 502,
};

/**
 * Create a standardized error response
 * @param {string} type - Error type from ErrorTypes
 * @param {string} message - Human-readable error message
 * @param {object} details - Optional additional error details
 * @param {object} options - Optional response options (status, headers)
 * @returns {Response}
 */
export function createErrorResponse(type, message, details = null, options = {}) {
  const status = options.status || ERROR_STATUS_MAP[type] || 500;

  const errorBody = {
    error: {
      type,
      message,
      ...(details && { details }),
    },
  };

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...options.headers,
  };

  return new Response(JSON.stringify(errorBody), {
    status,
    headers,
  });
}

/**
 * Wrap an async handler with error handling
 * @param {Function} handler - Async handler function
 * @returns {Function} - Wrapped handler
 */
export function withErrorHandling(handler) {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      console.error('Handler error:', error);

      // Check if it's already a Response (e.g., from createErrorResponse)
      if (error instanceof Response) {
        return error;
      }

      // Check for known error types
      if (error.name === 'DatabaseError' || error.message?.includes('D1')) {
        return createErrorResponse(
          ErrorTypes.DATABASE_ERROR,
          'Database operation failed',
          { originalError: error.message }
        );
      }

      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        return createErrorResponse(
          ErrorTypes.RATE_LIMIT,
          'Too many requests',
          { originalError: error.message }
        );
      }

      // Default to internal server error
      return createErrorResponse(
        ErrorTypes.INTERNAL_ERROR,
        'An unexpected error occurred',
        process.env.NODE_ENV === 'development' ? { stack: error.stack } : null
      );
    }
  };
}

/**
 * Create a validation error response
 * @param {string} field - Field that failed validation
 * @param {string} message - Validation error message
 * @returns {Response}
 */
export function createValidationError(field, message) {
  return createErrorResponse(
    ErrorTypes.INVALID_REQUEST,
    'Validation failed',
    { field, validation: message }
  );
}

/**
 * Create a not found error response
 * @param {string} resource - Resource type that was not found
 * @param {string} identifier - Resource identifier
 * @returns {Response}
 */
export function createNotFoundError(resource, identifier = null) {
  const message = identifier
    ? `${resource} '${identifier}' not found`
    : `${resource} not found`;

  return createErrorResponse(ErrorTypes.NOT_FOUND, message);
}

/**
 * Create an authentication error response
 * @param {string} message - Optional custom message
 * @returns {Response}
 */
export function createAuthError(message = 'Authentication required') {
  return createErrorResponse(ErrorTypes.AUTHENTICATION_ERROR, message);
}

/**
 * Create a permission denied error response
 * @param {string} action - Action that was denied
 * @returns {Response}
 */
export function createPermissionError(action = 'perform this action') {
  return createErrorResponse(
    ErrorTypes.PERMISSION_DENIED,
    `You don't have permission to ${action}`
  );
}

/**
 * Log error with context
 * @param {Error} error - The error object
 * @param {object} context - Additional context (request, user, etc.)
 */
export function logError(error, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  };

  console.error('Error:', JSON.stringify(logEntry, null, 2));

  // TODO: Send to Sentry or other error tracking service
  // if (context.env?.SENTRY_DSN) {
  //   sendToSentry(logEntry);
  // }
}

/**
 * Check if response is an error response
 * @param {Response} response
 * @returns {boolean}
 */
export function isErrorResponse(response) {
  return response.status >= 400;
}

/**
 * Extract error details from response
 * @param {Response} response
 * @returns {Promise<object|null>}
 */
export async function getErrorDetails(response) {
  if (!isErrorResponse(response)) {
    return null;
  }

  try {
    const body = await response.json();
    return body.error || null;
  } catch {
    return { type: 'unknown', message: response.statusText };
  }
}
