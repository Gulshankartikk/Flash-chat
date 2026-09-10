const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB database connected successfully');
  } catch (error) {
    console.error('Error connecting database:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
