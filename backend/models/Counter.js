const mongoose = require('mongoose');

// Simple atomic counter collection used to generate sequential numbers
// (e.g. per-month invoice numbers) without race conditions.
const counterSchema = new mongoose.Schema({
  // Counter key, e.g. "orderId-2607" for July 2026
  _id: {
    type: String,
    required: true
  },
  seq: {
    type: Number,
    default: 0
  }
});

// Atomically increment (and create if missing) the counter for `key`,
// returning the new sequence value. Participates in a session if provided.
counterSchema.statics.getNextSequence = async function(key, session) {
  const counter = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
