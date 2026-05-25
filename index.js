const express = require("express");
const cors = require("cors");
const { connect } = require("mongoose");

require("dotenv").config();

const app = express();


// ✅ VERY SIMPLE CORS
app.use(cors());


// ✅ JSON
app.use(express.json());


// ✅ ROUTES
const userRoute = require("./routes/user.route");
const usersKvitansiyaRoute = require("./routes/userKvitansiya.route");

app.use("/api/users", userRoute);
app.use("/api/userKvitansiya", usersKvitansiyaRoute);


// ✅ TEST
app.get("/", (req, res) => {
  res.send("Backend working");
});


// ✅ MONGODB
connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.log(err);
  });


// ✅ PORT
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
