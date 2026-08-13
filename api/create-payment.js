const crypto = require("crypto");

function generateSignature(params, apiKey) {

  const filtered = {};

  for (const key of Object.keys(params)) {
    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ""
    ) {
      filtered[key] = String(params[key]);
    }
  }

  // Alphabetical sorting
  const sortedKeys = Object.keys(filtered).sort();

  let signString = "";

  for (const key of sortedKeys) {
    signString += ${key}=${filtered[key]}&;
  }

  // Remove last &
  signString += key=${apiKey};

  return crypto
    .createHash("md5")
    .update(signString)
    .digest("hex");
}


module.exports = async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {

    const {
      amount
    } = req.body || {};

    // Validate amount
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    // Always keep 2 decimals
    const formattedAmount = numericAmount.toFixed(2);

    const merchantId = process.env.WATCHPAYS_MERCHANT_ID;
    const apiKey = process.env.WATCHPAYS_API_KEY;

    if (!merchantId || !apiKey) {
      console.error("WatchPays environment variables are missing");

      return res.status(500).json({
        success: false,
        message: "Payment configuration missing"
      });
    }

    /*
      Current website URL.
      Example:
      https://your-site.vercel.app
    */
    const protocol =
      req.headers["x-forwarded-proto"] || "https";

    const host = req.headers["x-forwarded-host"] || req.headers.host;

    const baseUrl = ${protocol}://${host};

    /*
      WatchPays will send payment status here.
    */
    const callbackUrl = ${baseUrl}/api/callback;

    /*
      Unique order number.
      Timestamp + random value.
    */
    const merchantOrderNo =
      "ORD" +
      Date.now().toString() +
      Math.floor(1000 + Math.random() * 9000);


    /*
      Parameters used for signature.
      IMPORTANT:
      api_key is NOT included here.
    */
    const params = {
      merchant_id: merchantId,
      amount: formattedAmount,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl
    };


    const signature = generateSignature(
      params,
      apiKey
    );


    /*
      WatchPays API request
    */
    const payload = {
      merchant_id: merchantId,
      api_key: apiKey,
      amount: formattedAmount,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl,
      signature: signature
    };


    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);


    let response;

    try {

      response = await fetch(
        "https://api.watchpays.com/v1/create",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload),

          signal: controller.signal
        }
      );

    } finally {
      clearTimeout(timeout);
    }


    const data = await response.json();


    console.log("WatchPays response:", data);


    if (!response.ok || !data.success) {

      return res.status(400).json({
        success: false,
        message:
          data.message ||
          "Payment creation failed"
      });

    }


    if (!data.payment_url) {

      return res.status(500).json({
        success: false,
        message: "Payment URL missing from gateway"
      });

    }


    return res.status(200).json({
      success: true,
      payment_url: data.payment_url,
      merchant_order_no: merchantOrderNo,
      amount: formattedAmount
    });


  } catch (err) {

    console.error(
      "create-payment error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
