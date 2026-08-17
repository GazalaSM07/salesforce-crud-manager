const express = require("express");
const cors = require("cors");
const session = require("express-session");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 10000;

// ============================================================
// URLs
// ============================================================

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://salesforce-crud-frontend-gaco.onrender.com";

const API_URL =
  process.env.API_URL ||
  "https://salesforce-crud-backend-rffk.onrender.com";

// ============================================================
// Salesforce OAuth configuration
// ============================================================

const SALESFORCE_CLIENT_ID =
  process.env.SALESFORCE_CLIENT_ID ||
  process.env.CLIENT_ID;

const SALESFORCE_CLIENT_SECRET =
  process.env.SALESFORCE_CLIENT_SECRET ||
  process.env.CLIENT_SECRET;

const SALESFORCE_CALLBACK_URL =
  process.env.SALESFORCE_CALLBACK_URL ||
  `${API_URL}/auth/callback`;

const SALESFORCE_LOGIN_URL =
  process.env.SALESFORCE_LOGIN_URL ||
  "https://login.salesforce.com";

const SALESFORCE_API_VERSION =
  process.env.SALESFORCE_API_VERSION || "v66.0";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "PLEASE_CHANGE_THIS_SECRET";

// ============================================================
// Basic validation
// ============================================================

if (!SALESFORCE_CLIENT_ID) {
  console.error(
    "ERROR: SALESFORCE_CLIENT_ID / CLIENT_ID is missing."
  );
}

if (!SALESFORCE_CLIENT_SECRET) {
  console.error(
    "ERROR: SALESFORCE_CLIENT_SECRET / CLIENT_SECRET is missing."
  );
}

// ============================================================
// Render reverse proxy
// ============================================================

app.set("trust proxy", 1);

// ============================================================
// Middleware
// ============================================================

app.use(express.json({ limit: "2mb" }));

// ============================================================
// CORS
// ============================================================

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
      ];

      // Allow requests without an Origin header
      // such as direct browser/server requests.
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked CORS origin:", origin);

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ============================================================
// SESSION
// ============================================================
//
// IMPORTANT:
// DO NOT use:
//
// domain: ".onrender.com"
//
// The cookie belongs to the backend host.
// The frontend accesses it through:
// fetch(API_URL, { credentials: "include" })
//
// ============================================================

app.use(
  session({
    name: "salesforce.sid",

    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    cookie: {
      httpOnly: true,

      secure: true,

      sameSite: "none",

      // IMPORTANT:
      // No "domain" property.
      // This makes it a host-only cookie
      // for the Render backend.

      path: "/",

      maxAge:
        1000 *
        60 *
        60 *
        24 *
        7,
    },
  })
);

// ============================================================
// Helpers
// ============================================================

function requireSalesforceSession(
  req,
  res,
  next
) {
  if (
    !req.session ||
    !req.session.salesforce ||
    !req.session.salesforce.accessToken ||
    !req.session.salesforce.instanceUrl
  ) {
    return res.status(401).json({
      error:
        "Not authenticated with Salesforce.",
    });
  }

  next();
}

function getSalesforceApiUrl(req, path) {
  const instanceUrl =
    req.session.salesforce.instanceUrl;

  return `${instanceUrl}/services/data/${SALESFORCE_API_VERSION}${path}`;
}

async function salesforceRequest(
  req,
  path,
  options = {}
) {
  const accessToken =
    req.session.salesforce.accessToken;

  const response = await fetch(
    getSalesforceApiUrl(req, path),
    {
      ...options,

      headers: {
        Authorization: `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",

        ...(options.headers || {}),
      },
    }
  );

  const text = await response.text();

  let data;

  try {
    data = text
      ? JSON.parse(text)
      : {};
  } catch {
    data = {
      message: text,
    };
  }

  return {
    response,
    data,
  };
}

function sendSalesforceError(
  res,
  response,
  data
) {
  return res.status(response.status).json({
    error:
      data?.[0]?.message ||
      data?.message ||
      "Salesforce request failed.",

    details: data,
  });
}

// ============================================================
// Health check
// ============================================================

app.get("/", (req, res) => {
  res.json({
    message:
      "Salesforce CRUD backend is running.",

    status: "ok",
  });
});

// ============================================================
// DEBUG SESSION
// ============================================================

app.get("/auth/debug", (req, res) => {
  res.set(
    "Cache-Control",
    "no-store"
  );

  return res.json({
    sessionId: req.sessionID,

    hasSession: Boolean(req.session),

    authenticated: Boolean(
      req.session?.salesforce?.accessToken
    ),

    instanceUrl:
      req.session?.salesforce?.instanceUrl ||
      null,

    cookie: {
      name: "salesforce.sid",

      secure: true,

      sameSite: "none",

      domain: "HOST-ONLY",

      path: "/",
    },
  });
});

// ============================================================
// AUTH STATUS
// ============================================================

app.get(
  "/auth/status",
  (req, res) => {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.set(
      "Pragma",
      "no-cache"
    );

    res.set(
      "Expires",
      "0"
    );

    const hasSession =
      Boolean(req.session);

    const hasSalesforceSession =
      Boolean(
        req.session?.salesforce?.accessToken &&
          req.session?.salesforce?.instanceUrl
      );

    console.log(
      "===================================="
    );

    console.log(
      "AUTH STATUS REQUEST"
    );

    console.log(
      "Session ID:",
      req.sessionID
    );

    console.log(
      "Has session:",
      hasSession
    );

    console.log(
      "Has Salesforce session:",
      hasSalesforceSession
    );

    console.log(
      "Cookie header:",
      req.headers.cookie
        ? "PRESENT"
        : "MISSING"
    );

    if (hasSalesforceSession) {
      console.log(
        "Instance URL:",
        req.session.salesforce.instanceUrl
      );
    }

    console.log(
      "===================================="
    );

    return res.json({
      authenticated:
        hasSalesforceSession,

      hasSession,

      hasSalesforceSession,

      instanceUrl:
        req.session?.salesforce?.instanceUrl ||
        null,
    });
  }
);

// ============================================================
// SALESFORCE LOGIN
// ============================================================

app.get(
  "/auth/login",
  (req, res) => {
    try {
      const frontend =
        req.query.frontend ||
        FRONTEND_URL;

      // --------------------------------------------------------
      // Store OAuth information in session
      // --------------------------------------------------------

      req.session.oauthFrontend =
        frontend;

      const state = Buffer.from(
        JSON.stringify({
          sessionId:
            req.sessionID,

          frontend,

          timestamp: Date.now(),
        })
      ).toString("base64url");

      req.session.oauthState =
        state;

      console.log(
        "===================================="
      );

      console.log(
        "STARTING SALESFORCE OAUTH"
      );

      console.log(
        "Session ID:",
        req.sessionID
      );

      console.log(
        "Frontend:",
        frontend
      );

      console.log(
        "Callback:",
        SALESFORCE_CALLBACK_URL
      );

      console.log(
        "===================================="
      );

      // --------------------------------------------------------
      // IMPORTANT:
      // Save session before redirecting to Salesforce.
      // --------------------------------------------------------

      req.session.save(
        (saveError) => {
          if (saveError) {
            console.error(
              "OAuth session save failed:",
              saveError
            );

            return res
              .status(500)
              .json({
                error:
                  "Could not initialize OAuth session.",
              });
          }

          const authorizationUrl =
            new URL(
              `${SALESFORCE_LOGIN_URL}/services/oauth2/authorize`
            );

          authorizationUrl.searchParams.set(
            "response_type",
            "code"
          );

          authorizationUrl.searchParams.set(
            "client_id",
            SALESFORCE_CLIENT_ID
          );

          authorizationUrl.searchParams.set(
            "redirect_uri",
            SALESFORCE_CALLBACK_URL
          );

          authorizationUrl.searchParams.set(
            "state",
            state
          );

          console.log(
            "OAuth session saved."
          );

          console.log(
            "Redirecting to Salesforce..."
          );

          return res.redirect(
            authorizationUrl.toString()
          );
        }
      );
    } catch (error) {
      console.error(
        "OAuth login error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not start Salesforce login.",
      });
    }
  }
);

// ============================================================
// SALESFORCE OAUTH CALLBACK
// ============================================================

app.get(
  "/auth/callback",
  async (req, res) => {
    console.log(
      "===================================="
    );

    console.log(
      "SALESFORCE OAUTH CALLBACK"
    );

    console.log(
      "Session ID:",
      req.sessionID
    );

    console.log(
      "Cookie header:",
      req.headers.cookie
        ? "PRESENT"
        : "MISSING"
    );

    console.log(
      "Has OAuth state:",
      Boolean(
        req.session?.oauthState
      )
    );

    console.log(
      "===================================="
    );

    try {
      const {
        code,
        state,
        error,
        error_description,
      } = req.query;

      // --------------------------------------------------------
      // Salesforce OAuth error
      // --------------------------------------------------------

      if (error) {
        console.error(
          "Salesforce OAuth error:",
          error,
          error_description
        );

        return res.status(400).send(`
          <h2>Salesforce Login Failed</h2>
          <p>${error}</p>
          <p>${error_description || ""}</p>
        `);
      }

      // --------------------------------------------------------
      // Authorization code
      // --------------------------------------------------------

      if (!code) {
        return res.status(400).send(
          "Missing Salesforce authorization code."
        );
      }

      // --------------------------------------------------------
      // Verify state
      // --------------------------------------------------------

      if (
        !state ||
        !req.session.oauthState ||
        state !== req.session.oauthState
      ) {
        console.error(
          "OAuth state mismatch."
        );

        console.error(
          "Received state:",
          state
        );

        console.error(
          "Session state:",
          req.session.oauthState
        );

        return res.status(400).send(
          "OAuth session expired or invalid. Please try logging in again."
        );
      }

      // --------------------------------------------------------
      // Exchange authorization code
      // --------------------------------------------------------

      const tokenResponse =
        await fetch(
          `${SALESFORCE_LOGIN_URL}/services/oauth2/token`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body: new URLSearchParams({
              grant_type:
                "authorization_code",

              code,

              client_id:
                SALESFORCE_CLIENT_ID,

              client_secret:
                SALESFORCE_CLIENT_SECRET,

              redirect_uri:
                SALESFORCE_CALLBACK_URL,
            }),
          }
        );

      const tokenText =
        await tokenResponse.text();

      let tokenData;

      try {
        tokenData =
          tokenText
            ? JSON.parse(tokenText)
            : {};
      } catch {
        tokenData = {
          error_description:
            tokenText,
        };
      }

      if (!tokenResponse.ok) {
        console.error(
          "Salesforce token exchange failed:",
          tokenData
        );

        return res
          .status(401)
          .send(`
            <h2>Salesforce OAuth Failed</h2>
            <pre>${JSON.stringify(
              tokenData,
              null,
              2
            )}</pre>
          `);
      }

      if (
        !tokenData.access_token ||
        !tokenData.instance_url
      ) {
        console.error(
          "Invalid Salesforce token response:",
          tokenData
        );

        return res.status(401).send(
          "Salesforce did not return a valid access token."
        );
      }

      // --------------------------------------------------------
      // Save Salesforce credentials
      // --------------------------------------------------------

      req.session.salesforce = {
        accessToken:
          tokenData.access_token,

        instanceUrl:
          tokenData.instance_url,

        refreshToken:
          tokenData.refresh_token ||
          null,

        issuedAt: Date.now(),
      };

      const frontend =
        req.session.oauthFrontend ||
        FRONTEND_URL;

      delete req.session.oauthState;

      delete req.session.oauthFrontend;

      console.log(
        "===================================="
      );

      console.log(
        "SALESFORCE OAUTH SUCCESSFUL"
      );

      console.log(
        "Session ID:",
        req.sessionID
      );

      console.log(
        "Instance URL:",
        tokenData.instance_url
      );

      console.log(
        "Frontend:",
        frontend
      );

      console.log(
        "Saving Salesforce session..."
      );

      console.log(
        "===================================="
      );

      // --------------------------------------------------------
      // VERY IMPORTANT
      //
      // Do not redirect until the session
      // has actually been saved.
      // --------------------------------------------------------

      req.session.save(
        (saveError) => {
          if (saveError) {
            console.error(
              "Salesforce session save failed:",
              saveError
            );

            return res.status(500).send(
              "Salesforce login succeeded, but the session could not be saved."
            );
          }

          console.log(
            "Salesforce session saved successfully."
          );

          console.log(
            "Session ID after save:",
            req.sessionID
          );

          console.log(
            "Has Salesforce session:",
            Boolean(
              req.session.salesforce
            )
          );

          console.log(
            "Redirecting to frontend..."
          );

          console.log(
            "===================================="
          );

          return res.redirect(
            frontend
          );
        }
      );
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      return res.status(500).send(`
        <h2>OAuth callback failed</h2>
        <p>${error.message}</p>
      `);
    }
  }
);

// ============================================================
// LOGOUT
// ============================================================

app.get(
  "/auth/logout",
  (req, res) => {
    const cookieName =
      "salesforce.sid";

    req.session.destroy(
      (error) => {
        if (error) {
          console.error(
            "Session destroy error:",
            error
          );

          return res.status(500).json({
            error:
              "Could not log out.",
          });
        }

        // IMPORTANT:
        // No domain here either.
        res.clearCookie(
          cookieName,
          {
            httpOnly: true,

            secure: true,

            sameSite: "none",

            path: "/",
          }
        );

        return res.json({
          success: true,
        });
      }
    );
  }
);

// ============================================================
// OBJECT FIELDS
// ============================================================

const OBJECT_FIELDS = {
  Account: [
    "Id",
    "Name",
    "Phone",
    "Website",
    "Industry",
    "Type",
  ],

  Opportunity: [
    "Id",
    "Name",
    "Amount",
    "StageName",
    "CloseDate",
    "Type",
  ],

  Lead: [
    "Id",
    "FirstName",
    "LastName",
    "Company",
    "Email",
    "Phone",
  ],

  Contact: [
    "Id",
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "Department",
  ],

  Case: [
    "Id",
    "Subject",
    "Status",
    "Priority",
    "Origin",
    "Description",
  ],
};

const ALLOWED_OBJECTS =
  Object.keys(OBJECT_FIELDS);

// ============================================================
// GET RECORDS
// ============================================================

app.get(
  "/api/records/:object",
  requireSalesforceSession,
  async (req, res) => {
    try {
      const objectName =
        req.params.object;

      if (
        !ALLOWED_OBJECTS.includes(
          objectName
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid Salesforce object.",
        });
      }

      let page =
        Number(req.query.page) || 1;

      if (page < 1) {
        page = 1;
      }

      const pageSize = 20;

      const offset =
        (page - 1) * pageSize;

      if (offset > 2000) {
        return res.status(400).json({
          error:
            "Salesforce OFFSET limit reached. Use cursor pagination for datasets larger than 2,000 records.",
        });
      }

      const fields =
        OBJECT_FIELDS[
          objectName
        ].join(", ");

      const query = `
        SELECT ${fields}
        FROM ${objectName}
        ORDER BY CreatedDate DESC, Id DESC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `.replace(/\s+/g, " ");

      console.log(
        `Loading ${objectName} page ${page}`
      );

      const {
        response,
        data,
      } =
        await salesforceRequest(
          req,
          `/query?q=${encodeURIComponent(
            query
          )}`
        );

      if (!response.ok) {
        return sendSalesforceError(
          res,
          response,
          data
        );
      }

      const records =
        data.records || [];

      const totalSize =
        Number(
          data.totalSize || 0
        );

      const hasMore =
        offset + records.length <
        totalSize;

      return res.json({
        records,

        totalSize,

        page,

        pageSize,

        hasMore,
      });
    } catch (error) {
      console.error(
        "Get records error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load Salesforce records.",

        details: error.message,
      });
    }
  }
);

// ============================================================
// CREATE
// ============================================================

app.post(
  "/api/records/:object",
  requireSalesforceSession,
  async (req, res) => {
    try {
      const objectName =
        req.params.object;

      if (
        !ALLOWED_OBJECTS.includes(
          objectName
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid Salesforce object.",
        });
      }

      const fields =
        OBJECT_FIELDS[
          objectName
        ].filter(
          (field) =>
            field !== "Id"
        );

      const payload = {};

      fields.forEach(
        (field) => {
          if (
            req.body[field] !==
              undefined &&
            req.body[field] !==
              null &&
            req.body[field] !==
              ""
          ) {
            payload[field] =
              req.body[field];
          }
        }
      );

      const {
        response,
        data,
      } =
        await salesforceRequest(
          req,
          `/sobjects/${objectName}`,
          {
            method: "POST",

            body: JSON.stringify(
              payload
            ),
          }
        );

      if (!response.ok) {
        return sendSalesforceError(
          res,
          response,
          data
        );
      }

      return res.status(201).json(
        data
      );
    } catch (error) {
      console.error(
        "Create record error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to create Salesforce record.",

        details: error.message,
      });
    }
  }
);

// ============================================================
// UPDATE
// ============================================================

app.patch(
  "/api/records/:object/:id",
  requireSalesforceSession,
  async (req, res) => {
    try {
      const objectName =
        req.params.object;

      const recordId =
        req.params.id;

      if (
        !ALLOWED_OBJECTS.includes(
          objectName
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid Salesforce object.",
        });
      }

      if (!recordId) {
        return res.status(400).json({
          error:
            "Record ID is required.",
        });
      }

      const fields =
        OBJECT_FIELDS[
          objectName
        ].filter(
          (field) =>
            field !== "Id"
        );

      const payload = {};

      fields.forEach(
        (field) => {
          if (
            req.body[field] !==
              undefined &&
            req.body[field] !==
              null &&
            req.body[field] !==
              ""
          ) {
            payload[field] =
              req.body[field];
          }
        }
      );

      const {
        response,
        data,
      } =
        await salesforceRequest(
          req,
          `/sobjects/${objectName}/${encodeURIComponent(
            recordId
          )}`,
          {
            method: "PATCH",

            body: JSON.stringify(
              payload
            ),
          }
        );

      if (!response.ok) {
        return sendSalesforceError(
          res,
          response,
          data
        );
      }

      return res.json({
        success: true,

        id: recordId,
      });
    } catch (error) {
      console.error(
        "Update record error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to update Salesforce record.",

        details: error.message,
      });
    }
  }
);

// ============================================================
// DELETE
// ============================================================

app.delete(
  "/api/records/:object/:id",
  requireSalesforceSession,
  async (req, res) => {
    try {
      const objectName =
        req.params.object;

      const recordId =
        req.params.id;

      if (
        !ALLOWED_OBJECTS.includes(
          objectName
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid Salesforce object.",
        });
      }

      if (!recordId) {
        return res.status(400).json({
          error:
            "Record ID is required.",
        });
      }

      const {
        response,
        data,
      } =
        await salesforceRequest(
          req,
          `/sobjects/${objectName}/${encodeURIComponent(
            recordId
          )}`,
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {
        return sendSalesforceError(
          res,
          response,
          data
        );
      }

      return res.json({
        success: true,

        id: recordId,
      });
    } catch (error) {
      console.error(
        "Delete record error:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to delete Salesforce record.",

        details: error.message,
      });
    }
  }
);

// ============================================================
// 404
// ============================================================

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        "Route not found.",
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    res.status(500).json({
      error:
        "Internal server error.",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      "===================================="
    );

    console.log(
      "Salesforce CRUD backend started"
    );

    console.log(
      "Port:",
      PORT
    );

    console.log(
      "Frontend:",
      FRONTEND_URL
    );

    console.log(
      "Callback:",
      SALESFORCE_CALLBACK_URL
    );

    console.log(
      "Session cookie: HOST-ONLY"
    );

    console.log(
      "SameSite: none"
    );

    console.log(
      "Secure: true"
    );

    console.log(
      "Salesforce API:",
      SALESFORCE_API_VERSION
    );

    console.log(
      "===================================="
    );
  }
);