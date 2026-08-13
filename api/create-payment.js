/**
 * create-payment.js
 * -------------------------------------------------
 * WatchPays Pay-in API integration
 *
 * Flow:
 *   1. Landing page se amount aata hai (POST /api/create-payment)
 *   2. Yaha unique merchant_order_no generate hota hai
 *   3. Params sort + signature (MD5) banti hai (WatchPays ke rules ke hisaab se)
 *   4. WatchPays API ko call karte hai
 *   5. Response se payment_url leke QR code (base64) generate karte hai
 *   6. Frontend ko { payment_url, qr_code, order_no } bhejte hai
 *
 * Install dependencies:
 *   npm install express axios qrcode dotenv
 * -------------------------------------------------
 */

const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const QRCode = require("qrcode");


const router = express.Router();

// ----- Config (.env file me rakhna, hardcode mat karo) -----
const MERCHANT_ID = process.env.WATCHPAYS_MERCHANT_ID;   // e.g. "100555001"
const API_KEY = process.env.WATCHPAYS_API_KEY;           // e.g. "sk_live_xxx"
const CALLBACK_URL = process.env.WATCHPAYS_CALLBACK_URL; // e.g. "https://yoursite.com/api/payment-callback"
const CREATE_ENDPOINT = "https://api.watchpays.com/v1/create";

/**
 * Signature generation — docs ke Step 1-6 follow karte hue:
 * 1. params prepare karo
 * 2. empty values hatao
 * 3. keys ko alphabetically sort karo
 * 4. "key=value&" format me string banao
 * 5. end me "key=<api_key>" append karo
 * 6. MD5 hash lo
 */
function generateSignature(params, apiKey) {
  // empty/null/undefined values remove
  const filtered = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== "" && v !== null && v !== undefined
    )
  );

  // alphabetical sort by key
  const sortedKeys = Object.keys(filtered).sort();

  let signStr = "";
  for (const key of sortedKeys) {
    signStr += ${key}=${filtered[key]}&;
  }
  signStr += key=${apiKey};

  return crypto.createHash("md5").update(signStr).digest("hex");
}

/**
 * POST /api/create-payment
 * Body: { amount: number }
 */
router.post("/create-payment", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount  isNaN(amount)  Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // Amount hamesha 2 decimals me
    const formattedAmount = Number(amount).toFixed(2);

    // Unique order number — apna khud ka bhi format use kar sakte ho
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

    // WatchPays ko call karo
    const { data } = await axios.post(CREATE_ENDPOINT, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    if (!data.success) {
      return res.status(400).json({ success: false, message: data.message || "Payment creation failed" });
    }

    // payment_url se QR code (base64 PNG data URL) generate karo
    const qrCodeDataUrl = await QRCode.toDataURL(data.payment_url);

    // TODO: yaha order ko apne DB me save karo (merchantOrderNo, amount, status: 'pending')
    // taaki callback aane par match/verify kar sako

    return res.json({
      success: true,
      order_no: data.order_no,
      merchant_order_no: data.merchant_order_no,
      amount: data.amount,
      payment_url: data.payment_url,
      qr_code: qrCodeDataUrl, // <img src={qr_code} /> directly frontend me use ho jayega
    });
  } catch (err) {
    console.error("create-payment error:", err.response?.data || err.message);
    return res.status(500).json({ success: false, message: "Server error while creating payment" });
  }
});

module.exports = router;
