const { readJson } = require("../utils/readJson");

const billingConfig = readJson("data/billingConfig.json");

function getBillingConfig() {
  return billingConfig;
}

module.exports = {
  getBillingConfig
};
