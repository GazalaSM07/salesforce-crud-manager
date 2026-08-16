require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

// ==================================================
// CONFIGURATION
// ==================================================

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

const SALESFORCE_LOGIN_URL =
  process.env.SALESFORCE_LOGIN_URL ||
  "https://login.salesforce.com";

const CLIENT_ID =
  process.env.SALESFORCE_CLIENT_ID;

const CLIENT_SECRET =
  process.env.SALESFORCE_CLIENT_SECRET;

const REDIRECT_URI =
  process.env.SALESFORCE_REDIRECT_URI ||
  "http://localhost:5000/oauth/callback";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "change-this-secret";

const API_VERSION =
  process.env.SALESFORCE_API_VERSION ||
  "v66.0";

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

// ==================================================
// VALIDATION
// ==================================================

if (!CLIENT_ID) {
  console.warn(
    "WARNING: SALESFORCE_CLIENT_ID is not configured."
  );
}

if (!CLIENT_SECRET) {
  console.warn(
    "WARNING: SALESFORCE_CLIENT_SECRET is not configured."
  );
}

// ==================================================
// EXPRESS
// ==================================================

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(express.json());

// ==================================================
// CORS
// ==================================================

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// ==================================================
// SESSION
// ==================================================

app.use(
  session({
    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure: IS_PRODUCTION,

      sameSite: "lax",

      maxAge:
        1000 * 60 * 60,
    },
  })
);

// ==================================================
// PKCE
// ==================================================

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function createCodeVerifier() {
  return base64UrlEncode(
    crypto.randomBytes(32)
  );
}

function createCodeChallenge(
  verifier
) {
  return base64UrlEncode(
    crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
  );
}

function createState() {
  return base64UrlEncode(
    crypto.randomBytes(32)
  );
}

// ==================================================
// HEALTH
// ==================================================

app.get(
  "/health",
  (req, res) => {
    res.json({
      status: "ok",

      application:
        "Salesforce CRUD Manager Backend",

      salesforceConfigured:
        Boolean(
          CLIENT_ID &&
          CLIENT_SECRET
        ),

      apiVersion:
        API_VERSION,
    });
  }
);

// ==================================================
// ROOT
// ==================================================

app.get(
  "/",
  (req, res) => {
    res.json({
      application:
        "Salesforce CRUD Manager",

      status: "running",

      salesforceConfigured:
        Boolean(
          CLIENT_ID &&
          CLIENT_SECRET
        ),

      frontend:
        FRONTEND_URL,

      redirectUri:
        REDIRECT_URI,

      apiVersion:
        API_VERSION,
    });
  }
);

// ==================================================
// LOGIN
// ==================================================

app.get(
  "/auth/login",
  (req, res) => {
    try {
      if (!CLIENT_ID) {
        return res
          .status(500)
          .send(
            "Salesforce Client ID is not configured."
          );
      }

      if (!CLIENT_SECRET) {
        return res
          .status(500)
          .send(
            "Salesforce Client Secret is not configured."
          );
      }

      const codeVerifier =
        createCodeVerifier();

      const codeChallenge =
        createCodeChallenge(
          codeVerifier
        );

      const state =
        createState();

      req.session.codeVerifier =
        codeVerifier;

      req.session.oauthState =
        state;

      const params =
        new URLSearchParams({
          response_type: "code",

          client_id:
            CLIENT_ID,

          redirect_uri:
            REDIRECT_URI,

          code_challenge:
            codeChallenge,

          code_challenge_method:
            "S256",

          state,
        });

      const authorizationUrl =
        `${SALESFORCE_LOGIN_URL}` +
        `/services/oauth2/authorize?` +
        params.toString();

      console.log(
        "=========================================="
      );

      console.log(
        "Starting Salesforce OAuth login"
      );

      console.log(
        "Client ID configured:",
        Boolean(CLIENT_ID)
      );

      console.log(
        "Client Secret configured:",
        Boolean(CLIENT_SECRET)
      );

      console.log(
        "Redirect URI:",
        REDIRECT_URI
      );

      console.log(
        "=========================================="
      );

      res.redirect(
        authorizationUrl
      );
    } catch (error) {
      console.error(
        "OAuth login error:",
        error
      );

      res
        .status(500)
        .send(
          "OAuth login failed."
        );
    }
  }
);

// ==================================================
// OAUTH CALLBACK
// ==================================================

app.get(
  "/oauth/callback",
  async (req, res) => {
    try {
      const {
        code,
        state,
        error,
        error_description,
      } = req.query;

      if (error) {
        console.error(
          "Salesforce OAuth error:",
          error,
          error_description
        );

        return res
          .status(400)
          .send(
            `Salesforce OAuth error: ${
              error_description ||
              error
            }`
          );
      }

      if (!code) {
        return res
          .status(400)
          .send(
            "Authorization code missing."
          );
      }

      if (
        !state ||
        state !==
          req.session.oauthState
      ) {
        return res
          .status(400)
          .send(
            "Invalid OAuth state."
          );
      }

      const codeVerifier =
        req.session.codeVerifier;

      if (!codeVerifier) {
        return res
          .status(400)
          .send(
            "PKCE code verifier missing from session."
          );
      }

      const tokenParams =
        new URLSearchParams();

      tokenParams.append(
        "grant_type",
        "authorization_code"
      );

      tokenParams.append(
        "client_id",
        CLIENT_ID
      );

      tokenParams.append(
        "client_secret",
        CLIENT_SECRET
      );

      tokenParams.append(
        "redirect_uri",
        REDIRECT_URI
      );

      tokenParams.append(
        "code",
        code
      );

      tokenParams.append(
        "code_verifier",
        codeVerifier
      );

      const tokenResponse =
        await fetch(
          `${SALESFORCE_LOGIN_URL}` +
            `/services/oauth2/token`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              tokenParams.toString(),
          }
        );

      const tokenText =
        await tokenResponse.text();

      let tokenData = {};

      try {
        tokenData =
          tokenText
            ? JSON.parse(
                tokenText
              )
            : {};
      } catch {
        tokenData = {
          raw: tokenText,
        };
      }

      if (!tokenResponse.ok) {
        console.error(
          "Salesforce token exchange failed:",
          tokenData
        );

        return res
          .status(
            tokenResponse.status
          )
          .json({
            error:
              "Salesforce token exchange failed.",

            details:
              tokenData,
          });
      }

      if (
        !tokenData.access_token ||
        !tokenData.instance_url
      ) {
        return res
          .status(500)
          .json({
            error:
              "Salesforce did not return a valid access token.",
          });
      }

      req.session.salesforce = {
        accessToken:
          tokenData.access_token,

        instanceUrl:
          tokenData.instance_url,

        tokenType:
          tokenData.token_type ||
          "Bearer",

        issuedAt:
          Date.now(),
      };

      delete req.session.codeVerifier;
      delete req.session.oauthState;

      console.log(
        "=========================================="
      );

      console.log(
        "Salesforce OAuth successful"
      );

      console.log(
        "Instance URL:",
        tokenData.instance_url
      );

      console.log(
        "=========================================="
      );

      res.redirect(
        FRONTEND_URL
      );
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      res
        .status(500)
        .send(
          "OAuth callback failed."
        );
    }
  }
);

// ==================================================
// AUTH STATUS
// ==================================================

app.get(
  "/auth/status",
  (req, res) => {
    if (
      req.session &&
      req.session.salesforce
    ) {
      return res.json({
        authenticated: true,

        instanceUrl:
          req.session.salesforce
            .instanceUrl,
      });
    }

    return res.json({
      authenticated: false,
    });
  }
);

// ==================================================
// LOGOUT
// ==================================================

app.get(
  "/auth/logout",
  (req, res) => {
    req.session.destroy(
      (error) => {
        if (error) {
          console.error(
            "Logout error:",
            error
          );

          return res
            .status(500)
            .json({
              error:
                "Logout failed.",
            });
        }

        res.json({
          success: true,
        });
      }
    );
  }
);

// ==================================================
// AUTH MIDDLEWARE
// ==================================================

function requireSalesforceAuth(
  req,
  res,
  next
) {
  if (
    !req.session ||
    !req.session.salesforce
  ) {
    return res
      .status(401)
      .json({
        error:
          "Not authenticated with Salesforce.",
      });
  }

  next();
}

// ==================================================
// ALLOWED OBJECTS
// ==================================================

const allowedObjects = [
  "Account",
  "Opportunity",
  "Lead",
  "Contact",
  "Case",
];

// ==================================================
// FIELDS
// ==================================================

const fieldMap = {
  Account:
    "Id,Name,Phone,Website,Industry,Type",

  Opportunity:
    "Id,Name,Amount,StageName,CloseDate,Type",

  Lead:
    "Id,FirstName,LastName,Company,Email,Phone",

  Contact:
    "Id,FirstName,LastName,Email,Phone,Department",

  Case:
    "Id,Subject,Status,Priority,Origin,Description",
};

// ==================================================
// SALESFORCE SESSION
// ==================================================

function getSalesforceSession(req) {
  if (
    !req.session ||
    !req.session.salesforce
  ) {
    return null;
  }

  return req.session.salesforce;
}

// ==================================================
// GET RECORDS
// ==================================================

app.get(
  "/api/records/:objectName",
  requireSalesforceAuth,
  async (req, res) => {
    try {
      const {
        objectName,
      } = req.params;

      if (
        !allowedObjects.includes(
          objectName
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid Salesforce object.",
          });
      }

      const requestedPage =
        parseInt(
          req.query.page || "1",
          10
        );

      const page =
        Number.isFinite(
          requestedPage
        ) &&
        requestedPage >= 1
          ? requestedPage
          : 1;

      const pageSize = 20;

      const offset =
        (page - 1) *
        pageSize;

      const salesforce =
        getSalesforceSession(req);

      if (!salesforce) {
        return res
          .status(401)
          .json({
            error:
              "Salesforce session expired.",
          });
      }

      const {
        accessToken,
        instanceUrl,
      } = salesforce;

      // ------------------------------
      // COUNT
      // ------------------------------

      const countQuery =
        `SELECT COUNT() ` +
        `FROM ${objectName}`;

      const countUrl =
        `${instanceUrl}` +
        `/services/data/${API_VERSION}` +
        `/query/?q=` +
        encodeURIComponent(
          countQuery
        );

      const countResponse =
        await fetch(countUrl, {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        });

      const countText =
        await countResponse.text();

      let countData = {};

      try {
        countData =
          countText
            ? JSON.parse(
                countText
              )
            : {};
      } catch {
        countData = {};
      }

      if (!countResponse.ok) {
        return res
          .status(
            countResponse.status
          )
          .json({
            error:
              "Failed to count Salesforce records.",

            details:
              countData,
          });
      }

      const totalSize =
        Number(
          countData.totalSize || 0
        );

      // ------------------------------
      // RECORD QUERY
      // ------------------------------

      const query =
        `SELECT ${fieldMap[objectName]} ` +
        `FROM ${objectName} ` +
        `ORDER BY CreatedDate DESC, Id ASC ` +
        `LIMIT ${pageSize} ` +
        `OFFSET ${offset}`;

      const url =
        `${instanceUrl}` +
        `/services/data/${API_VERSION}` +
        `/query/?q=` +
        encodeURIComponent(query);

      const response =
        await fetch(url, {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        });

      const text =
        await response.text();

      let data = {};

      try {
        data =
          text
            ? JSON.parse(text)
            : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        return res
          .status(response.status)
          .json({
            error:
              "Failed to load Salesforce records.",

            details:
              data,
          });
      }

      const records =
        data.records || [];

      const hasMore =
        offset +
          records.length <
        totalSize;

      return res.json({
        object:
          objectName,

        records,

        totalSize,

        page,

        pageSize,

        hasMore,

        nextPage:
          hasMore
            ? page + 1
            : null,
      });
    } catch (error) {
      console.error(
        "Get records error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not load Salesforce records.",

          details:
            error.message,
        });
    }
  }
);

// ==================================================
// CREATE
// ==================================================

app.post(
  "/api/records/:objectName",
  requireSalesforceAuth,
  async (req, res) => {
    try {
      const {
        objectName,
      } = req.params;

      if (
        !allowedObjects.includes(
          objectName
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid Salesforce object.",
          });
      }

      const salesforce =
        getSalesforceSession(req);

      const {
        accessToken,
        instanceUrl,
      } = salesforce;

      const url =
        `${instanceUrl}` +
        `/services/data/${API_VERSION}` +
        `/sobjects/${objectName}`;

      const response =
        await fetch(url, {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            req.body
          ),
        });

      const text =
        await response.text();

      let data = {};

      try {
        data =
          text
            ? JSON.parse(text)
            : {};
      } catch {
        data = {
          message: text,
        };
      }

      if (!response.ok) {
        return res
          .status(response.status)
          .json({
            error:
              "Failed to create Salesforce record.",

            details:
              data,
          });
      }

      res
        .status(201)
        .json({
          success: true,

          id: data.id,

          message:
            `${objectName} created successfully.`,
        });
    } catch (error) {
      console.error(
        "Create error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not create Salesforce record.",

          details:
            error.message,
        });
    }
  }
);

// ==================================================
// UPDATE
// ==================================================

app.patch(
  "/api/records/:objectName/:recordId",
  requireSalesforceAuth,
  async (req, res) => {
    try {
      const {
        objectName,
        recordId,
      } = req.params;

      if (
        !allowedObjects.includes(
          objectName
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid Salesforce object.",
          });
      }

      if (!recordId) {
        return res
          .status(400)
          .json({
            error:
              "Record ID is required.",
          });
      }

      const salesforce =
        getSalesforceSession(req);

      const {
        accessToken,
        instanceUrl,
      } = salesforce;

      const url =
        `${instanceUrl}` +
        `/services/data/${API_VERSION}` +
        `/sobjects/${objectName}/${recordId}`;

      const response =
        await fetch(url, {
          method: "PATCH",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            req.body
          ),
        });

      const text =
        await response.text();

      let data = {};

      try {
        data =
          text
            ? JSON.parse(text)
            : {};
      } catch {
        data = {
          message: text,
        };
      }

      if (!response.ok) {
        return res
          .status(response.status)
          .json({
            error:
              "Failed to update Salesforce record.",

            details:
              data,
          });
      }

      res.json({
        success: true,

        id: recordId,

        message:
          `${objectName} updated successfully.`,
      });
    } catch (error) {
      console.error(
        "Update error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not update Salesforce record.",

          details:
            error.message,
        });
    }
  }
);

// ==================================================
// DELETE
// ==================================================

app.delete(
  "/api/records/:objectName/:recordId",
  requireSalesforceAuth,
  async (req, res) => {
    try {
      const {
        objectName,
        recordId,
      } = req.params;

      if (
        !allowedObjects.includes(
          objectName
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid Salesforce object.",
          });
      }

      if (!recordId) {
        return res
          .status(400)
          .json({
            error:
              "Record ID is required.",
          });
      }

      const salesforce =
        getSalesforceSession(req);

      const {
        accessToken,
        instanceUrl,
      } = salesforce;

      const url =
        `${instanceUrl}` +
        `/services/data/${API_VERSION}` +
        `/sobjects/${objectName}/${recordId}`;

      const response =
        await fetch(url, {
          method: "DELETE",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        });

      const text =
        await response.text();

      if (!response.ok) {
        let data = {};

        try {
          data =
            text
              ? JSON.parse(text)
              : {};
        } catch {
          data = {
            message: text,
          };
        }

        return res
          .status(response.status)
          .json({
            error:
              "Failed to delete Salesforce record.",

            details:
              data,
          });
      }

      res.json({
        success: true,

        id: recordId,

        message:
          `${objectName} deleted successfully.`,
      });
    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Could not delete Salesforce record.",

          details:
            error.message,
        });
    }
  }
);

// ==================================================
// 404
// ==================================================

app.use(
  (req, res) => {
    res
      .status(404)
      .json({
        error:
          "Route not found.",
      });
  }
);

// ==================================================
// ERROR HANDLER
// ==================================================

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

    res
      .status(500)
      .json({
        error:
          "Internal server error.",

        details:
          error.message,
      });
  }
);

// ==================================================
// START
// ==================================================

app.listen(
  PORT,
  () => {
    console.log(
      "=========================================="
    );

    console.log(
      "Salesforce CRUD Manager Backend"
    );

    console.log(
      `Server: http://localhost:${PORT}`
    );

    console.log(
      `Frontend: ${FRONTEND_URL}`
    );

    console.log(
      `OAuth callback: ${REDIRECT_URI}`
    );

    console.log(
      `Salesforce API: ${API_VERSION}`
    );

    console.log(
      "Pagination: 20 records per request"
    );

    console.log(
      "Salesforce configured:",
      Boolean(
        CLIENT_ID &&
        CLIENT_SECRET
      )
    );

    console.log(
      "=========================================="
    );
  }
);