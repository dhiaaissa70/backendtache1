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
    enum: ["admin", "user", "guest"], 
    default: "user"
  },
  id: {
    type: Number,
    unique: true
  }
});

UserSchema.pre('save', async function (next) {
  try {
    if (!this.id) {
      const count = await mongoose.model('User').countDocuments();
      this.id = count + 1;
    }

    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
