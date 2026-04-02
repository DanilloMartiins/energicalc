function sendSuccess(res, statusCode, data) {
  return res.status(statusCode).json({
    success: true,
    data
  });
}

function sendError(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    error: {
      message
    }
  });
}

module.exports = {
  sendSuccess,
  sendError
};
