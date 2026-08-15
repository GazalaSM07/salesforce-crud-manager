require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

const PORT = 5000;

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

const API_VERSION = "v66.0";


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());


// ==================================================
// SESSION
// ==================================================

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "salesforce-crud-manager-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
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


function createCodeChallenge(verifier) {
  return base64UrlEncode(
    crypto
      .createHash("sha256")
      .update(verifier)
      .digest()
  );
}


// ==================================================
// LOGIN
// ==================================================

app.get("/auth/login", (req, res) => {
  try {
    const codeVerifier =
      createCodeVerifier();

    const codeChallenge =
      createCodeChallenge(
        codeVerifier
      );

    req.session.codeVerifier =
      codeVerifier;

    const params =
      new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

    const authorizationUrl =
      `${SALESFORCE_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;

    console.log(
      "=============================================="
    );

    console.log(
      "Salesforce OAuth Login"
    );

    console.log(
      "Client ID exists:",
      Boolean(CLIENT_ID)
    );

    console.log(
      "Client Secret exists:",
      Boolean(CLIENT_SECRET)
    );

    console.log(
      "Callback URL:",
      REDIRECT_URI
    );

    console.log(
      "=============================================="
    );

    res.redirect(
      authorizationUrl
    );

  } catch (error) {
    console.error(
      "OAuth login error:",
      error
    );

    res.status(500).send(
      "OAuth login failed."
    );
  }
});


// ==================================================
// OAUTH CALLBACK
// ==================================================

app.get(
  "/oauth/callback",
  async (req, res) => {
    try {
      const {
        code,
        error,
        error_description,
      } = req.query;

      if (error) {
        console.error(
          "Salesforce OAuth error:",
          error,
          error_description
        );

        return res.status(400).send(
          `Salesforce OAuth error: ${
            error_description || error
          }`
        );
      }

      if (!code) {
        return res.status(400).send(
          "Authorization code missing."
        );
      }

      const codeVerifier =
        req.session.codeVerifier;

      if (!codeVerifier) {
        return res.status(400).send(
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
          `${SALESFORCE_LOGIN_URL}/services/oauth2/token`,
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

      const tokenData =
        await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error(
          "Token exchange failed:",
          tokenData
        );

        return res.status(
          tokenResponse.status
        ).json({
          error:
            "Salesforce token exchange failed.",

          details:
            tokenData,
        });
      }

      req.session.salesforce = {
        accessToken:
          tokenData.access_token,

        instanceUrl:
          tokenData.instance_url,

        tokenType:
          tokenData.token_type,

        issuedAt:
          Date.now(),
      };

      delete req.session.codeVerifier;

      console.log(
        "Salesforce OAuth authentication successful!"
      );

      console.log(
        "Salesforce instance URL:",
        tokenData.instance_url
      );

      res.redirect(
        FRONTEND_URL
      );

    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      res.status(500).send(
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
      req.session.salesforce
    ) {
      return res.json({
        authenticated: true,

        instanceUrl:
          req.session.salesforce
            .instanceUrl,
      });
    }

    res.json({
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

          return res.status(500).json({
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
// SALESFORCE AUTH MIDDLEWARE
// ==================================================

function requireSalesforceAuth(
  req,
  res,
  next
) {
  if (
    !req.session.salesforce
  ) {
    return res.status(401).json({
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
// GET RECORDS
//
// IMPORTANT:
// We use ONLY page + offset pagination.
//
// Page 1 = offset 0
// Page 2 = offset 20
// Page 3 = offset 40
// ==================================================

app.get(
  "/api/records/:objectName",
  requireSalesforceAuth,
  async (req, res) => {
    try {
      const {
        objectName,
      } = req.params;

      // ------------------------------------------
      // VALIDATE OBJECT
      // ------------------------------------------

      if (
        !allowedObjects.includes(
          objectName
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid Salesforce object.",
        });
      }


      // ------------------------------------------
      // PAGE
      // ------------------------------------------

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


      // ------------------------------------------
      // PAGE SIZE
      // ------------------------------------------

      const pageSize = 20;


      // ------------------------------------------
      // OFFSET
      // ------------------------------------------

      const offset =
        (page - 1) * pageSize;


      // ------------------------------------------
      // SALESFORCE SESSION
      // ------------------------------------------

      const accessToken =
        req.session.salesforce
          .accessToken;

      const instanceUrl =
        req.session.salesforce
          .instanceUrl;


      // ------------------------------------------
      // COUNT TOTAL RECORDS
      // ------------------------------------------

      const countQuery =
        `SELECT COUNT() FROM ${objectName}`;

      const countUrl =
        `${instanceUrl}/services/data/` +
        `${API_VERSION}/query/?q=` +
        encodeURIComponent(
          countQuery
        );


      const countResponse =
        await fetch(
          countUrl,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );


      const countData =
        await countResponse.json();


      if (!countResponse.ok) {
        console.error(
          "Salesforce COUNT error:",
          countData
        );

        return res.status(
          countResponse.status
        ).json({
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


      // ------------------------------------------
      // SOQL QUERY
      //
      // IMPORTANT:
      // Stable ORDER BY prevents records from
      // moving between pages during pagination.
      // ------------------------------------------

      const query =
        `SELECT ${fieldMap[objectName]} ` +
        `FROM ${objectName} ` +
        `ORDER BY CreatedDate DESC, Id ASC ` +
        `LIMIT ${pageSize} ` +
        `OFFSET ${offset}`;


      const url =
        `${instanceUrl}/services/data/` +
        `${API_VERSION}/query/?q=` +
        encodeURIComponent(
          query
        );


      console.log(
        "=============================================="
      );

      console.log(
        "GET RECORDS"
      );

      console.log(
        "Object:",
        objectName
      );

      console.log(
        "Page:",
        page
      );

      console.log(
        "Offset:",
        offset
      );

      console.log(
        "Records per page:",
        pageSize
      );

      console.log(
        "Total Salesforce records:",
        totalSize
      );

      console.log(
        "=============================================="
      );


      // ------------------------------------------
      // SALESFORCE REQUEST
      // ------------------------------------------

      const response =
        await fetch(
          url,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        console.error(
          "Salesforce GET error:",
          data
        );

        return res.status(
          response.status
        ).json({
          error:
            "Failed to load Salesforce records.",

          details:
            data,
        });
      }


      const records =
        data.records || [];


      // ------------------------------------------
      // HAS MORE
      // ------------------------------------------

      const hasMore =
        offset + records.length <
        totalSize;


      const nextPage =
        hasMore
          ? page + 1
          : null;


      console.log(
        "Records returned:",
        records.length
      );

      console.log(
        "Total Salesforce records:",
        totalSize
      );

      console.log(
        "Has more:",
        hasMore
      );

      console.log(
        "Next page:",
        nextPage
      );


      // ------------------------------------------
      // RESPONSE
      // ------------------------------------------

      return res.json({
        object:
          objectName,

        records:
          records,

        totalSize:
          totalSize,

        page:
          page,

        pageSize:
          pageSize,

        hasMore:
          hasMore,

        nextPage:
          nextPage,
      });

    } catch (error) {
      console.error(
        "Get records error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not load Salesforce records.",

        details:
          error.message,
      });
    }
  }
);


// ==================================================
// CREATE RECORD
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
        return res.status(400).json({
          error:
            "Invalid Salesforce object.",
        });
      }

      const accessToken =
        req.session.salesforce
          .accessToken;

      const instanceUrl =
        req.session.salesforce
          .instanceUrl;

      const url =
        `${instanceUrl}/services/data/` +
        `${API_VERSION}/sobjects/` +
        `${objectName}`;


      console.log(
        "CREATE:",
        objectName
      );


      const response =
        await fetch(
          url,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                req.body
              ),
          }
        );


      const responseText =
        await response.text();


      let data = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          data = {
            message:
              responseText,
          };
        }
      }


      if (!response.ok) {
        console.error(
          "Salesforce CREATE error:",
          data
        );

        return res.status(
          response.status
        ).json({
          error:
            "Failed to create Salesforce record.",

          details:
            data,
        });
      }


      return res.status(201).json({
        success: true,

        id:
          data.id,

        message:
          `${objectName} created successfully.`,
      });

    } catch (error) {
      console.error(
        "Create record error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not create Salesforce record.",

        details:
          error.message,
      });
    }
  }
);


// ==================================================
// UPDATE RECORD
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


      const accessToken =
        req.session.salesforce
          .accessToken;

      const instanceUrl =
        req.session.salesforce
          .instanceUrl;


      const url =
        `${instanceUrl}/services/data/` +
        `${API_VERSION}/sobjects/` +
        `${objectName}/` +
        `${recordId}`;


      const response =
        await fetch(
          url,
          {
            method: "PATCH",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                req.body
              ),
          }
        );


      const responseText =
        await response.text();


      if (!response.ok) {
        let errorData;

        try {
          errorData =
            JSON.parse(
              responseText
            );
        } catch {
          errorData = {
            message:
              responseText,
          };
        }


        console.error(
          "Salesforce UPDATE error:",
          errorData
        );


        return res.status(
          response.status
        ).json({
          error:
            "Failed to update Salesforce record.",

          details:
            errorData,
        });
      }


      return res.json({
        success: true,

        message:
          `${objectName} updated successfully.`,

        id:
          recordId,
      });

    } catch (error) {
      console.error(
        "Update record error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not update Salesforce record.",

        details:
          error.message,
      });
    }
  }
);


// ==================================================
// DELETE RECORD
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


      const accessToken =
        req.session.salesforce
          .accessToken;

      const instanceUrl =
        req.session.salesforce
          .instanceUrl;


      const url =
        `${instanceUrl}/services/data/` +
        `${API_VERSION}/sobjects/` +
        `${objectName}/` +
        `${recordId}`;


      console.log(
        "DELETE:",
        objectName,
        recordId
      );


      const response =
        await fetch(
          url,
          {
            method: "DELETE",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );


      const responseText =
        await response.text();


      if (!response.ok) {
        let errorData;

        try {
          errorData =
            JSON.parse(
              responseText
            );
        } catch {
          errorData = {
            message:
              responseText,
          };
        }


        console.error(
          "Salesforce DELETE error:",
          errorData
        );


        return res.status(
          response.status
        ).json({
          error:
            "Failed to delete Salesforce record.",

          details:
            errorData,
        });
      }


      return res.json({
        success: true,

        message:
          `${objectName} deleted successfully.`,

        id:
          recordId,
      });

    } catch (error) {
      console.error(
        "Delete record error:",
        error
      );

      return res.status(500).json({
        error:
          "Could not delete Salesforce record.",

        details:
          error.message,
      });
    }
  }
);


// ==================================================
// SERVER START
// ==================================================

app.listen(
  PORT,
  () => {
    console.log(
      "=============================================="
    );

    console.log(
      `Salesforce CRUD backend running on port ${PORT}`
    );

    console.log(
      `http://localhost:${PORT}`
    );

    console.log(
      "Pagination: 20 records per request"
    );

    console.log(
      "=============================================="
    );
  }
);