const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const kartikUsers = await mongoose.connection.collection('users').find({
    $or: [
      { phoneNumber: /738036829/ },
      { phoneNumber: /8726321083/ },
      { username: /kartik|karik/i }
    ]
  }).toArray();

  console.log(`Found ${kartikUsers.length} matching users:`);
  for (const u of kartikUsers) {
    console.log(`\nUser: ${u._id} | Name: "${u.name}" | Username: "${u.username}" | Phone: "${u.phoneNumber}" | Email: "${u.email}"`);

    const contacts = await mongoose.connection.collection('contacts').find({ owner: u._id }).toArray();
    console.log(`  Contacts (${contacts.length}):`);
    contacts.forEach(c => console.log(`    - ID: ${c._id} | Name: "${c.name}" | Phone: "${c.phone}" | LinkedUser: ${c.linkedUser}`));

    const convs = await mongoose.connection.collection('conversations').find({ 'members.user': u._id }).toArray();
    console.log(`  Conversations (${convs.length}):`);
    for (const cv of convs) {
      const msgs = await mongoose.connection.collection('messages').find({ conversation: cv._id }).toArray();
      console.log(`    - Conv: ${cv._id} | Type: ${cv.type} | Msgs: ${msgs.length}`);
    }
  }

  // Also check all contacts in the database created today:
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayContacts = await mongoose.connection.collection('contacts').find({ createdAt: { $gte: today } }).toArray();
  console.log(`\nTotal Contacts created today: ${todayContacts.length}`);
  for (const tc of todayContacts) {
    console.log(`  Contact: ${tc._id} | Name: "${tc.name}" | Phone: "${tc.phone}" | Owner: ${tc.owner}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
