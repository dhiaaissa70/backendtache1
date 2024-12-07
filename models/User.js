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
    enum: ["SuperAdmin", "Admin", "Partner", "Assistant", "User","SuperPartner"], 
    default: "User"
  },
  balance: {
    type: Number,
    default: 0, 
    min: 0
  },
  createrid: { 
    type: mongoose.Schema.Types.ObjectId,
     ref: 'User' 
    },
  userdate: { 
    type: Date,
    default: Date.now 
  },
  remote_id: { 
    type: Number,
    
  }
});

const User = mongoose.model("User", UserSchema);
module.exports = User;