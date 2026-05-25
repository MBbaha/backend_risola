const express = require("express");
const { connect } = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const userRoute = require("./routes/user.route");
const usersKvitansiyaRoute = require("./routes/userKvitansiya.route");

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();


// ✅ ALLOWED ORIGINS
const allowedOrigins = [
  "https://risola-frontend2.onrender.com",
  "https://risolafrontend-production.up.railway.app",
  "http://localhost:3000"
];


// ✅ CORS SETTINGS
app.use(cors({
  origin: function (origin, callback) {

    // Postman yoki mobile app uchun
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS xatolik: Ruxsat etilmagan domen"));
    }
  },

  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));


app.use(express.json());


// ✅ MongoDB CONNECT
async function connectToDB() {
  try {

    await connect(process.env.MONGODB_URL, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });

    console.log("✅ MongoDB connected");

  } catch (err) {

    console.error("❌ MongoDB connection error:", err.message);

  }
}

connectToDB();


// ✅ SWAGGER
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Risola API",
      version: "1.0.0",
      description: "API documentation using Swagger",
    },

    servers: [
      {
        url: "https://backend-production.up.railway.app"
      }
    ]
  },

  apis: ["./routes/*.js"],
};


const swaggerDocs = swaggerJsdoc(swaggerOptions);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocs)
);


// ✅ TEST ROUTE
app.get("/", (req, res) => {
  res.send("✅ Risola backend Railway'da ishlayapti!");
});


// ✅ API ROUTES
app.use("/api/users", userRoute);

app.use(
  "/api/userKvitansiya",
  usersKvitansiyaRoute
);


// ✅ PORT
const PORT = process.env.PORT || 10000;


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
