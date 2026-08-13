const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const amount = Number(req.body?.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    const merchantId = process.env.WATCHPAYS_MERCHANT_ID;
    const apiKey = process.env.WATCHPAYS_API_KEY;

    if (!merchantId || !apiKey) {
      console.error("Missing WatchPays environment variables");

      return res.status(500).json({
        success: false,
        message: "Payment configuration missing"
      });
    }

    const formattedAmount = amount.toFixed(2);

    const merchantOrderNo =
      "ORD" + Date.now() + Math.floor(Math.random() * 1000);

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;

    const callbackUrl =
      protocol + "://" + host + "/api/callback";

    const params = {
      merchant_id: merchantId,
      amount: formattedAmount,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl
    };

    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(function ([key, value]) {
        return value !== undefined &&
               value !== null &&
               value !== "";
      })
    );

    const sortedKeys = Object.keys(filteredParams).sort();

    let signString = "";

    for (const key of sortedKeys) {
      signString +=
        key + "=" + filteredParams[key] + "&";
    }

    signString = signString.slice(0, -1);

    signString += "&key=" + apiKey;

    const signature = crypto
      .createHash("md5")
      .update(signString, "utf8")
      .digest("hex");

    const payload = {
      merchant_id: merchantId,
      api_key: apiKey,
      amount: formattedAmount,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl,
      signature: signature
    };

    console.log("Sending payment request:", {
      merchant_order_no: merchantOrderNo,
      amount: formattedAmount
    });

    const response = await fetch(
      "https://api.watchpays.com/v1/create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    console.log("WatchPays response:", data);

    if (!response.ok || !data.success) {
      return res.status(400).json({
        success: false,
        message: data.message || "Payment creation failed"
      });
    }

    return res.status(200).json({
      success: true,
      payment_url: data.payment_url,
      merchant_order_no: merchantOrderNo,
      amount: formattedAmount
    });

  } catch (err) {
    console.error("create-payment error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};
