const { Router } = require("express");
const {
  postRegister,
  getUsers,
  updateUser,
  deleteUser,
  getLastTartibRaqam,
} = require("../controllers/userKvitansiya.controller");

const usersKvitansiya = Router();

/**
 * @swagger
 * tags:
 *   name: Kvitansiyalar
 *   description: Foydalanuvchi kvitansiyalari bo‘yicha API
 */

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Yangi foydalanuvchi kvitansiyasini qo‘shish
 *     tags: [Kvitansiyalar]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullname
 *               - phonenumber
 *               - sana
 *               - summa
 *               - tartibraqam
 *             properties:
 *               fullname:
 *                 type: string
 *               phonenumber:
 *                 type: string
 *               sana:
 *                 type: string
 *                 format: date
 *               summa:
 *                 type: string
 *               tartibraqam:
 *                 type: string
 *               qoshimchatolov:
 *                 type: string
 *               amountpeople:
 *                 type: number
 *               amountroom:
 *                 type: number
 *               location:
 *                 type: string
 *               isactive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Kvitansiya muvaffaqiyatli qo‘shildi
 *       400:
 *         description: Kvitansiya allaqachon mavjud
 *       500:
 *         description: Server xatosi
 */
usersKvitansiya.post("/register", postRegister);

/**
 * @swagger
 * /api/getUsers:
 *   get:
 *     summary: Barcha foydalanuvchi kvitansiyalarini olish
 *     tags: [Kvitansiyalar]
 *     responses:
 *       200:
 *         description: Foydalanuvchilar ro‘yxati
 *       500:
 *         description: Server xatosi
 */
usersKvitansiya.get("/getUsers", getUsers);

/**
 * @swagger
 * /api/updateUsersById/{id}:
 *   put:
 *     summary: Foydalanuvchini yangilash
 *     tags: [Kvitansiyalar]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Foydalanuvchi ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname:
 *                 type: string
 *               phonenumber:
 *                 type: string
 *               sana:
 *                 type: string
 *               summa:
 *                 type: string
 *               location:
 *                 type: string
 *               isactive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Foydalanuvchi yangilandi
 *       404:
 *         description: Foydalanuvchi topilmadi
 *       500:
 *         description: Server xatosi
 */
usersKvitansiya.put("/updateUsersById/:id", updateUser);

/**
 * @swagger
 * /api/delete/{id}:
 *   delete:
 *     summary: Foydalanuvchini o‘chirish
 *     tags: [Kvitansiyalar]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Foydalanuvchi ID
 *     responses:
 *       200:
 *         description: Foydalanuvchi o‘chirildi
 *       404:
 *         description: Topilmadi
 *       500:
 *         description: Server xatosi
 */
usersKvitansiya.delete("/delete/:id", deleteUser);



usersKvitansiya.get("/lastNumber", getLastTartibRaqam);

module.exports = usersKvitansiya;
