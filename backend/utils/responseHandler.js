/**
 * Standardized API Response Envelope
 * Complies with requirement 32 while preserving backward compatibility.
 */
const response = (res, statusCode, message, data = null, error = null) => {
  if (!res) {
    console.error("Response object is null");
    return;
  }

  const isSuccess = statusCode >= 200 && statusCode < 400;

  const responseObject = {
    success: isSuccess,
    status: isSuccess ? "success" : "error", // backward-compatibility with older frontend calls
    message: message || (isSuccess ? "Operation successful" : "Operation failed"),
    data: data !== undefined ? data : null,
    error: error || (isSuccess ? null : message),
  };

  return res.status(statusCode).json(responseObject);
};

module.exports = response;
