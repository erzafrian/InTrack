function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function error(res, message, statusCode = 400, details = null) {
  const payload = { success: false, error: message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
}

module.exports = { success, error };
