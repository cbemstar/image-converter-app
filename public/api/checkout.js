// api/checkout.js
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { amount, currency = 'usd', metadata } = JSON.parse(req.body || '{}');
    if (!amount || typeof amount !== 'number') return res.status(400).json({ error: 'amount required' });

    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      metadata
    });

    res.status(200).json({ clientSecret: pi.client_secret });
  } catch (err) {
    console.error('[checkout]', err);
    res.status(500).json({ error: 'server_error' });
  }
};

