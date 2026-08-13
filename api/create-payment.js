const crypto = require("crypto");

module.exports = async function handler(req, res) {
  // Prevent any caching of this endpoint — har request fresh honi chahiye
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};

    // Amount ko strictly current request se hi lo, kahin se bhi cache/default mat lo
    const rawAmount = body.amount;
    const amt = Number(rawAmount);

    if (rawAmount === undefined || rawAmount === null || rawAmount === "" || isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const merchant_id = process.env.WATCHPAYS_MERCHANT_ID;
    const api_key = process.env.WATCHPAYS_API_KEY;

    if (!merchant_id || !api_key) {
      return res.status(500).json({ error: "WatchPays environment variables are missing" });
    }

    // Har request ke liye naya unique order number — purana order kabhi reuse nahi hoga
    const merchant_order_no = "ORD" + Date.now() + Math.floor(Math.random() * 1000);

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const callback_url = protocol + "://" + host + "/api/callback";

    // Isi request ke amount ko format karo — koi purani variable reuse nahi
    const formattedAmount = amt.toFixed(2);

    const params = {
      amount: formattedAmount,
      callback_url: callback_url,
      merchant_id: merchant_id,
      merchant_order_no: merchant_order_no
    };

    const sortedKeys = Object.keys(params).sort();
    const parts = [];
    for (const key of sortedKeys) {
      parts.push(key + "=" + params[key]);
    }

    const signString = parts.join("&") + "&key=" + api_key;
    const signature = crypto.createHash("md5").update(signString).digest("hex");

    const response = await fetch("https://api.watchpays.com/v1/create", {
      method: "POST",
      cache: "no-store", // fetch level par bhi caching disable
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        merchant_id: merchant_id,
        api_key: api_key,
        amount: formattedAmount,
        merchant_order_no: merchant_order_no,
        callback_url: callback_url,
        extra: "",
        signature: signature
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("WatchPays error:", error);
    return res.status(500).json({
      error: "Payment gateway request failed",
      details: error.message
    });
  }
};
