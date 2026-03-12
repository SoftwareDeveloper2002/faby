const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3100);

app.use((req, res, next) => {
  const allowedOrigins = ['https://faby-beta.vercel.app', 'http://localhost:4201'];
  const requestOrigin = req.headers.origin;

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'paymongo-api' });
});

app.post('/api/paymongo/checkout-session', async (req, res) => {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        message: 'PAYMONGO_SECRET_KEY is not configured on the API server.',
      });
    }

    const {
      amount,
      description,
      method,
      bank,
      metadata,
    } = req.body || {};

    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return res.status(400).json({ message: 'Invalid amount.' });
    }

    const paymentMethodTypes = method === 'gcash'
      ? ['gcash']
      : method === 'maya'
      ? ['paymaya']
      : method === 'paymaya'
      ? ['paymaya']
      : method === 'grab_pay'
      ? ['grab_pay']
      : method === 'qrph'
      ? ['qrph']
      : method === 'bank'
      ? ['dob']
      : [];

    if (paymentMethodTypes.length === 0) {
      return res.status(400).json({ message: 'Unsupported payment method for PayMongo checkout.' });
    }

    const amountInCentavos = Math.round(amountNumber * 100);
    const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'https';
    const forwardedHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
    const host = forwardedHost || req.headers.host;
    const requestOrigin = (req.headers.origin || '').toString().trim();
    const sourceBase = requestOrigin || process.env.APP_BASE_URL || `${protocol}://${host}`;
    const checkoutQuery = new URLSearchParams({
      motorcycleName: String(metadata?.motorcycleName || ''),
      totalDays: String(metadata?.totalDays || ''),
      startDate: String(metadata?.startDate || ''),
      returnDate: String(metadata?.returnDate || ''),
      totalAmount: String(amountNumber),
      paymentMethod: String(method || ''),
      bank: String(bank || ''),
    }).toString();

    const checkoutPayload = {
      data: {
        attributes: {
          line_items: [
            {
              currency: 'PHP',
              amount: amountInCentavos,
              name: description || 'Motorcycle Rental Booking',
              quantity: 1,
            },
          ],
          payment_method_types: paymentMethodTypes,
          description: description || 'Motorcycle Rental Booking',
          metadata: {
            ...metadata,
            bank: bank || null,
            selectedMethod: method,
          },
          success_url: `${sourceBase}/payment-success?${checkoutQuery}`,
          cancel_url: `${sourceBase}/payment-failed?${checkoutQuery}`,
        },
      },
    };

    const authToken = Buffer.from(`${secretKey}:`).toString('base64');

    const paymongoResponse = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${authToken}`,
      },
      body: JSON.stringify(checkoutPayload),
    });

    const responseJson = await paymongoResponse.json();

    if (!paymongoResponse.ok) {
      const message = responseJson?.errors?.[0]?.detail || 'PayMongo request failed.';
      return res.status(paymongoResponse.status).json({ message, paymongo: responseJson });
    }

    const checkoutUrl = responseJson?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      return res.status(502).json({ message: 'Checkout URL is missing from PayMongo response.' });
    }

    return res.json({ checkoutUrl });
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Unexpected server error.';

    return res.status(500).json({ message });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`PayMongo API server is running on http://localhost:${port}`);
});
