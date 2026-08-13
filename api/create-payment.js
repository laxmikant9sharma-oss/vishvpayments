const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const router = express.Router();

const MERCHANT_ID = process.env.WATCHPAYS_MERCHANT_ID;
const API_KEY = process.env.WATCHPAYS_API_KEY;
const CALLBACK_URL = process.env.WATCHPAYS_CALLBACK_URL;

const CREATE_ENDPOINT = "https://api.watchpays.com/v1/create";

function generateSignature(params, apiKey) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    )
  );

  const sortedKeys = Object.keys(filtered).sort();

  let signStr = "";

  for (const key of sortedKeys) {
   signStr += `${key}=${filtered[key]}&`;
  }

  signStr += `key=${apiKey}`;

  return crypto.createHash("md5").update(signStr).digest("hex");
}

router.post("/create-payment", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const formattedAmount = Number(amount).toFixed(2);

    const merchantOrderNo = ORD${Date.now()};

    const params = {
      merchant_id: MERCHANT_ID,
      amount: formattedAmount,
      merchant_order_no: merchantOrderNo,
      callback_url: CALLBACK_URL,
    };

    const signature = generateSignature(params, API_KEY);

    const payload = {
      ...params,
      api_key: API_KEY,
      signature,
    };

    const { data } = await axios.post(CREATE_ENDPOINT, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    if (!data.success) {
      return res.status(400).json({
        success: false,
        message: data.message || "Payment creation failed",
      });
    }

    return res.json({
      success: true,
      payment_url: data.payment_url,
    });
  } catch (err) {
    console.error(
      "create-payment error:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
