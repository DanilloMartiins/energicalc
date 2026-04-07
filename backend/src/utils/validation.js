function isRequired(value) {
  return !(
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  );
}

function hasRequiredFields(values) {
  return values.every((value) => isRequired(value));
}

module.exports = {
  isRequired,
  hasRequiredFields
};
