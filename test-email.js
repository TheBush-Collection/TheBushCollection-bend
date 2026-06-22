// Quick test: connect to MongoDB directly, find a booking, then call the email endpoint
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const BASE = 'http://localhost:5000';

async function test() {
  // 1. Connect to MongoDB and find a booking
  console.log('1. Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('   Connected ✓');

  const booking = await mongoose.connection.db.collection('bookings').findOne({});
  if (!booking) {
    console.log('   No bookings found in database.');
    await mongoose.disconnect();
    return;
  }
  
  console.log(`   Found booking:`);
  console.log(`   _id: ${booking._id}`);
  console.log(`   bookingId: ${booking.bookingId}`);
  console.log(`   customerEmail: ${booking.customerEmail}`);
  console.log(`   status: ${booking.status}`);
  console.log(`   property: ${booking.property}`);

  // 2. Test email receipt endpoint using MongoDB _id
  console.log(`\n2. Calling POST /bookings/${booking._id}/email ...`);
  const emailResp = await fetch(`${BASE}/bookings/${booking._id}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: booking.customerEmail }),
  });
  const emailData = await emailResp.json();
  console.log(`   HTTP Status: ${emailResp.status}`);
  console.log('   Response:', JSON.stringify(emailData, null, 2));

  if (emailData.success) {
    console.log('\n✅ Email receipt sent successfully!');
  } else {
    console.log('\n❌ Failed:', emailData.msg || emailData.message);
  }

  await mongoose.disconnect();
}

test().catch(err => { console.error('Test error:', err); process.exit(1); });
