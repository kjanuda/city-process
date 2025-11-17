import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001','https://urbanflowsl.netlify.app'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

// ============================================
// 🔥 FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyAGAcxZRL61n_5nUcl6_i9Cad-l2anFRig",
  authDomain: "smartcity-ef67b.firebaseapp.com",
  projectId: "smartcity-ef67b",
  storageBucket: "smartcity-ef67b.firebasestorage.app",
  messagingSenderId: "570519797823",
  appId: "1:570519797823:web:6562250752cce6bfb2388a",
  measurementId: "G-8RQ0K149QD"
};

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

console.log("✅ Firebase initialized successfully");

// ============================================
// 💾 MONGODB CONFIGURATION
// ============================================

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/city-reporter";
mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// ============================================
// 📧 EMAIL CONFIGURATION
// ============================================

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

emailTransporter.verify((error, success) => {
  if (error) {
    console.log("❌ Email configuration error:", error.message);
  } else {
    console.log("✅ Email service ready");
  }
});

// ============================================
// 📤 MULTER CONFIGURATION
// ============================================

const storage_multer = multer.memoryStorage();
const upload = multer({ 
  storage: storage_multer,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// ============================================
// 📊 MONGODB SCHEMAS
// ============================================

// Admin Schema
const adminSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  district: {
    type: String,
    trim: true
  },
  province: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

const Admin = mongoose.model('Admin', adminSchema);

// User Schema
const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

// Location Schema
const locationSchema = new mongoose.Schema({
  latitude: { 
    type: Number, 
    required: true 
  },
  longitude: { 
    type: Number, 
    required: true 
  },
  address: { 
    type: String, 
    required: true 
  },
  city: {
    type: String,
    required: true,
    index: true
  },
  district: {
    type: String,
    required: true,
    index: true
  },
  province: {
    type: String,
    required: true,
    index: true
  },
  fullAddress: {
    type: String
  },
  geolocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      index: '2dsphere'
    }
  }
});

// Admin Action Schema
const adminActionSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  adminName: {
    type: String,
    required: true
  },
  adminPosition: {
    type: String
  },
  actionType: {
    type: String,
    enum: ['comment', 'status_update', 'photo_upload', 'resolution'],
    required: true
  },
  comment: {
    type: String,
    trim: true
  },
  statusChange: {
    from: String,
    to: String
  },
  photoUrl: String,
  photoPath: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Regional Office Schema
const regionalOfficeSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['ds', 'ps'],
    uppercase: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  district: {
    type: String,
    trim: true,
    index: true
  },
  province: {
    type: String,
    trim: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

regionalOfficeSchema.index({ type: 1, district: 1 });
regionalOfficeSchema.index({ isActive: 1 });

const RegionalOffice = mongoose.model('RegionalOffice', regionalOfficeSchema);

// Issue Report Schema - ENHANCED WITH PUBLIC COMMENTS
const issueReportSchema = new mongoose.Schema({
  // Reporter Information
  reporter: {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true
    },
    name: { 
      type: String, 
      required: true 
    },
    email: { 
      type: String, 
      required: true 
    }
  },
  description: { 
    type: String, 
    required: true,
    trim: true
  },
  
  // Location Information
  location: {
    type: locationSchema,
    required: true
  },
  
  // Initial Photo
  photoUrl: { 
    type: String, 
    required: true 
  },
  photoPath: {
    type: String
  },
  
  // Offices info
  offices: [{
    type: { 
      type: String, 
      enum: ['ds', 'ps', 'DS', 'PS'],
      uppercase: true
    },
    name: { type: String, required: true },
    email: { type: String, required: true }
  }],
  
  emailsSent: [{
    email: String,
    sentAt: Date,
    status: { type: String, enum: ['success', 'failed'] },
    messageId: String,
    error: String
  }],
  
  // Admin Resolution Tracking
  resolutionStatus: {
    type: String,
    enum: ['pending', 'resolving', 'processing', 'arranging', 'resolved'],
    default: 'pending',
    index: true
  },
  
  assignedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  assignedAdminName: String,
  assignedAdminPosition: String,
  assignedAt: Date,
  
  // Admin Comments & Updates
  adminActions: [adminActionSchema],
  
  // Evidence Photos from Admin
  evidencePhotos: [{
    url: String,
    path: String,
    uploadedBy: String,
    uploadedAt: Date
  }],
  
  // PUBLIC COMMENTS - NEW FIELD
  publicComments: [{
    _id: String,
    name: { 
      type: String, 
      required: true,
      trim: true
    },
    email: { 
      type: String, 
      required: true,
      lowercase: true,
      trim: true
    },
    text: { 
      type: String, 
      required: true,
      trim: true
    },
    timestamp: { 
      type: Date, 
      default: Date.now 
    }
  }],
  
  // General Status
  status: { 
    type: String, 
    default: 'submitted',
    enum: ['submitted', 'in-progress', 'resolved', 'rejected'],
    index: true
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
issueReportSchema.index({ 'location.city': 1, createdAt: -1 });
issueReportSchema.index({ 'location.district': 1, createdAt: -1 });
issueReportSchema.index({ 'location.province': 1, createdAt: -1 });
issueReportSchema.index({ 'reporter.userId': 1 });
issueReportSchema.index({ resolutionStatus: 1 });
issueReportSchema.index({ assignedAdmin: 1 });
issueReportSchema.index({ status: 1 });
issueReportSchema.index({ 'location.geolocation': '2dsphere' });

const IssueReport = mongoose.model('IssueReport', issueReportSchema);

// ============================================
// 🔧 HELPER FUNCTIONS
// ============================================

async function uploadToFirebase(file) {
  try {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${crypto.randomBytes(16).toString('hex')}.${fileExtension}`;
    const filePath = `issue-reports/${Date.now()}-${fileName}`;

    const storageRef = ref(storage, filePath);
    const metadata = {
      contentType: file.mimetype,
      customMetadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString()
      }
    };

    console.log(`📤 Uploading to Firebase Storage: ${filePath}`);
    await uploadBytes(storageRef, file.buffer, metadata);
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`✅ Firebase Storage URL: ${downloadURL}`);

    return { url: downloadURL, path: filePath };
  } catch (error) {
    console.error("❌ Firebase Upload Error:", error);
    throw new Error(`Firebase upload failed: ${error.message}`);
  }
}

async function sendEmailToOffice(officeEmail, officeName, description, location, imageUrl, reporterInfo) {
  try {
    const mailOptions = {
      from: `SmartCity Reporter <${process.env.EMAIL_USER}>`,
      to: officeEmail,
      subject: `🚨 New City Issue Report - ${location.city}`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .content { padding: 30px 20px; }
            .info-box { background: #f9fafb; border-left: 4px solid #667eea; padding: 16px; margin: 16px 0; border-radius: 6px; }
            .info-box h3 { color: #667eea; margin-bottom: 8px; }
            .location-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 10px 0; }
            .location-item { background: white; border: 1px solid #e5e7eb; padding: 10px; border-radius: 4px; text-align: center; }
            .location-item .label { font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; }
            .location-item .value { font-size: 14px; font-weight: bold; color: #1f2937; margin-top: 4px; }
            .image-container { margin: 20px 0; text-align: center; background: #f3f4f6; padding: 20px; border-radius: 8px; }
            .image-container img { max-width: 100%; height: auto; border-radius: 8px; }
            .badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-top: 8px; }
            .footer { text-align: center; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚨 New City Issue Report</h1>
              <p>Reported to: ${officeName}</p>
            </div>
            
            <div class="content">
              <div class="info-box">
                <h3>👤 Reporter Information</h3>
                <p><strong>Name:</strong> ${reporterInfo.name}</p>
                <p><strong>Email:</strong> ${reporterInfo.email}</p>
              </div>

              <div class="info-box">
                <h3>📝 Issue Description</h3>
                <p>${description}</p>
              </div>
              
              <div class="info-box">
                <h3>📍 Location Details</h3>
                <div class="location-info">
                  <div class="location-item">
                    <div class="label">City</div>
                    <div class="value">${location.city}</div>
                  </div>
                  <div class="location-item">
                    <div class="label">District</div>
                    <div class="value">${location.district}</div>
                  </div>
                  <div class="location-item">
                    <div class="label">Province</div>
                    <div class="value">${location.province}</div>
                  </div>
                </div>
                <p><strong>Address:</strong> ${location.address}</p>
                <p>Coordinates: ${location.latitude}, ${location.longitude}</p>
                <a href="https://www.google.com/maps?q=${location.latitude},${location.longitude}" target="_blank" style="display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; margin-top: 10px; font-weight: 600;">
                  📍 View on Google Maps
                </a>
              </div>

              <div class="image-container">
                <h3>📷 Photo Evidence</h3>
                <img src="${imageUrl}" alt="Issue Photo" />
                <div class="badge">🔥 Stored on Firebase</div>
              </div>

              <div class="info-box">
                <h3>⏰ Report Information</h3>
                <p><strong>Reported at:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Priority:</strong> Normal</p>
              </div>
            </div>
            
            <div class="footer">
              <p><strong>SmartCity Issue Reporter System</strong></p>
              <p>This is an automated email. Please take appropriate action.</p>
              <p style="margin-top: 8px;">For questions, contact: ${reporterInfo.email}</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${officeEmail}: ${info.messageId}`);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email failed to ${officeEmail}:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// 🚀 API ROUTES - HEALTH CHECK
// ============================================

app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: "City Reporter - Complete Admin Issue Management with Public Comments",
    storage: "Firebase Storage",
    database: "MongoDB",
    version: "4.1",
    features: [
      "Issue reporting with location tracking",
      "Admin resolution management",
      "Comments & updates per issue",
      "Evidence photo uploads",
      "Resolution status tracking",
      "Admin action history",
      "Location-based queries",
      "Geolocation support",
      "Public comments system"
    ]
  });
});

// ============================================
// 👥 USER MANAGEMENT ROUTES
// ============================================

app.post("/users/register", async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: "Name and email are required"
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      user.name = name;
      if (phone) user.phone = phone;
      await user.save();
      
      return res.json({
        success: true,
        message: "User information updated",
        user
      });
    }

    user = new User({
      name,
      email: email.toLowerCase(),
      phone
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 👨‍💼 ADMIN MANAGEMENT ROUTES
// ============================================

app.post("/admin/register", async (req, res) => {
  try {
    const { name, email, position, city, district, province, phone } = req.body;

    if (!name || !email || !city) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and city are required"
      });
    }

    let admin = await Admin.findOne({ email: email.toLowerCase() });

    if (admin) {
      admin.name = name;
      admin.position = position;
      admin.city = city;
      admin.district = district;
      admin.province = province;
      if (phone) admin.phone = phone;
      await admin.save();
      
      return res.json({
        success: true,
        message: "Admin updated",
        admin
      });
    }

    admin = new Admin({
      name,
      email: email.toLowerCase(),
      position,
      city,
      district,
      province,
      phone
    });

    await admin.save();

    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      admin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/admin/:id", async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found"
      });
    }

    res.json({ 
      success: true, 
      admin 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get("/admins/city/:city", async (req, res) => {
  try {
    const admins = await Admin.find({ city: new RegExp(req.params.city, 'i') }).sort({ name: 1 });
    
    res.json({ 
      success: true, 
      count: admins.length,
      admins 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// 🏢 OFFICE MANAGEMENT ROUTES
// ============================================

app.post("/offices", async (req, res) => {
  try {
    const { type, name, email, phone, address, district, province } = req.body;

    if (!type || !name || !email) {
      return res.status(400).json({
        success: false,
        error: "Type, name, and email are required"
      });
    }

    const office = new RegionalOffice({
      type: type.toUpperCase(),
      name,
      email: email.toLowerCase(),
      phone,
      address,
      district,
      province
    });

    await office.save();

    res.status(201).json({
      success: true,
      message: "Office created successfully",
      office
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/offices", async (req, res) => {
  try {
    const { type, district, isActive } = req.query;
    
    const filter = {};
    if (type) filter.type = type.toUpperCase();
    if (district) filter.district = district;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const offices = await RegionalOffice.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      count: offices.length,
      offices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/offices/:id", async (req, res) => {
  try {
    const office = await RegionalOffice.findById(req.params.id);
    
    if (!office) {
      return res.status(404).json({
        success: false,
        error: "Office not found"
      });
    }

    res.json({
      success: true,
      office
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put("/offices/:id", async (req, res) => {
  try {
    const updates = req.body;
    
    if (updates.type) updates.type = updates.type.toUpperCase();
    if (updates.email) updates.email = updates.email.toLowerCase();

    const office = await RegionalOffice.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!office) {
      return res.status(404).json({
        success: false,
        error: "Office not found"
      });
    }

    res.json({
      success: true,
      message: "Office updated successfully",
      office
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete("/offices/:id", async (req, res) => {
  try {
    const office = await RegionalOffice.findByIdAndDelete(req.params.id);
    
    if (!office) {
      return res.status(404).json({
        success: false,
        error: "Office not found"
      });
    }

    res.json({
      success: true,
      message: "Office deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 📝 REPORT SUBMISSION ROUTE
// ============================================

app.post("/submit-report", upload.single('photo'), async (req, res) => {
  console.log("\n" + "=".repeat(50));
  console.log("📝 NEW ISSUE REPORT SUBMISSION");
  console.log("=".repeat(50));

  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: "Photo is required" 
      });
    }

    const { description, location, offices, userInfo } = req.body;

    if (!description || !location || !offices || !userInfo) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields" 
      });
    }

    const parsedLocation = JSON.parse(location);
    const parsedOffices = JSON.parse(offices);
    const parsedUserInfo = JSON.parse(userInfo);

    console.log(`\n👤 Reporter: ${parsedUserInfo.fullName} (${parsedUserInfo.email})`);
    console.log(`📋 Description: ${description.substring(0, 50)}...`);
    console.log(`📍 Location: ${parsedLocation.address}`);
    console.log(`🏢 Offices: ${parsedOffices.length}`);

    if (!parsedOffices || parsedOffices.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: "At least one office must be selected" 
      });
    }

    let user = await User.findOne({ email: parsedUserInfo.email.toLowerCase() });
    
    if (!user) {
      console.log("\n👤 Creating new user...");
      user = new User({
        name: parsedUserInfo.fullName,
        email: parsedUserInfo.email.toLowerCase()
      });
      await user.save();
      console.log(`✅ User created with ID: ${user._id}`);
    }

    console.log("\n🔥 Uploading to Firebase Storage...");
    const { url: photoUrl, path: photoPath } = await uploadToFirebase(req.file);

    const officesData = parsedOffices.map(office => ({
      type: office.type.toUpperCase(),
      name: office.name,
      email: office.email
    }));

    const reportLocation = {
      latitude: parsedLocation.latitude,
      longitude: parsedLocation.longitude,
      address: parsedLocation.address,
      city: parsedLocation.city || 'Unknown',
      district: parsedLocation.district || 'Unknown',
      province: parsedLocation.province || 'Unknown',
      fullAddress: parsedLocation.fullAddress || parsedLocation.address,
      geolocation: {
        type: 'Point',
        coordinates: [parsedLocation.longitude, parsedLocation.latitude]
      }
    };

    console.log("\n💾 Saving to MongoDB...");
    const issueReport = new IssueReport({
      reporter: {
        userId: user._id,
        name: user.name,
        email: user.email
      },
      description,
      location: reportLocation,
      photoUrl,
      photoPath,
      offices: officesData,
      emailsSent: [],
      publicComments: []
    });

    const savedReport = await issueReport.save();
    console.log(`✅ Saved to MongoDB with ID: ${savedReport._id}`);

    console.log("\n📧 Sending emails to offices...");
    const emailResults = [];

    for (const office of parsedOffices) {
      const result = await sendEmailToOffice(
        office.email,
        office.name,
        description,
        reportLocation,
        photoUrl,
        { name: user.name, email: user.email }
      );

      emailResults.push({
        email: office.email,
        sentAt: new Date(),
        status: result.success ? 'success' : 'failed',
        messageId: result.messageId || null,
        error: result.error || null
      });
    }

    savedReport.emailsSent = emailResults;
    await savedReport.save();

    const successCount = emailResults.filter(r => r.status === 'success').length;

    console.log("\n" + "=".repeat(50));
    console.log("✅ SUBMISSION COMPLETE");
    console.log(`   📊 Total Emails: ${emailResults.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${emailResults.length - successCount}`);
    console.log(`   🆔 Report ID: ${savedReport._id}`);
    console.log(`   📍 City: ${reportLocation.city}`);
    console.log("=".repeat(50) + "\n");

    res.status(201).json({
      success: true,
      message: `Report submitted successfully! Emails sent to ${successCount} of ${parsedOffices.length} office(s).`,
      data: {
        reportId: savedReport._id,
        reporter: savedReport.reporter,
        photoUrl: photoUrl,
        location: {
          city: reportLocation.city,
          district: reportLocation.district,
          province: reportLocation.province,
          address: reportLocation.address,
          coordinates: {
            latitude: reportLocation.latitude,
            longitude: reportLocation.longitude
          }
        },
        offices: officesData,
        emailsSent: emailResults,
        totalEmails: parsedOffices.length,
        successfulEmails: successCount
      }
    });

  } catch (error) {
    console.error("\n❌ SUBMISSION ERROR:", error.message);
    res.status(500).json({ 
      success: false,
      error: "Failed to submit report",
      message: error.message 
    });
  }
});

// ============================================
// 📊 REPORT RETRIEVAL ROUTES
// ============================================

app.get("/reports", async (req, res) => {
  try {
    const { limit = 50, status, skip = 0 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;

    const reports = await IssueReport
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('reporter.userId', 'name email phone')
      .populate('assignedAdmin', 'name email position city');

    const total = await IssueReport.countDocuments(filter);

    res.json({ 
      success: true,
      count: reports.length,
      total: total,
      reports 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get("/reports/:id", async (req, res) => {
  try {
    const report = await IssueReport
      .findById(req.params.id)
      .populate('reporter.userId', 'name email phone')
      .populate('assignedAdmin', 'name email position city')
      .populate('adminActions.adminId', 'name email position');
    
    if (!report) {
      return res.status(404).json({ 
        success: false,
        error: "Report not found" 
      });
    }
    
    res.json({ 
      success: true,
      report 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.get("/reports/user/:userId", async (req, res) => {
  try {
    const reports = await IssueReport
      .find({ 'reporter.userId': req.params.userId })
      .sort({ createdAt: -1 })
      .populate('reporter.userId', 'name email phone');

    res.json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/reports/by-city/:city", async (req, res) => {
  try {
    const { city } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const reports = await IssueReport
      .find({ 'location.city': new RegExp(city, 'i') })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('reporter.userId', 'name email phone')
      .populate('assignedAdmin', 'name email position');

    const total = await IssueReport.countDocuments({ 'location.city': new RegExp(city, 'i') });

    res.json({
      success: true,
      city,
      count: reports.length,
      total,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/reports/by-district/:district", async (req, res) => {
  try {
    const { district } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const reports = await IssueReport
      .find({ 'location.district': new RegExp(district, 'i') })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await IssueReport.countDocuments({ 'location.district': new RegExp(district, 'i') });

    res.json({
      success: true,
      district,
      count: reports.length,
      total,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/reports/by-province/:province", async (req, res) => {
  try {
    const { province } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const reports = await IssueReport
      .find({ 'location.province': new RegExp(province, 'i') })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await IssueReport.countDocuments({ 'location.province': new RegExp(province, 'i') });

    res.json({
      success: true,
      province,
      count: reports.length,
      total,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/reports/nearby", async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 5000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: "Latitude and longitude required"
      });
    }

    const reports = await IssueReport.find({
      'location.geolocation': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      radius: maxDistance,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.patch("/reports/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['submitted', 'in-progress', 'resolved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status"
      });
    }

    const report = await IssueReport.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    res.json({
      success: true,
      message: "Status updated successfully",
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete("/reports/:id", async (req, res) => {
  try {
    const report = await IssueReport.findByIdAndDelete(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    res.json({
      success: true,
      message: "Report deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 👨‍💼 ADMIN ISSUE MANAGEMENT ROUTES
// ============================================

app.patch("/reports/:id/assign-admin", async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: "Admin ID is required"
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found"
      });
    }

    const report = await IssueReport.findByIdAndUpdate(
      req.params.id,
      {
        assignedAdmin: adminId,
        assignedAdminName: admin.name,
        assignedAdminPosition: admin.position,
        assignedAt: new Date()
      },
      { new: true }
    ).populate('assignedAdmin', 'name email position city');

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    res.json({
      success: true,
      message: "Admin assigned successfully",
      report
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.patch("/reports/:id/resolution-status", async (req, res) => {
  try {
    const { status, adminId } = req.body;

    if (!['pending', 'resolving', 'processing', 'arranging', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Invalid status"
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found"
      });
    }

    const report = await IssueReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    const oldStatus = report.resolutionStatus;

    report.resolutionStatus = status;
    report.adminActions.push({
      adminId: admin._id,
      adminName: admin.name,
      adminPosition: admin.position,
      actionType: 'status_update',
      statusChange: { from: oldStatus, to: status },
      timestamp: new Date()
    });

    await report.save();

    const populatedReport = await IssueReport.findById(req.params.id)
      .populate('adminActions.adminId', 'name email position')
      .populate('assignedAdmin', 'name email position');

    res.json({
      success: true,
      message: "Status updated successfully",
      report: populatedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/reports/:id/comments", async (req, res) => {
  try {
    const { comment, adminId } = req.body;

    if (!comment || !adminId) {
      return res.status(400).json({
        success: false,
        error: "Comment and Admin ID are required"
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found"
      });
    }

    const report = await IssueReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    report.adminActions.push({
      adminId: admin._id,
      adminName: admin.name,
      adminPosition: admin.position,
      actionType: 'comment',
      comment: comment,
      timestamp: new Date()
    });

    await report.save();

    const populatedReport = await IssueReport.findById(req.params.id)
      .populate('adminActions.adminId', 'name email position');

    res.json({
      success: true,
      message: "Comment added successfully",
      report: populatedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/reports/:id/evidence-photo", upload.single('photo'), async (req, res) => {
  try {
    const { adminId } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "Photo is required"
      });
    }

    if (!adminId) {
      return res.status(400).json({
        success: false,
        error: "Admin ID is required"
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin not found"
      });
    }

    const report = await IssueReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    console.log(`📤 Uploading evidence photo for report ${req.params.id}`);
    const { url: photoUrl, path: photoPath } = await uploadToFirebase(req.file);

    report.evidencePhotos.push({
      url: photoUrl,
      path: photoPath,
      uploadedBy: admin.name,
      uploadedAt: new Date()
    });

    report.adminActions.push({
      adminId: admin._id,
      adminName: admin.name,
      adminPosition: admin.position,
      actionType: 'photo_upload',
      photoUrl: photoUrl,
      photoPath: photoPath,
      timestamp: new Date()
    });

    await report.save();

    const populatedReport = await IssueReport.findById(req.params.id)
      .populate('adminActions.adminId', 'name email position');

    res.json({
      success: true,
      message: "Evidence photo uploaded successfully",
      report: populatedReport
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/reports/:id/actions", async (req, res) => {
  try {
    const report = await IssueReport.findById(req.params.id)
      .populate('adminActions.adminId', 'name email position');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    res.json({
      success: true,
      totalActions: report.adminActions.length,
      actions: report.adminActions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/admin/:adminId/assigned-issues", async (req, res) => {
  try {
    const { adminId } = req.params;
    const { status, limit = 50, skip = 0 } = req.query;

    const filter = { assignedAdmin: adminId };
    if (status) filter.resolutionStatus = status;

    const reports = await IssueReport
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('reporter.userId', 'name email phone')
      .populate('adminActions.adminId', 'name email position');

    const total = await IssueReport.countDocuments(filter);

    res.json({
      success: true,
      count: reports.length,
      total,
      reports
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 💬 PUBLIC COMMENTS ROUTES
// ============================================

app.post("/reports/:id/public-comments", async (req, res) => {
  console.log("\n" + "=".repeat(50));
  console.log("💬 NEW PUBLIC COMMENT SUBMISSION");
  console.log("=".repeat(50));

  try {
    const { name, email, text } = req.body;

    // Validation
    if (!name || !email || !text) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and comment text are required"
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format"
      });
    }

    // Find the report
    const report = await IssueReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    console.log(`\n📝 Report ID: ${req.params.id}`);
    console.log(`📍 City: ${report.location?.city || 'Unknown'}`);
    console.log(`👤 Commenter: ${name} (${email})`);
    console.log(`💬 Comment: ${text.substring(0, 50)}...`);

    // Create new comment object
    const newComment = {
      _id: Date.now().toString(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      text: text.trim(),
      timestamp: new Date()
    };

    // Initialize publicComments array if it doesn't exist
    if (!report.publicComments) {
      report.publicComments = [];
    }

    // Add comment to report
    report.publicComments.push(newComment);
    
    // Save to database
    await report.save();

    console.log(`\n✅ Comment saved successfully!`);
    console.log(`📊 Total comments on this report: ${report.publicComments.length}`);
    console.log("=".repeat(50) + "\n");

    // Return success response
    res.status(201).json({
      success: true,
      message: "Comment submitted successfully",
      comment: newComment,
      totalComments: report.publicComments.length,
      reportInfo: {
        id: report._id,
        city: report.location?.city,
        district: report.location?.district,
        province: report.location?.province,
        description: report.description.substring(0, 100)
      }
    });

  } catch (error) {
    console.error("\n❌ COMMENT SUBMISSION ERROR:", error.message);
    console.error(error.stack);
    
    res.status(500).json({
      success: false,
      error: "Failed to submit comment",
      message: error.message
    });
  }
});

// Get all public comments for a report
app.get("/reports/:id/public-comments", async (req, res) => {
  try {
    const report = await IssueReport.findById(req.params.id)
      .select('publicComments location.city location.district location.province description');
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    res.json({
      success: true,
      reportId: report._id,
      city: report.location?.city,
      totalComments: report.publicComments?.length || 0,
      comments: report.publicComments || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a specific public comment (optional - for moderation)
app.delete("/reports/:id/public-comments/:commentId", async (req, res) => {
  try {
    const { id, commentId } = req.params;

    const report = await IssueReport.findById(id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Report not found"
      });
    }

    if (!report.publicComments) {
      return res.status(404).json({
        success: false,
        error: "No comments found"
      });
    }

    // Find and remove the comment
    const initialLength = report.publicComments.length;
    report.publicComments = report.publicComments.filter(
      comment => comment._id !== commentId
    );

    if (report.publicComments.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: "Comment not found"
      });
    }

    await report.save();

    res.json({
      success: true,
      message: "Comment deleted successfully",
      remainingComments: report.publicComments.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 📊 STATISTICS ROUTES
// ============================================

app.get("/statistics/location", async (req, res) => {
  try {
    const reportsByCity = await IssueReport.aggregate([
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const reportsByDistrict = await IssueReport.aggregate([
      { $group: { _id: '$location.district', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const reportsByProvince = await IssueReport.aggregate([
      { $group: { _id: '$location.province', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const totalReports = await IssueReport.countDocuments();

    res.json({
      success: true,
      statistics: {
        totalReports,
        byCity: reportsByCity,
        byDistrict: reportsByDistrict,
        byProvince: reportsByProvince
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/statistics/status", async (req, res) => {
  try {
    const reportsByStatus = await IssueReport.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const reportsByResolutionStatus = await IssueReport.aggregate([
      { $group: { _id: '$resolutionStatus', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const totalReports = await IssueReport.countDocuments();

    res.json({
      success: true,
      statistics: {
        totalReports,
        byStatus: reportsByStatus,
        byResolutionStatus: reportsByResolutionStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/statistics/admin-activity", async (req, res) => {
  try {
    const adminActivity = await IssueReport.aggregate([
      { $unwind: '$adminActions' },
      { $group: { 
        _id: '$adminActions.adminName', 
        totalActions: { $sum: 1 },
        comments: { $sum: { $cond: [{ $eq: ['$adminActions.actionType', 'comment'] }, 1, 0] } },
        statusUpdates: { $sum: { $cond: [{ $eq: ['$adminActions.actionType', 'status_update'] }, 1, 0] } },
        photoUploads: { $sum: { $cond: [{ $eq: ['$adminActions.actionType', 'photo_upload'] }, 1, 0] } }
      } },
      { $sort: { totalActions: -1 } }
    ]);

    res.json({
      success: true,
      adminActivity
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 🧪 SEED DATA ROUTE (FOR TESTING)
// ============================================

app.post("/seed/offices", async (req, res) => {
  try {
    const sampleOffices = [
      { type: "DS", name: "Divisional Secretariat Colombo", email: "ds.colombo@gov.lk", district: "Colombo", province: "Western" },
      { type: "PS", name: "Colombo Central Police Station", email: "ps.colombo@police.lk", district: "Colombo", province: "Western" },
      
      { type: "DS", name: "Divisional Secretariat Gampaha", email: "ds.gampaha@gov.lk", district: "Gampaha", province: "Western" },
      { type: "PS", name: "Gampaha Police Station", email: "ps.gampaha@police.lk", district: "Gampaha", province: "Western" },
      
      { type: "DS", name: "Divisional Secretariat Kandy", email: "ds.kandy@gov.lk", district: "Kandy", province: "Central" },
      { type: "PS", name: "Kandy Police Station", email: "ps.kandy@police.lk", district: "Kandy", province: "Central" },
      
      { type: "DS", name: "Divisional Secretariat Galle", email: "ds.galle@gov.lk", district: "Galle", province: "Southern" },
      { type: "PS", name: "Galle Police Station", email: "ps.galle@police.lk", district: "Galle", province: "Southern" }
    ];

    const createdOffices = await RegionalOffice.insertMany(sampleOffices);

    res.status(201).json({
      success: true,
      message: `${createdOffices.length} offices created successfully`,
      offices: createdOffices
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/seed/admins", async (req, res) => {
  try {
    const sampleAdmins = [
      { name: "John Silva", email: "john.silva@colombo.gov.lk", position: "Senior Administrator", city: "Colombo", district: "Colombo", province: "Western", phone: "+94112223344" },
      { name: "Maria Fernando", email: "maria.fernando@colombo.gov.lk", position: "Issue Manager", city: "Colombo", district: "Colombo", province: "Western", phone: "+94112225566" },
      { name: "Ravi Perera", email: "ravi.perera@gampaha.gov.lk", position: "Administrative Officer", city: "Gampaha", district: "Gampaha", province: "Western", phone: "+94332234455" },
      { name: "Nisha Jayasuriya", email: "nisha.jayasuriya@kandy.gov.lk", position: "Resolution Coordinator", city: "Kandy", district: "Kandy", province: "Central", phone: "+94812334566" }
    ];

    const createdAdmins = await Admin.insertMany(sampleAdmins);

    res.status(201).json({
      success: true,
      message: `${createdAdmins.length} admins created successfully`,
      admins: createdAdmins
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 🚀 START SERVER
// ============================================

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 CITY REPORTER - COMPLETE SYSTEM WITH PUBLIC COMMENTS (v4.1)");
  console.log("=".repeat(70));
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📍 AVAILABLE ENDPOINTS:`);
  console.log(`\n   🏥 HEALTH:`);
  console.log(`   GET    /`);
  console.log(`\n   👥 USER MANAGEMENT:`);
  console.log(`   POST   /users/register`);
  console.log(`   GET    /users`);
  console.log(`   GET    /users/:id`);
  console.log(`\n   👨‍💼 ADMIN MANAGEMENT:`);
  console.log(`   POST   /admin/register`);
  console.log(`   GET    /admin/:id`);
  console.log(`   GET    /admins/city/:city`);
  console.log(`\n   🏢 OFFICE MANAGEMENT:`);
  console.log(`   POST   /offices`);
  console.log(`   GET    /offices`);
  console.log(`   GET    /offices/:id`);
  console.log(`   PUT    /offices/:id`);
  console.log(`   DELETE /offices/:id`);
  console.log(`\n   📝 REPORT SUBMISSION:`);
  console.log(`   POST   /submit-report (multipart/form-data)`);
  console.log(`\n   📊 REPORT RETRIEVAL:`);
  console.log(`   GET    /reports`);
  console.log(`   GET    /reports/:id`);
  console.log(`   GET    /reports/user/:userId`);
  console.log(`   GET    /reports/by-city/:city`);
  console.log(`   GET    /reports/by-district/:district`);
  console.log(`   GET    /reports/by-province/:province`);
  console.log(`   GET    /reports/nearby?latitude=X&longitude=Y&maxDistance=5000`);
  console.log(`\n   👨‍💼 ADMIN ISSUE MANAGEMENT:`);
  console.log(`   PATCH  /reports/:id/assign-admin`);
  console.log(`   PATCH  /reports/:id/resolution-status`);
  console.log(`   POST   /reports/:id/comments`);
  console.log(`   POST   /reports/:id/evidence-photo (multipart/form-data)`);
  console.log(`   GET    /reports/:id/actions`);
  console.log(`   GET    /admin/:adminId/assigned-issues`);
  console.log(`\n   💬 PUBLIC COMMENTS:`);
  console.log(`   POST   /reports/:id/public-comments`);
  console.log(`   GET    /reports/:id/public-comments`);
  console.log(`   DELETE /reports/:id/public-comments/:commentId`);
  console.log(`\n   📊 STATISTICS:`);
  console.log(`   GET    /statistics/location`);
  console.log(`   GET    /statistics/status`);
  console.log(`   GET    /statistics/admin-activity`);
  console.log(`\n   🧪 TESTING/SEEDING:`);
  console.log(`   POST   /seed/offices`);
  console.log(`   POST   /seed/admins`);
  console.log(`\n🔧 Services Status:`);
  
  setTimeout(() => {
    const mongoStatus = mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected';
    console.log(`   MongoDB: ${mongoStatus}`);
  }, 1000);
  
  console.log(`   Firebase: 🔥 Ready`);
  console.log(`   Email: ${process.env.EMAIL_USER ? '✅ Configured' : '❌ Not Configured'}`);
  console.log(`\n📊 DATABASE FEATURES:`);
  console.log(`   ✅ Admin Management`);
  console.log(`   ✅ Issue Resolution Tracking`);
  console.log(`   ✅ Admin Comments & Updates`);
  console.log(`   ✅ Evidence Photo Storage`);
  console.log(`   ✅ Location-based Queries`);
  console.log(`   ✅ Geolocation Support`);
  console.log(`   ✅ Admin Action History`);
  console.log(`   ✅ Firebase Storage Integration`);
  console.log(`   ✅ Public Comments System`);
  console.log("\n" + "=".repeat(70));
  console.log("\n⏳ Waiting for requests...\n");
});
