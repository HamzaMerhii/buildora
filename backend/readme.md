# 🚀 FastAPI MongoDB CRUD API with JWT Authentication

A modern RESTful API built with FastAPI, MongoDB, PyMongo, and JWT authentication.

This project demonstrates a clean Layered Architecture with a dedicated Service Layer, featuring secure user authentication, protected routes, and complete CRUD operations for products.

---

## 📌 Table of Contents

- Overview
- Tech Stack
- Project Architecture
- Authentication Flow
- API Endpoints
- Getting Started
  - Prerequisites
  - Installation
  - Environment Variables
- Running the Application
- API Documentation
- Testing Authentication with Swagger
- Database & Security
- Project Learning Goals

---

## 🎯 Overview

This project provides a clean, scalable template for building backend APIs using FastAPI and MongoDB. It avoids full Object Document Mappers (ODMs) to leverage PyMongo directly alongside Pydantic for fast request/response validation and explicit database operations.

---

## 🛠 Tech Stack

- FastAPI — Web framework for building the API
- Uvicorn — ASGI server implementation
- MongoDB — NoSQL document database
- PyMongo — MongoDB Python driver (no ODM)
- Pydantic — Data validation and settings management
- PyJWT — JWT creation and verification
- pwdlib + Argon2 — Secure password hashing
- Pydantic Settings — Environment configuration handling
- Swagger UI / OpenAPI — Interactive API documentation

---

## 🏗 Project Architecture

The project strictly follows a Layered Architecture pattern with clear separation of concerns across a dedicated service layer:

app/
├── core/
│   ├── config.py          # Environment settings
│   └── security.py        # Password hashing & JWT helpers
├── database/
│   └── mongodb.py         # MongoDB connection setup
├── dependencies/
│   └── auth.py            # Auth dependencies & route guards
├── routers/
│   ├── auth.py            # Registration & login endpoints
│   └── products.py        # Product CRUD endpoints
├── schemas/
│   ├── auth.py            # Token schemas
│   ├── user.py            # User validation schemas
│   └── product.py         # Product validation schemas
├── services/
│   ├── auth_service.py    # Authentication business logic
│   └── product_service.py # Product management logic
└── main.py                # FastAPI application entry point

Layer Responsibilities:
- routers/: API route definitions and HTTP request/response handling
- services/: Core business logic and database interactions
- database/: MongoDB client setup and collection bindings
- schemas/: Pydantic data models for request validation and response serialisation
- dependencies/: FastAPI dependencies (e.g., token verification, current user lookup)
- core/: Application settings and security utilities
- main.py: FastAPI app initialisation, middleware, and router registration

                    Client
                      │
                      ▼
                ┌───────────┐
                │  Routers  │
                └─────┬─────┘
                      │
                      ▼
                ┌───────────┐
                │  Services │
                └─────┬─────┘
                      │
                      ▼
                ┌───────────┐
                │  PyMongo  │
                └─────┬─────┘
                      │
                      ▼
                  MongoDB

---

## 🔐 Authentication Flow

The application uses standard JWT Bearer Token authentication. Passwords are strictly hashed with Argon2 before persistence.

Register:
Client ──► Hash Password (Argon2) ──► Store User in MongoDB

Login:
Email + Password ──► Verify Argon2 Hash ──► Generate JWT ──► Return Access Token

Protected Request:
Client (Authorization: Bearer <JWT>) ──► Dependency Guard ──► Verify JWT ──► Inject Current User ──► Route Handler

---

## 📡 API Endpoints

Authentication:
- POST /auth/register  (Public)       - Register a new user account
- POST /auth/login     (Public)       - Authenticate and retrieve JWT access token

Products:
- POST   /products/     (JWT Required) - Create a new product
- GET    /products/     (JWT Required) - Retrieve all products
- GET    /products/{id} (JWT Required) - Retrieve a product by ID
- PUT    /products/{id} (JWT Required) - Update an existing product
- DELETE /products/{id} (JWT Required) - Delete a product by ID

---

## ⚡ Getting Started

Prerequisites:
- Python 3.12+ installed
- MongoDB instance running (MongoDB Atlas or local cluster)

Installation:

1. Clone the repository:
   git clone <your-repository-url>
   cd fastapi-mongodb-api

2. Create and activate a virtual environment:
   # Linux / macOS
   python3 -m venv .venv
   source .venv/bin/activate

   # Windows
   python -m venv .venv
   .venv\Scripts\activate

3. Install dependencies:
   pip install -r requirements.txt

Environment Variables:

Create a .env file in the root directory:

MONGODB_URL=mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/
DATABASE_NAME=fastapi_demo

SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

⚠️ Warning: Never commit .env files or sensitive credentials to version control.

---

## 🚀 Running the Application

Start the development server using the FastAPI CLI:

   fastapi dev app/main.py

Or using Uvicorn directly:

   uvicorn app.main:app --reload

The server will start at http://127.0.0.1:8000.

---

## 📖 API Documentation

FastAPI automatically generates interactive documentation accessible once the app is running:

- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

---



## 🎓 Project Learning Goals

- Clean RESTful API architecture using FastAPI.
- Direct MongoDB integration with PyMongo.
- Dependency injection patterns for authentication guards.
- Secure JWT creation, verification, and password hashing using Argon2.
- Environment-driven configuration setup with Pydantic Settings.
- Automated documentation generation with OpenAPI / Swagger UI.

---
