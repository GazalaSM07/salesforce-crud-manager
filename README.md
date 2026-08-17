# Salesforce CRUD Manager

A full-stack web application that allows users to securely connect to Salesforce and perform CRUD operations on standard Salesforce objects through a custom web interface.

## Assignment

Associate Software Engineer – Assignment #1

The application was built according to the assignment requirements and provides a custom interface for managing Salesforce records without using the native Salesforce UI.

---

## Features

### Salesforce Authentication

- OAuth 2.0 authentication with Salesforce
- External Client App integration
- PKCE-based OAuth flow
- Secure session-based authentication
- Salesforce access tokens are stored server-side
- Salesforce password is never stored by the application

### Salesforce Objects

The application supports the following Salesforce standard objects:

- Account
- Opportunity
- Lead
- Contact
- Case

### CRUD Operations

Users can:

- Create records
- View records
- Update records
- Delete records
- Search records

All CRUD operations are performed through the Salesforce REST API.

### Pagination / Infinite Scroll

Records are loaded in batches of **20 records at a time**.

When the user reaches the bottom of the records list:

1. The application detects the scroll position.
2. The next 20 records are requested from the backend.
3. The new records are appended to the existing records.
4. This continues until all Salesforce records are loaded.

The interface displays:

> Loading next 20 records...

while additional records are being retrieved.

### Dynamic Object Selection

A central dropdown allows the user to switch between:

- Accounts
- Opportunities
- Leads
- Contacts
- Cases

The fields and records displayed in the table automatically change according to the selected Salesforce object.

### Search

Users can search the currently loaded records using the search box.

### Responsive UI

The application includes a responsive dashboard interface designed for desktop and smaller screen sizes.

---

# Technology Stack

## Frontend

- React
- JavaScript
- Vite
- CSS
- Fetch API
- Intersection Observer API

## Backend

- Node.js
- Express.js
- Express Session
- CORS
- OAuth 2.0
- PKCE
- Salesforce REST API

## Salesforce

- Salesforce Developer Org
- External Client App
- Salesforce REST API
- OAuth 2.0 Authorization Code Flow

---

# Project Structure

```text
salesforce-crud-manager/
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   │
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── ...
│
└── README.md
