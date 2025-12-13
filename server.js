// // server.js
// import express from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import swaggerUi from "swagger-ui-express";
// import path from "path";
// import {connectDB} from "./config/db.js";
// import swaggerSpec from "./config/swagger.js";

// import authRoutes from "./routes/auth.routes.js";
// import adminRoutes from "./routes/admin.routes.js";
// import propertyRoutes from "./routes/property.routes.js";
// import roomRoutes from "./routes/room.routes.js";
// import bookingRoutes from "./routes/booking.routes.js";
// import packageRoutes from "./routes/package.routes.js";
// import mediaRoutes from "./routes/media.routes.js";
// import amenityRoutes from "./routes/amenity.routes.js";
// import nairobiHotelRoutes from "./routes/nairobiHotel.routes.js";
// import publicRoutes from "./routes/public.routes.js";
// import paymentRoutes from "./routes/payment.routes.js";
// import contactRoutes from "./routes/contact.routes.js";
// import reviewRoutes from "./routes/review.routes.js";
// import mailchimpRoutes from "./routes/mailchimp.routes.js";

// dotenv.config();
// connectDB();

// const app = express();
// app.use(cors());
// app.use(express.json());


// // Serve uploaded media files
// app.use(
// 	'/uploads',
// 	express.static(path.join(process.cwd(), 'public', 'uploads'))
// );

// // Swagger Documentation
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// // Route mounting
// app.use("/auth", authRoutes);
// app.use("/admin", adminRoutes);
// app.use("/properties", propertyRoutes);
// app.use("/rooms", roomRoutes);
// app.use("/bookings", bookingRoutes);
// app.use("/packages", packageRoutes);
// app.use("/media", mediaRoutes);
// app.use("/amenities", amenityRoutes);
// app.use("/nairobi-hotels", nairobiHotelRoutes);
// app.use("/public", publicRoutes);
// app.use("/payments", paymentRoutes);
// app.use("/contact", contactRoutes);
// app.use("/reviews", reviewRoutes);
// app.use("/api/mailchimp", mailchimpRoutes);

// app.get("/", (req, res) => res.send("API is running..."));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { connectDB } from "./config/db.js";
import swaggerSpec from "./config/swagger.js";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import propertyRoutes from "./routes/property.routes.js";
import roomRoutes from "./routes/room.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import packageRoutes from "./routes/package.routes.js";
import mediaRoutes from "./routes/media.routes.js";
import amenityRoutes from "./routes/amenity.routes.js";
import nairobiHotelRoutes from "./routes/nairobiHotel.routes.js";
import publicRoutes from "./routes/public.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import mailchimpRoutes from "./routes/mailchimp.routes.js";

dotenv.config();
connectDB();

const app = express();

/* -----------------------------------------------------------
   ✅ FIXED & IMPROVED CORS CONFIG (REQUIRED FOR NGROK)
----------------------------------------------------------- */
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
	"https://thebushcollection.africa",
    "https://jude-rattish-samir.ngrok-free.dev",
	"https://thebushcollection.onrender.com/"
];

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            } else {
                return callback(new Error("CORS blocked: " + origin));
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    })
);


/* ----------------------------------------------------------- */

app.use(express.json());

// Debug incoming requests (optional but useful for PesaPal)
app.use((req, res, next) => {
    console.log(`➡️  ${req.method} ${req.path}`);
    next();
});

// Serve uploaded media files
app.use(
    "/uploads",
    express.static(path.join(process.cwd(), "public", "uploads"))
);

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Route mounting
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/properties", propertyRoutes);
app.use("/rooms", roomRoutes);
app.use("/bookings", bookingRoutes);
app.use("/packages", packageRoutes);
app.use("/media", mediaRoutes);
app.use("/amenities", amenityRoutes);
app.use("/nairobi-hotels", nairobiHotelRoutes);
app.use("/public", publicRoutes);
app.use("/payments", paymentRoutes);
app.use("/contact", contactRoutes);
app.use("/reviews", reviewRoutes);
app.use("/api/mailchimp", mailchimpRoutes);

app.get("/", (req, res) => res.send("API is running..."));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);
