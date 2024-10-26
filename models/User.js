const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

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
    enum: ["SuperAdmin", "Admin", "Partner","Assistant","User"], 
    default: "User"
  }
});



const User = mongoose.model("User", UserSchema);
module.exports = User;
