// api/stripe-webhook.js
const Stripe = require('stripe');
const getRawBody = require('raw-body');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    const raw = (await getRawBody(req)).toString('utf8');
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[webhook verify]', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // TODO: handle event types

  res.status(200).end();
};

