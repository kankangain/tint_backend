CREATE DATABASE prabuddha_2026;
USE prabuddha_2026;

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15) NOT NULL,
  college VARCHAR(150) NOT NULL,
  year VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('participant','organizer','volunteer','faculty','admin') DEFAULT 'participant',
  id_card_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description LONGTEXT NOT NULL,
  rules LONGTEXT,
  eligibility VARCHAR(255),
  prize_details LONGTEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  venue VARCHAR(150),
  max_participants INT,
  registration_fee DECIMAL(10,2) DEFAULT 0,
  image_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE registrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('confirmed','pending','cancelled') DEFAULT 'confirmed',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE KEY unique_registration (user_id, event_id)
);

CREATE TABLE queries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  subject VARCHAR(200) NOT NULL,
  message LONGTEXT NOT NULL,
  status ENUM('new','in-progress','resolved') DEFAULT 'new',
  admin_response LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE faq_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE faq (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT,
  question VARCHAR(255) NOT NULL,
  answer LONGTEXT NOT NULL,
  order_position INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES faq_categories(id) ON DELETE SET NULL
);

CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE admin_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) NOT NULL,
  role_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
);

INSERT INTO roles (role_name) VALUES
('participant'),
('organizer'),
('volunteer'),
('faculty'),
('admin');

CREATE INDEX idx_event_category ON events(category);
CREATE INDEX idx_event_date ON events(date);
CREATE INDEX idx_registration_user ON registrations(user_id);
CREATE INDEX idx_registration_event ON registrations(event_id);
CREATE INDEX idx_query_status ON queries(status);
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_query_email ON queries(email);
