const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const allowedFileTypes = ['.pdf', '.png', '.jpg', '.jpeg'];
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedFileTypes.includes(ext)) {
      return cb(new Error('Only PDF/JPG/JPEG/PNG files are allowed'));
    }
    cb(null, true);
  }
});

app.use('/uploads', express.static(uploadDir));

//db connection
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

(async () => {
  try {
    await connection.query('SELECT 1');
    console.log('MySQL Connected');
  } catch (err) {
    console.error('DB Connection Failed:', err.message);
  }
})();

// Serve static files from frontend
//app.use(express.static('../frontend'));

//authentication
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
const validatePhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
};
const validRoles = ['participant', 'organizer', 'volunteer', 'faculty', 'admin'];
const validateUserInput = (req, res, next) => {
  const { name, email, phone, college, year, role } = req.body;
  if (!name || !email || !phone || !college || !year) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (name.length < 3 || name.length > 100) {
    return res.status(400).json({ error: 'Name should be between 3-100 characters' });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!validatePhone(phone)) {
    return res.status(400).json({ error: 'Invalid phone number' });
  }
  if (college.length < 3 || college.length > 150) {
    return res.status(400).json({ error: 'College name should be between 3-150 characters' });
  }
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid user role' });
  }

  next();
};
const validateQueryInput = (req, res, next) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Name, email, subject, and message are required' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (message.length < 10) {
    return res.status(400).json({ error: 'Message should be at least 10 characters' });
  }
  next();
};
const jwtSecret = process.env.JWT_SECRET;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || (process.env.ADMIN_PASSWORD ? bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10) : null);
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.admin = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.post('/upload/id-card', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.status(201).json({
    success: true,
    data: {
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      size: req.file.size
    }
  });
});

//all users
app.get('/users', async(req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const offset = (page - 1) * limit;
    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM users');
    const total = countResult[0].total;
    const [users] = await connection.query('SELECT id, name, email, phone, college, year, role, id_card_url, created_at FROM users LIMIT ? OFFSET ?',[parseInt(limit), offset]);
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching users'});
  }
});

//specific user
app.get('/users/:id', async (req, res) => {
  try {
    const [users] = await connection.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, data: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching user' });
  }
});

//new user
app.post('/users', validateUserInput, async (req, res) => {
  try {
    const { name, email, phone, college, year, password, role, id_card_url } = req.body;
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'Password with at least 6 characters is required' });
    }
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const safeRole = role && validRoles.includes(role) ? role : 'participant';
    const [result] = await connection.query(
      'INSERT INTO users (name, email, phone, college, year, password_hash, role, id_card_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, phone, college, year, passwordHash, safeRole, id_card_url || null]
    );
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error registering user' });
  }
});

//update user
app.put('/users/:id', validateUserInput, async (req, res) => {
  try {
    const { name, email, phone, college, year, role, id_card_url } = req.body;
    const safeRole = role && validRoles.includes(role) ? role : 'participant';
    const [result] = await connection.query(
      'UPDATE users SET name = ?, email = ?, phone = ?, college = ?, year = ?, role = ?, id_card_url = ? WHERE id = ?',
      [name, email, phone, college, year, safeRole, id_card_url || null, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [users] = await connection.query(
      'SELECT id, name, email, role, password_hash FROM users WHERE email = ?',
      [email]
    );

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, {
      expiresIn: '4h'
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

//delete user
app.delete('/users/:id', async (req, res) => {
  try {
    const [result] = await connection.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deleting user' });
  }
});

//all events
app.get('/events', async (req, res) => {
  try {
    const category = req.query.category;
    const term = req.query.term;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const sort = req.query.sort || 'date_asc';
    let query = 'SELECT * FROM events WHERE 1=1';
    let params = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (term) {
      query += ' AND (title LIKE ? OR description LIKE ? OR category LIKE ?)';
      params.push(`%${term}%`, `%${term}%`, `%${term}%`);
    }
    if (fromDate) {
      query += ' AND date >= ?';
      params.push(fromDate);
    }
    if (toDate) {
      query += ' AND date <= ?';
      params.push(toDate);
    }

    if (sort === 'date_desc') {
      query += ' ORDER BY date DESC, time DESC';
    } else {
      query += ' ORDER BY date ASC, time ASC';
    }

    const [events] = await connection.query(query, params);
    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching events' });
  }
});

//individual event 
app.get('/events/users/:id', async (req, res) => {
  try {
    const [events] = await connection.query('SELECT * FROM events WHERE id = ?', [req.params.id]);
    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true, data: events[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching event' });
  }
});

//event categories
app.get('/events/list/categories', async (req, res) => {
  try {
    const [categories] = await connection.query('SELECT DISTINCT category FROM events ORDER BY category ASC');
    const categoryList = categories.map(c => c.category);
    res.json({
      success: true,
      data: categoryList
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching categories' });
  }
});

//event creation
app.post('/events/create', async (req, res) => {
  try {
    const { title, category, description, rules, eligibility, prize_details, date, time, venue, max_participants, registration_fee, image_url } = req.body;
    if (!title || !category || !description || !date || !time) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const [result] = await connection.query(
      'INSERT INTO events (title, category, description, rules, eligibility, prize_details, date, time, venue, max_participants, registration_fee, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, category, description, rules || null, eligibility || null, prize_details || null, date, time, venue, max_participants, registration_fee, image_url]
    );
    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      eventId: result.insertId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating event' });
  }
});

//event updation
app.put('/events/:id', async (req, res) => {
  try {
    const { title, category, description, rules, eligibility, prize_details, date, time, venue, max_participants, registration_fee, image_url } = req.body;
    const [result] = await connection.query(
      'UPDATE events SET title = ?, category = ?, description = ?, rules = ?, eligibility = ?, prize_details = ?, date = ?, time = ?, venue = ?, max_participants = ?, registration_fee = ?, image_url = ? WHERE id = ?',
      [title, category, description, rules || null, eligibility || null, prize_details || null, date, time, venue, max_participants, registration_fee, image_url, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true, message: 'Event updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating event' });
  }
});

//event deletion
app.delete('/events/:id', async (req, res) => {
  try {
    const [result] = await connection.query('DELETE FROM events WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deleting event' });
  }
});

//all reg details for one user
app.get('/reg/user/:userId', async (req, res) => {
  try {
    const [registrations] = await connection.query(`SELECT r.id, r.user_id, r.event_id, r.registration_date, r.status, e.title, e.date, e.time, e.category,
      e.venue FROM registrations r
      JOIN events e ON r.event_id = e.id WHERE r.user_id = ? ORDER BY e.date DESC`,[req.params.userId]);
    res.json({
      success: true,
      data: registrations
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching registrations' });
  }
});

//event regs for admins
app.get('/reg/event/:eventId', async (req, res) => {
  try {
    const [registrations] = await connection.query(`SELECT r.id, r.user_id, r.registration_date, r.status, u.name, u.email, u.phone, u.college, u.year
      FROM registrations r JOIN users u ON r.user_id = u.id WHERE r.event_id = ? ORDER BY r.registration_date DESC`,[req.params.eventId]);
    res.json({
      success: true,
      data: registrations,
      count: registrations.length
    });
  } catch (error) {
    console.error('Error fetching event registrations:', error);
    res.status(500).json({ error: 'Error fetching registrations' });
  }
});

//event reg
app.post('/reg/user', async (req, res) => {
  try {
    const { user_id, event_id } = req.body;
    if (!user_id || !event_id) {
      return res.status(400).json({ error: 'user_id and event_id are required' });
    }
    const [users] = await connection.query('SELECT id, name, email FROM users WHERE id = ?', [user_id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [events] = await connection.query('SELECT id, title FROM events WHERE id = ?', [event_id]);

    if (events.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const [existing] = await connection.query('SELECT id FROM registrations WHERE user_id = ? AND event_id = ?',[user_id, event_id]);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already registered for this event' });
    }

    const [result] = await connection.query('INSERT INTO registrations (user_id, event_id, status) VALUES (?, ?, ?)',[user_id, event_id, 'confirmed']);

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: users[0].email,
        subject: `Registration confirmed for ${events[0].title}`,
        text: `Hi ${users[0].name},\n\nYour registration for "${events[0].title}" is confirmed.\n\nThank you for registering.`,
        html: `<p>Hi ${users[0].name},</p><p>Your registration for "<strong>${events[0].title}</strong>" is confirmed.</p><p>Thank you for registering.</p>`,
      });
    } catch (emailError) {
      console.error('Email send failed:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      registrationId: result.insertId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error processing registration' });
  }
});

//cancel
app.put('/reg/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['confirmed', 'pending', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const [result] = await connection.query('UPDATE registrations SET status = ? WHERE id = ?',[status, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    res.json({ success: true, message: `Registration ${status} successfully` });
  } catch (error) {
    console.error('Error updating registration:', error);
    res.status(500).json({ error: 'Error updating registration' });
  }
});

//delete a reg
app.delete('/reg/:id', async (req, res) => {
  try {
    const [result] = await connection.query('DELETE FROM registrations WHERE id = ?',[req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json({ success: true, message: 'Registration deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deleting registration' });
  }
});

app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username !== process.env.ADMIN_USERNAME || !adminPasswordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const passwordMatches = await bcrypt.compare(password, adminPasswordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ username }, jwtSecret, { expiresIn: '1h' });
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER,
        subject: `Admin login alert for ${username}`,
        text: `Admin ${username} logged in at ${new Date().toISOString()}`,
        html: `<p>Admin <strong>${username}</strong> logged in at <strong>${new Date().toISOString()}</strong>.</p>`,
      });
    } catch (emailError) {
      console.error('Admin login email failed:', emailError);
    }
    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: username
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

//admin stats
app.get('/admin/dashboard/stats', authenticateAdmin, async (req, res) => {
  try {
    const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
    const [eventCount] = await connection.query('SELECT COUNT(*) as count FROM events');
    const [registrationCount] = await connection.query('SELECT COUNT(*) as count FROM registrations');
    const [queryCount] = await connection.query('SELECT COUNT(*) as count FROM queries');
    const [newQueryCount] = await connection.query('SELECT COUNT(*) as count FROM queries WHERE status = "new"');
    res.json({
      success: true,
      data: {
        totalUsers: userCount[0].count,
        totalEvents: eventCount[0].count,
        totalRegistrations: registrationCount[0].count,
        totalQueries: queryCount[0].count,
        newQueries: newQueryCount[0].count
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching statistics' });
  }
});

//get recent details
app.get('/admin/dashboard/recent', authenticateAdmin, async (req, res) => {
  try {
    const [recentUsers] = await connection.query(
      'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC LIMIT 5'
    );
    const [recentRegistrations] = await connection.query(
      `SELECT r.id, u.name, e.title, r.registration_date 
       FROM registrations r JOIN users u ON r.user_id = u.id
       JOIN events e ON r.event_id = e.id ORDER BY r.registration_date DESC LIMIT 5`
    );
    const [recentQueries] = await connection.query('SELECT id, name, subject, created_at, status FROM queries ORDER BY created_at DESC LIMIT 5');
    res.json({
      success: true,
      data: {
        recentUsers,
        recentRegistrations,
        recentQueries
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching recent activities' });
  }
});

//all registrations
app.get('/admin/registrations/all', authenticateAdmin, async (req, res) => {
  try {
    const [registrations] = await connection.query(`SELECT r.id, r.user_id, r.event_id, r.registration_date, r.status, u.name, u.email, e.title
    FROM registrations r JOIN users u ON r.user_id = u.id JOIN events e ON r.event_id = e.id ORDER BY r.registration_date DESC`);
    res.json({
      success: true,
      data: registrations,
      count: registrations.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching registrations' });
  }
});

// Get all queries
app.get('/query/all', async (req, res) => {
  try {
    const status = req.query.status;
    let query = 'SELECT * FROM queries WHERE 1=1';
    let params = [];
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';
    const [queries] = await connection.query(query, params);
    res.json({
      success: true,
      data: queries,
      count: queries.length
    });
  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(500).json({ error: 'Error fetching queries' });
  }
});

// get query by id
app.get('/query/:id', async (req, res) => {
  try {
    const [queries] = await connection.query('SELECT * FROM queries WHERE id = ?', [req.params.id]);
    if (queries.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }
    res.json({ success: true, data: queries[0] });
  } catch (error) {
    console.error('Error fetching query:', error);
    res.status(500).json({ error: 'Error fetching query' });
  }
});

// Submit new query
app.post('/query', validateQueryInput, async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    const [result] = await connection.query('INSERT INTO queries (name, email, phone, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone, subject, message, 'new']);
    res.status(201).json({
      success: true,
      message: 'Your query has been submitted. We will get back to you soon.',
      queryId: result.insertId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error submitting query' });
  }
});

// Respond to query
app.put('/query/:id/respond', async (req, res) => {
  try {
    const { admin_response } = req.body;
    if (!admin_response) {
      return res.status(400).json({ error: 'Response is required' });
    }

    const [queryRows] = await connection.query('SELECT id, name, email, subject FROM queries WHERE id = ?', [req.params.id]);
    if (queryRows.length === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    const [result] = await connection.query('UPDATE queries SET status = ?, admin_response = ?, responded_at = NOW() WHERE id = ?',
      ['resolved', admin_response, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: queryRows[0].email,
        subject: `Response to your query: ${queryRows[0].subject}`,
        text: `Hi ${queryRows[0].name},\n\n${admin_response}\n\n- PRABUDDHA 2026 Team`,
        html: `<p>Hi ${queryRows[0].name},</p><p>${admin_response}</p><p>- PRABUDDHA 2026 Team</p>`
      });
    } catch (emailError) {
      console.error('Failed to send query response email:', emailError);
    }

    res.json({ success: true, message: 'Response sent successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error processing response' });
  }
});

// Update query
app.put('/query/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !['new', 'in-progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [result] = await connection.query('UPDATE queries SET status = ? WHERE id = ?',[status, req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Query not found' });
    }

    res.json({ success: true, message: `Query status updated to ${status}` });
  } catch (error) {
    console.error('Error updating query:', error);
    res.status(500).json({ error: 'Error updating query' });
  }
});

// Get FAQ
app.get('/query/faq/all', async (req, res) => {
  try {
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faq'`
    );

    const columnNames = columns.map((column) => column.COLUMN_NAME);
    const orderColumn = columnNames.includes('order_position')
      ? 'order_position'
      : columnNames.includes('order_num')
        ? 'order_num'
        : 'id';

    const [faq] = await connection.query(`SELECT * FROM faq ORDER BY ${orderColumn} ASC`);
    res.json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    res.status(500).json({ error: 'Error fetching FAQ' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
