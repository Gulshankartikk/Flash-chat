const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: 'server/.env' });

async function consolidate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for phone account consolidation...');

  const users = await mongoose.connection.collection('users').find({
    phoneNumber: { $exists: true, $ne: null }
  }).toArray();

  const phoneGroups = {};
  for (const u of users) {
    const raw = (u.phoneNumber || '').replace(/\D/g, '');
    if (!raw || raw.length < 7) continue;
    const last10 = raw.slice(-10);
    if (!phoneGroups[last10]) phoneGroups[last10] = [];
    phoneGroups[last10].push(u);
  }

  for (const [phone, uList] of Object.entries(phoneGroups)) {
    if (uList.length <= 1) continue;

    console.log(`\nFound ${uList.length} accounts for phone ...${phone}:`);
    // Pick primary: prefer account with name !== 'undefined' and startsWith('+91') or newest
    uList.sort((a, b) => {
      const aNamed = a.name && a.name !== 'undefined' ? 1 : 0;
      const bNamed = b.name && b.name !== 'undefined' ? 1 : 0;
      if (aNamed !== bNamed) return bNamed - aNamed;
      const aE164 = a.phoneNumber && a.phoneNumber.startsWith('+') ? 1 : 0;
      const bE164 = b.phoneNumber && b.phoneNumber.startsWith('+') ? 1 : 0;
      if (aE164 !== bE164) return bE164 - aE164;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const primary = uList[0];
    const secondaries = uList.slice(1);
    console.log(`  -> Selected Primary: ${primary._id} (${primary.name}, ${primary.username}, ${primary.phoneNumber})`);

    // Standardize primary phone number to E.164 +91
    const canonicalPhone = primary.phoneNumber && primary.phoneNumber.startsWith('+')
      ? primary.phoneNumber
      : `+91${phone}`;

    await mongoose.connection.collection('users').updateOne(
      { _id: primary._id },
      { $set: { phoneNumber: canonicalPhone, isVerified: true } }
    );

    for (const sec of secondaries) {
      console.log(`  -> Merging Secondary: ${sec._id} into Primary`);

      // 1. Move contacts owned by secondary to primary
      const secContacts = await mongoose.connection.collection('contacts').find({ owner: sec._id }).toArray();
      for (const sc of secContacts) {
        const conflict = await mongoose.connection.collection('contacts').findOne({
          owner: primary._id,
          $or: [
            ...(sc.phone ? [{ phone: sc.phone }] : []),
            ...(sc.email ? [{ email: sc.email }] : [])
          ]
        });
        if (!conflict) {
          await mongoose.connection.collection('contacts').updateOne(
            { _id: sc._id },
            { $set: { owner: primary._id } }
          );
        } else {
          await mongoose.connection.collection('contacts').deleteOne({ _id: sc._id });
        }
      }

      // 2. Update contacts pointing to secondary (linkedUser)
      await mongoose.connection.collection('contacts').updateMany(
        { linkedUser: sec._id },
        { $set: { linkedUser: primary._id } }
      );

      // 3. Move conversations
      await mongoose.connection.collection('conversations').updateMany(
        { 'members.user': sec._id },
        { $set: { 'members.$[elem].user': primary._id } },
        { arrayFilters: [{ 'elem.user': sec._id }] }
      );

      // 4. Move messages
      await mongoose.connection.collection('messages').updateMany(
        { sender: sec._id },
        { $set: { sender: primary._id } }
      );

      // Delete secondary user
      await mongoose.connection.collection('users').deleteOne({ _id: sec._id });
      console.log(`     Merged and removed secondary account ${sec._id}`);
    }
  }

  console.log('\nConsolidation complete!');
  await mongoose.disconnect();
}

consolidate().catch(console.error);
