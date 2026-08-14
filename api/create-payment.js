const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const telegramUsername =
      String(req.body?.telegram_username || "").trim();

    const mobile =
      String(req.body?.mobile || "").trim();

    const amount =
      Number(req.body?.amount);

    // Validate Telegram username
    if (!telegramUsername) {
      return res.status(400).json({
        success: false,
        message: "Telegram username is required"
      });
    }

    // Validate mobile
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required"
      });
    }

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    const merchantId =
      process.env.WATCHPAYS_MERCHANT_ID;

    const apiKey =
      process.env.WATCHPAYS_API_KEY;

    const databaseUrl =
      process.env.DATABASE_URL;

    if (!merchantId || !apiKey) {
      console.error(
        "Missing WatchPays environment variables"
      );

      return res.status(500).json({
        success: false,
        message: "Payment configuration missing"
      });
    }

    if (!databaseUrl) {
      console.error(
        "DATABASE_URL is missing"
      );

      return res.status(500).json({
        success: false,
        message: "Database configuration missing"
      });
    }

    const sql = neon(databaseUrl);

    const formattedAmount =
      amount.toFixed(2);

    // Create merchant order number
    const merchantOrderNo =
      "ORD" +
      Date.now() +
      Math.floor(Math.random() * 1000);

    const protocol =
      req.headers["x-forwarded-proto"] || "https";

    const host =
      req.headers.host;

    const callbackUrl =
      protocol +
      "://" +
      host +
      "/api/callback";

    // Save order in database BEFORE payment creation
    await sql`
      INSERT INTO payments (
        merchant_order_no,
        telegram_username,
        mobile,
        amount,
        status
      )
      VALUES (
        ${merchantOrderNo},
        ${telegramUsername},
        ${mobile},
        ${formattedAmount},
        'pending'
      )
    `;

    // WatchPays signature parameters
    const params = {
      merchant_id: merchantId,
      amount: formattedAmount,
      merchant_order_no: merchantOrderNo,
      callback_url: callbackUrl
    };

    const filteredParams =
      Object.fromEntries(
        Object.entries(params).filter(
          function ([key, value]) {
            return (
              value !== undefined &&
              value !== null &&
              value !== ""
            );
          }
        )
      );

    const sortedKeys =
      Object.keys(filteredParams).sort();

    let signString = "";

    for (const key of sortedKeys) {
      signString +=
        key +
        "=" +
        filteredParams[key] +
        "&";
    }

    signString =
      signString.slice(0, -1);

    signString +=
      "&key=" +
      apiKey;

    const signature =
      crypto
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

    console.log(
      "Sending payment request:",
      {
        merchant_order_no: merchantOrderNo,
        telegram_username: telegramUsername,
        mobile: mobile,
        amount: formattedAmount
      }
    );

    const response =
      await fetch(
        "https://api.watchpays.com/v1/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );const data =
      await response.json();

    console.log(
      "WatchPays response:",
      data
    );

    // Payment creation failed
    if (!response.ok || !data.success) {
      await sql`
        UPDATE payments
        SET status = 'failed'
        WHERE merchant_order_no =
        ${merchantOrderNo}
      `;

      return res.status(400).json({
        success: false,
        message:
          data.message ||
          "Payment creation failed"
      });
    }

    // Save payment URL
    await sql`
      UPDATE payments
      SET payment_url = ${data.payment_url}
      WHERE merchant_order_no = ${merchantOrderNo}
    `;

    console.log(
      "Payment created successfully:",
      {
        merchant_order_no: merchantOrderNo,
        payment_url: data.payment_url
      }
    );

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
