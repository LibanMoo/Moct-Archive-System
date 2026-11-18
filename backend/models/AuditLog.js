import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  action: { type: String, required: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
  details: { type: String, default: "" },
  ipAddress: { type: String, default: "" }
}, { timestamps: true });

export default mongoose.model("AuditLog", auditLogSchema);
