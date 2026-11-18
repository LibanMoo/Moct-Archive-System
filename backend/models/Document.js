import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  referenceNumber: { type: String, required: true, unique: true, trim: true },
  direction: { type: String, enum: ["IN", "OUT"], required: true, index: true },
  subject: { type: String, required: true, trim: true, maxlength: 250 },
  description: { type: String, trim: true, maxlength: 5000, default: "" },
  sender: { type: String, trim: true, default: "" },
  recipient: { type: String, trim: true, default: "" },
  department: { type: String, trim: true, default: "" },
  documentDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["Pending", "Processing", "Completed"], default: "Pending" },
  isArchived: { type: Boolean, default: false, index: true },
  originalFileName: { type: String, default: "" },
  storedFileName: { type: String, default: "" },
  mimeType: { type: String, default: "" },
  fileSize: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

documentSchema.index({ subject: "text", referenceNumber: "text", sender: "text", recipient: "text" });

export default mongoose.model("Document", documentSchema);
