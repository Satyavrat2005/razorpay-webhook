// import crypto from "crypto";

// const secret = "mtd@123_webhook_secret";
// const rawBody = '{"event":"test.webhook","payload":{}}'; // must match EXACTLY what Postman sends
// const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

// console.log(signature);

import axios from "axios";

const key_id = "rzp_test_RHNJln9YVyxjVy";
const key_secret = "ZQB7TcgZGh1ursJf7WwyY2IQ";

async function createOrder() {
  const response = await axios.post(
    "https://api.razorpay.com/v1/orders",
    {
      amount: 50000, // amount in paise (₹500)
      currency: "INR",
      receipt: "receipt#1"
    },
    {
      auth: {
        username: key_id,
        password: key_secret,
      }
    }
  );
  console.log("Order:", response.data);
}

createOrder();
