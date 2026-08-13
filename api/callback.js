module.exports = async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {

    const data = req.body || {};

    console.log(
      "WatchPays callback:",
      data
    );

    /*
      WatchPays callback example:

      {
        "orderNo": "GW202502010001",
        "merchantOrder": "ORD20250201",
        "status": "success",
        "amount": 1000
      }
    */

    const orderNo = data.orderNo;
    const merchantOrder = data.merchantOrder;
    const status = data.status;
    const amount = data.amount;


    if (!orderNo  !merchantOrder  !status) {
      return res.status(400).send("Invalid callback");
    }


    /*
      Yahan future me database/wallet update
      kar sakte hain.

      IMPORTANT:
      Payment ko sirf callback receive hone par
      blindly successful mat mark karna.
      Order aur amount verify karna chahiye.
    */

    if (status === "success") {

      console.log(
        "PAYMENT SUCCESS",
        {
          orderNo,
          merchantOrder,
          amount
        }
      );

      // Database update yahan hoga.
      // Example:
      // markOrderPaid(merchantOrder, amount);
    }


    return res.status(200).send("success");


  } catch (err) {

    console.error(
      "callback error:",
      err
    );

    return res.status(500).send("error");
  }
};
