const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await mongoose.connection.collection('users').find({
    phoneNumber: { $exists: true, $ne: null }
  }).toArray();

  const map = {};
  for (const u of users) {
    const d = (u.phoneNumber || '').replace(/\D/g, '').slice(-10);
    if (!d || d.length < 7) continue;
    if (!map[d]) map[d] = [];
    map[d].push(u);
  }

  const duplicates = Object.entries(map).filter(([k, v]) => v.length > 1);
  console.log(`Duplicate phone accounts found: ${duplicates.length}`);
  for (const [phone, uList] of duplicates) {
    console.log(`\nPhone ending in: ${phone} (${uList.length} accounts)`);
    for (const u of uList) {
      const contactsCount = await mongoose.connection.collection('contacts').countDocuments({ owner: u._id });
      const convsCount = await mongoose.connection.collection('conversations').countDocuments({ 'members.user': u._id });
      const msgCount = await mongoose.connection.collection('messages').countDocuments({ sender: u._id });
      console.log(`  - User ID: ${u._id} | Name: "${u.name}" | Phone: "${u.phoneNumber}" | Username: "${u.username}" | Contacts: ${contactsCount} | Convs: ${convsCount} | Msgs: ${msgCount} | Created: ${u.createdAt}`);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
