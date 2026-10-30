const { Schema, model } = require("mongoose");

const UserKvitansiyaSchema = new Schema(
  {
    fullname: { type: String, required: true, trim: true },
    phonenumber: { type: String, required: true, trim: true },
    sana: { type: String, required: true },
    summa: { type: String, required: true },                     // so'mda
    tartibraqam: { type: String },
    kvitansiyakod: { type: String, trim: true, default: "" },     // Chek ID — faqat "Ofis uchun" belgilanganda
    kassir: { type: String, required: true },
    qoshimchatolov: { type: String, default: "0" },
    amountpeople: { type: String, required: true },
    amountroom: { type: String, default: "0" },
    location: { type: String, required: true },
    dollar: { type: String, required: true },                    // ✅ endi: summaning dollardagi qiymati
    kurs: { type: String },                                      // ✅ YANGI: ishlatilgan kurs (1 USD = ? so'm)
    kursmanba: { type: String },                                 // ✅ YANGI: "Kapitalbank (sotish)", "Markaziy bank", "Qo'lda"
    isactive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const UserKvitansiya = model("UserKvitansiya", UserKvitansiyaSchema);
module.exports = { UserKvitansiya };
