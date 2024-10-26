const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["SuperAdmin", "Admin", "Partner", "Assistant", "User"], 
    default: "User"
  },
  balance: {
    type: Number,
    default: 1000,
    min: 0 
  }
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
