function toNumber(value) {
  return Number(value);
}

function isValidNumber(value) {
  return Number.isFinite(value);
}

function isPositive(value) {
  return value > 0;
}

module.exports = {
  toNumber,
  isValidNumber,
  isPositive
};
