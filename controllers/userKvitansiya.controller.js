const { UserKvitansiya } = require("../models/userKvitansiyaSchema");

// 1. Register
const postRegister = async (req, res) => {
  try {
    const {
      fullname,
      phonenumber,
      sana,
      summa,
      tartibraqam,
      qoshimchatolov,
      amountpeople,
      amountroom,
      dollar,
      location,
      isactive,
    } = req.body;

    const existingUser = await UserKvitansiya.findOne({ fullname, tartibraqam, phonenumber });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Bu foydalanuvchiga kvitansiya allaqachon berilgan.",
      });
    }

    const newUser = new UserKvitansiya({
      fullname,
      phonenumber,
      sana,
      summa,
      tartibraqam,
      qoshimchatolov,
      amountpeople,
      amountroom,
      location,
      dollar,
      isactive,
    });

    await newUser.save();
    res.status(201).json({
      success: true,
      message: "Foydalanuvchi kvitansiyasi muvaffaqiyatli qo'shildi.",
      data: newUser,
    });
  } catch (error) {
    console.error("❌ Xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Server xatosi: Qo'shishda muammo yuz berdi.",
    });
  }
};

// 2. Get all users
const getUsers = async (req, res) => {
  try {
    const users = await UserKvitansiya.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "Foydalanuvchilar ro'yxati",
      data: users,
    });
  } catch (error) {
    console.error("❌ Xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Foydalanuvchilarni olishda server xatosi yuz berdi.",
    });
  }
};

// 3. Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedFields = req.body;

    const updatedUser = await UserKvitansiya.findByIdAndUpdate(id, updatedFields, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Foydalanuvchi topilmadi.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Foydalanuvchi yangilandi.",
      data: updatedUser,
    });
  } catch (error) {
    console.error("❌ Xatolik:", error);
    res.status(500).json({
      success: false,
      message: "Foydalanuvchini yangilashda xato yuz berdi.",
    });
  }
};

// 4. Delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await UserKvitansiya.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "Foydalanuvchi topilmadi.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Foydalanuvchi o'chirildi.",
    });
  } catch (error) {
    console.error("❌ Xatolik:", error);
    res.status(500).json({
      success: false,
      message: "O'chirishda server xatosi yuz berdi.",
    });
  }
};

// 5. Oxirgi tartib raqamni olish
const getLastTartibRaqam = async (req, res) => {
  try {
    const last = await UserKvitansiya.findOne().sort({ createdAt: -1 });
    const lastNum = last ? parseInt(last.tartibraqam) || 0 : 0;
    res.status(200).json({ success: true, nextNumber: lastNum + 1 });
  } catch (error) {
    console.error("❌ Xatolik:", error);
    res.status(500).json({ success: false, message: "Xatolik" });
  }
};

module.exports = {
  postRegister,
  getUsers,
  updateUser,
  deleteUser,
  getLastTartibRaqam,
};
