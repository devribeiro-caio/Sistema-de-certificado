function normalizeOrderNumber(value) {
  return String(value || '').trim().toUpperCase();
}

function certificateScope(user) {
  return user.role === 'CLIENT' ? { customer: user.customer } : {};
}

module.exports = { normalizeOrderNumber, certificateScope };
