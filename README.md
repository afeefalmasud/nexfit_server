# ⚡ NexFit API Server

The backend REST API server for **NexFit**, a modern fitness and class management platform. Built with **Node.js** and **Express.js**, this server manages member stats, class bookings, favorite workouts, and trainer application workflows.

---

## ✨ API Features

- **📊 Member Dashboard Stats**: Aggregates booked classes count, favorite workouts count, and application statuses.
- **🏋️ Class Booking Management**: Endpoints to book, view, and manage user workout schedules.
- **❤️ Favorites System**: API handlers for toggling and fetching favorite fitness classes.
- **📝 Trainer Onboarding Workflow**: Endpoints to submit trainer applications and handle approval/rejection logic.
- **🛡️ CORS & Security**: Configured for secure client-server communication with Next.js frontend applications.

---

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database / ORM**: MongoDB / Mongoose *(or PostgreSQL / Prisma depending on your setup)*
- **Middleware**: `cors`, `dotenv`, `express.json()`

