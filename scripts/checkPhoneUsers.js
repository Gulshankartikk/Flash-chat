const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'server/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const users = await mongoose.connection.collection('users').find({
    phoneNumber: { $exists: true, $ne: null }
  }).project({ name: 1, username: 1, phoneNumber: 1, email: 1, createdAt: 1 }).toArray();

  console.log(`Found ${users.length} users with phone number:`);
  for (const u of users) {
    console.log(`- ID: ${u._id} | Name: "${u.name}" | Phone: "${u.phoneNumber}" | Username: "${u.username}" | Created: ${u.createdAt}`);
  }

  const contacts = await mongoose.connection.collection('contacts').find({}).project({
    owner: 1, name: 1, phone: 1, email: 1, createdAt: 1
  }).toArray();

  console.log(`\nFound ${contacts.length} total contacts:`);
  for (const c of contacts) {
    console.log(`- Contact "${c.name}" (Phone: ${c.phone}) | Owner: ${c.owner} | Created: ${c.createdAt}`);
  }

  const convs = await mongoose.connection.collection('conversations').find({}).project({
    members: 1, type: 1, createdAt: 1, updatedAt: 1
  }).toArray();
  console.log(`\nFound ${convs.length} total conversations:`);
  for (const cv of convs) {
    console.log(`- Conv ${cv._id} | Type: ${cv.type} | Members: ${cv.members?.map(m => m.user).join(', ')} | Updated: ${cv.updatedAt}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
