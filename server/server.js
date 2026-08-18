require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 5000;

const FRONTEND_URL =
  process.env.FRONTEND_URL || "http://localhost:5173";

const SALESFORCE_LOGIN_URL =
  process.env.SALESFORCE_LOGIN_URL ||
  "https://login.salesforce.com";

const SALESFORCE_CLIENT_ID =
  process.env.SALESFORCE_CLIENT_ID;

const SALESFORCE_CLIENT_SECRET =
  process.env.SALESFORCE_CLIENT_SECRET;

const SALESFORCE_REDIRECT_URI =
  process.env.SALESFORCE_REDIRECT_URI ||
  `http://localhost:${PORT}/auth/salesforce/callback`;

const SALESFORCE_API_VERSION =
  process.env.SALESFORCE_API_VERSION || "v66.0";

const PAGE_SIZE = 20;

const ALLOWED_OBJECTS = [
  "Account",
  "Opportunity",
  "Lead",
  "Contact",
  "Case",
];

/* =========================================================
   DISPLAY FIELDS
========================================================= */

const FIELD_MAP = {
  Account: [
    "Id",
    "Name",
    "Phone",
    "Website",
    "Industry",
    "Type",
    "BillingCity",
  ],

  Opportunity: [
    "Id",
    "Name",
    "Amount",
    "StageName",
    "CloseDate",
    "Type",
    "LeadSource",
    "Probability",
  ],

  Lead: [
    "Id",
    "FirstName",
    "LastName",
    "Company",
    "Email",
    "Phone",
    "Status",
    "LeadSource",
  ],

  Contact: [
    "Id",
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "Title",
    "Department",
    "AccountId",
  ],

  Case: [
    "Id",
    "CaseNumber",
    "Subject",
    "Status",
    "Priority",
    "Origin",
    "Type",
    "Reason",
  ],
};

/* =========================================================
   CREATE / UPDATE FIELDS
========================================================= */

const CREATE_FIELDS = {
  Account: [
    "Name",
    "Phone",
    "Website",
    "Industry",
    "Type",
    "BillingCity",
  ],

  Opportunity: [
    "Name",
    "Amount",
    "StageName",
    "CloseDate",
    "Type",
    "LeadSource",
    "Probability",
  ],

  Lead: [
    "FirstName",
    "LastName",
    "Company",
    "Email",
    "Phone",
    "Status",
    "LeadSource",
  ],

  Contact: [
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "Title",
    "Department",
    "AccountId",
  ],

  Case: [
    "Subject",
    "Status",
    "Priority",
    "Origin",
    "Type",
    "Reason",
  ],
};

/* =========================================================
   PICKLISTS
========================================================= */

const PICKLISTS = {
  Opportunity: {
    StageName: [
      "Prospecting",
      "Qualification",
      "Needs Analysis",
      "Value Proposition",
      "Id. Decision Makers",
      "Perception Analysis",
      "Proposal/Price Quote",
      "Negotiation/Review",
      "Closed Won",
      "Closed Lost",
    ],
  },

  Lead: {
    Status: [
      "Open - Not Contacted",
      "Working - Contacted",
      "Closed - Converted",
      "Closed - Not Converted",
    ],
  },

  Case: {
    Status: [
      "New",
      "Working",
      "Escalated",
      "Closed",
    ],

    Priority: [
      "High",
      "Medium",
      "Low",
    ],

    Origin: [
      "Phone",
      "Email",
      "Web",
    ],
  },
};

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

app.set("trust proxy", 1);

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "salesforce-crud-manager-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure:
        process.env.NODE_ENV === "production",

      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",

      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

/* =========================================================
   HELPERS
========================================================= */

function isAllowedObject(objectName) {
  return ALLOWED_OBJECTS.includes(objectName);
}

function validateObject(req, res) {
  const objectName = req.params.object;

  if (!isAllowedObject(objectName)) {
    res.status(400).json({
      error: "Unsupported Salesforce object.",
      allowedObjects: ALLOWED_OBJECTS,
    });

    return false;
  }

  return true;
}

function createPKCE() {
  const verifier = crypto
    .randomBytes(64)
    .toString("base64url");

  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return {
    verifier,
    challenge,
  };
}

function getSalesforceSession(req) {
  if (
    !req.session.salesforce ||
    !req.session.salesforce.accessToken ||
    !req.session.salesforce.instanceUrl
  ) {
    return null;
  }

  return req.session.salesforce;
}

function cleanRecord(record) {
  const result = {};

  Object.keys(record || {}).forEach((key) => {
    if (key !== "attributes") {
      result[key] = record[key];
    }
  });

  return result;
}

/* =========================================================
   SALESFORCE REQUEST
========================================================= */

async function salesforceRequest(
  req,
  path,
  options = {}
) {
  const sf = getSalesforceSession(req);

  if (!sf) {
    const error = new Error(
      "Not authenticated with Salesforce."
    );

    error.status = 401;

    throw error;
  }

  let url;

  if (path.startsWith("http")) {
    if (!path.startsWith(sf.instanceUrl)) {
      const error = new Error(
        "Invalid Salesforce URL."
      );

      error.status = 400;

      throw error;
    }

    url = path;
  } else {
    url = `${sf.instanceUrl}${path}`;
  }

  const headers = {
    Authorization: `Bearer ${sf.accessToken}`,
    ...(options.headers || {}),
  };

  if (
    options.body &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      Array.isArray(data) && data[0]?.message
        ? data[0].message
        : data?.error_description ||
          data?.error ||
          `Salesforce API error (${response.status})`;

    const error = new Error(message);

    error.status = response.status;
    error.salesforce = data;

    throw error;
  }

  return data;
}

/* =========================================================
   COUNT ONE OBJECT
========================================================= */

async function getObjectCount(req, objectName) {
  const soql =
    `SELECT COUNT() FROM ${objectName}`;

  const data =
    await salesforceRequest(
      req,
      `/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(
        soql
      )}`
    );

  return Number(data.totalSize || 0);
}

/* =========================================================
   GET PAGE
========================================================= */

async function getRecordsPage(
  req,
  objectName,
  page
) {
  const fields =
    FIELD_MAP[objectName].join(",");

  const safePage =
    Math.max(1, Number(page) || 1);

  const offset =
    (safePage - 1) * PAGE_SIZE;

  /*
    Salesforce OFFSET supports values up to 2000.

    For this assignment this provides exactly
    the requested 20-record scrolling behavior.
  */

  if (offset > 2000) {
    const error = new Error(
      "Salesforce OFFSET supports pagination up to 2000 records."
    );

    error.status = 400;

    throw error;
  }

  const soql =
    `SELECT ${fields} ` +
    `FROM ${objectName} ` +
    `ORDER BY CreatedDate DESC, Id DESC ` +
    `LIMIT ${PAGE_SIZE} ` +
    `OFFSET ${offset}`;

  const data =
    await salesforceRequest(
      req,
      `/services/data/${SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(
        soql
      )}`
    );

  const records =
    (data.records || []).map(cleanRecord);

  const totalSize =
    await getObjectCount(
      req,
      objectName
    );

  const hasMore =
    offset + records.length <
    totalSize;

  return {
    object: objectName,
    page: safePage,
    pageSize: PAGE_SIZE,
    records,
    totalSize,
    loaded: records.length,
    hasMore,
    nextPage: hasMore
      ? safePage + 1
      : null,
  };
}

/* =========================================================
   VALIDATION
========================================================= */

function validateFields(
  objectName,
  payload
) {
  const errors = [];

  if (
    payload.Phone !== undefined &&
    payload.Phone !== ""
  ) {
    const phone =
      String(payload.Phone).trim();

    const phonePattern =
      /^\+?[0-9][0-9\s().-]{6,19}$/;

    if (!phonePattern.test(phone)) {
      errors.push(
        "Phone must contain a valid phone number."
      );
    }
  }

  if (
    payload.Email !== undefined &&
    payload.Email !== ""
  ) {
    const email =
      String(payload.Email).trim();

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      errors.push(
        "Email must be a valid email address."
      );
    }
  }

  if (
    payload.Website !== undefined &&
    payload.Website !== ""
  ) {
    let website =
      String(payload.Website).trim();

    if (
      !website.startsWith("http://") &&
      !website.startsWith("https://")
    ) {
      website =
        `https://${website}`;

      payload.Website = website;
    }

    try {
      new URL(website);
    } catch {
      errors.push(
        "Website must be a valid website URL."
      );
    }
  }

  if (
    objectName === "Opportunity" &&
    payload.Amount !== undefined &&
    payload.Amount !== ""
  ) {
    if (Number(payload.Amount) < 0) {
      errors.push(
        "Amount cannot be negative."
      );
    }
  }

  if (
    objectName === "Opportunity" &&
    payload.Probability !== undefined &&
    payload.Probability !== ""
  ) {
    const probability =
      Number(payload.Probability);

    if (
      probability < 0 ||
      probability > 100
    ) {
      errors.push(
        "Probability must be between 0 and 100."
      );
    }
  }

  return errors;
}

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
  res.json({
    status: "ok",

    application:
      "Salesforce CRUD Manager Backend",

    salesforceConfigured:
      Boolean(
        SALESFORCE_CLIENT_ID &&
        SALESFORCE_CLIENT_SECRET
      ),

    apiVersion:
      SALESFORCE_API_VERSION,

    pageSize:
      PAGE_SIZE,

    pagination:
      "20 records per page with automatic scroll loading",

    supportedObjects:
      ALLOWED_OBJECTS,
  });
});

/* =========================================================
   SALESFORCE LOGIN
========================================================= */

app.get(
  "/auth/salesforce",
  (req, res) => {
    if (
      !SALESFORCE_CLIENT_ID ||
      !SALESFORCE_CLIENT_SECRET
    ) {
      return res.status(500).json({
        error:
          "Salesforce OAuth configuration is missing.",
      });
    }

    const pkce = createPKCE();

    req.session.oauth = {
      state:
        crypto
          .randomBytes(32)
          .toString("hex"),

      codeVerifier:
        pkce.verifier,
    };

    const params =
      new URLSearchParams({
        response_type: "code",

        client_id:
          SALESFORCE_CLIENT_ID,

        redirect_uri:
          SALESFORCE_REDIRECT_URI,

        state:
          req.session.oauth.state,

        code_challenge:
          pkce.challenge,

        code_challenge_method:
          "S256",
      });

    const url =
      `${SALESFORCE_LOGIN_URL}/services/oauth2/authorize?` +
      params.toString();

    res.redirect(url);
  }
);

/* =========================================================
   OAUTH CALLBACK
========================================================= */

app.get(
  "/auth/salesforce/callback",
  async (req, res) => {
    try {
      const {
        code,
        state,
        error,
        error_description,
      } = req.query;

      if (error) {
        return res.redirect(
          `${FRONTEND_URL}?oauthError=${encodeURIComponent(
            error_description || error
          )}`
        );
      }

      if (!code) {
        return res.status(400).json({
          error:
            "Authorization code missing.",
        });
      }

      if (
        !req.session.oauth ||
        state !==
          req.session.oauth.state
      ) {
        return res.status(400).json({
          error:
            "Invalid OAuth state.",
        });
      }

      const tokenParams =
        new URLSearchParams({
          grant_type:
            "authorization_code",

          code,

          client_id:
            SALESFORCE_CLIENT_ID,

          client_secret:
            SALESFORCE_CLIENT_SECRET,

          redirect_uri:
            SALESFORCE_REDIRECT_URI,

          code_verifier:
            req.session.oauth
              .codeVerifier,
        });

      const response =
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

      const text =
        await response.text();

      let data;

      try {
        data =
          JSON.parse(text);
      } catch {
        data = {
          error:
            "invalid_response",
          raw: text,
        };
      }

      if (!response.ok) {
        console.error(
          "Salesforce token error:",
          data
        );

        return res.status(400).json({
          error:
            data.error_description ||
            data.error ||
            "Unable to obtain Salesforce token.",
        });
      }

      req.session.salesforce = {
        accessToken:
          data.access_token,

        refreshToken:
          data.refresh_token || null,

        instanceUrl:
          data.instance_url,

        identityUrl:
          data.id || null,

        issuedAt:
          Date.now(),
      };

      delete req.session.oauth;

      req.session.save(() => {
        res.redirect(FRONTEND_URL);
      });
    } catch (error) {
      console.error(
        "OAuth callback error:",
        error
      );

      res.status(500).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   AUTH STATUS
========================================================= */

app.get(
  "/auth/status",
  (req, res) => {
    const sf =
      getSalesforceSession(req);

    if (!sf) {
      return res.json({
        authenticated: false,
      });
    }

    res.json({
      authenticated: true,

      user:
        sf.identityUrl,

      instanceUrl:
        sf.instanceUrl,
    });
  }
);

/* =========================================================
   LOGOUT
========================================================= */

app.get(
  "/auth/logout",
  (req, res) => {
    req.session.destroy(() => {
      res.clearCookie(
        "connect.sid"
      );

      res.json({
        success: true,
      });
    });
  }
);

/* =========================================================
   OBJECTS
========================================================= */

app.get(
  "/api/objects",
  (req, res) => {
    res.json({
      objects:
        ALLOWED_OBJECTS,

      fields:
        FIELD_MAP,

      pageSize:
        PAGE_SIZE,
    });
  }
);

/* =========================================================
   COUNTS
========================================================= */

app.get(
  "/api/counts",
  async (req, res) => {
    try {
      const counts = {};

      await Promise.all(
        ALLOWED_OBJECTS.map(
          async (objectName) => {
            counts[objectName] =
              await getObjectCount(
                req,
                objectName
              );
          }
        )
      );

      res.json({
        counts,
      });
    } catch (error) {
      console.error(
        "COUNT ERROR:",
        error
      );

      res.status(
        error.status || 500
      ).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   FIELDS
========================================================= */

app.get(
  "/api/:object/fields",
  (req, res) => {
    if (!validateObject(req, res))
      return;

    const objectName =
      req.params.object;

    res.json({
      object:
        objectName,

      fields:
        FIELD_MAP[objectName],

      createFields:
        CREATE_FIELDS[objectName],

      picklists:
        PICKLISTS[objectName] || {},
    });
  }
);

/* =========================================================
   FIRST PAGE / PAGE REQUEST
========================================================= */

app.get(
  "/api/:object/records",
  async (req, res) => {
    if (!validateObject(req, res))
      return;

    try {
      const objectName =
        req.params.object;

      const page =
        Math.max(
          1,
          Number(req.query.page) || 1
        );

      const result =
        await getRecordsPage(
          req,
          objectName,
          page
        );

      res.json(result);
    } catch (error) {
      console.error(
        "RECORD PAGE ERROR:",
        error
      );

      res.status(
        error.status || 500
      ).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   NEXT PAGE
========================================================= */

app.get(
  "/api/:object/records/next",
  async (req, res) => {
    if (!validateObject(req, res))
      return;

    try {
      const objectName =
        req.params.object;

      const page =
        Number(req.query.page);

      if (
        !Number.isInteger(page) ||
        page < 2
      ) {
        return res.status(400).json({
          error:
            "A valid next page number is required.",
        });
      }

      const result =
        await getRecordsPage(
          req,
          objectName,
          page
        );

      res.json(result);
    } catch (error) {
      console.error(
        "NEXT PAGE ERROR:",
        error
      );

      res.status(
        error.status || 500
      ).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   SINGLE RECORD
========================================================= */

app.get(
  "/api/:object/:id",
  async (req, res) => {
    if (!validateObject(req, res))
      return;

    try {
      const record =
        await salesforceRequest(
          req,
          `/services/data/${SALESFORCE_API_VERSION}/sobjects/${req.params.object}/${req.params.id}`
        );

      res.json({
        record:
          cleanRecord(record),
      });
    } catch (error) {
      res.status(
        error.status || 500
      ).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   CREATE
========================================================= */

app.post(
  "/api/:object",
  async (req, res) => {
    if (!validateObject(req, res))
      return;

    try {
      const objectName =
        req.params.object;

      const allowedFields =
        CREATE_FIELDS[
          objectName
        ];

      const payload = {};

      for (
        const field of
          allowedFields
      ) {
        if (
          req.body[field] !==
            undefined &&
          req.body[field] !== ""
        ) {
          payload[field] =
            req.body[field];
        }
      }

      const requiredFields = {
        Account: [
          "Name",
        ],

        Opportunity: [
          "Name",
          "StageName",
          "CloseDate",
        ],

        Lead: [
          "LastName",
          "Company",
        ],

        Contact: [
          "LastName",
        ],

        Case: [
          "Subject",
        ],
      };

      for (
        const field of
          requiredFields[
            objectName
          ]
      ) {
        if (
          payload[field] ===
            undefined ||
          payload[field] === ""
        ) {
          return res.status(400).json({
            error:
              `${field} is required.`,
          });
        }
      }

      const validationErrors =
        validateFields(
          objectName,
          payload
        );

      if (
        validationErrors.length
      ) {
        return res.status(400).json({
          error:
            validationErrors.join(
              " "
            ),
        });
      }

      const result =
        await salesforceRequest(
          req,
          `/services/data/${SALESFORCE_API_VERSION}/sobjects/${objectName}`,
          {
            method: "POST",

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      res.status(201).json({
        success: true,

        message:
          `${objectName} created successfully.`,

        id:
          result.id,
      });
    } catch (error) {
      console.error(
        "CREATE ERROR:",
        error
      );

      res.status(
        error.status || 500
      ).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   UPDATE
========================================================= */

app.patch(
  "/api/:object/:id",
  async (req, res) => {
    if (!validateObject(req, res))
      return;

    try {
      const objectName =
        req.params.object;

      const allowedFields =
        CREATE_FIELDS[
          objectName
        ];

      const payload = {};

      for (
        const field of
          allowedFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          payload[field] =
            req.body[field];
        }
      }

      const validationErrors =
        validateFields(
          objectName,
          payload
        );

      if (
        validationErrors.length
      ) {
        return res.status(400).json({
          error:
            validationErrors.join(
              " "
            ),
        });
      }

      await salesforceRequest(
        req,
        `/services/data/${SALESFORCE_API_VERSION}/sobjects/${objectName}/${req.params.id}`,
        {
          method: "PATCH",

          body:
            JSON.stringify(
              payload
            ),
        }
      );

      res.json({
        success: true,

        message:
          `${objectName} updated successfully.`,
      });
    } catch (error) {
      console.error(
        "UPDATE ERROR:",
        error
      );

      res.status(
        error.status || 500
      ).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   DELETE
========================================================= */

app.delete(
  "/api/:object/:id",
  async (req, res) => {
    if (!validateObject(req, res))
      return;

    try {
      const objectName =
        req.params.object;

      await salesforceRequest(
        req,
        `/services/data/${SALESFORCE_API_VERSION}/sobjects/${objectName}/${req.params.id}`,
        {
          method:
            "DELETE",
        }
      );

      res.json({
        success: true,

        message:
          `${objectName} deleted successfully.`,
      });
    } catch (error) {
      console.error(
        "DELETE ERROR:",
        error
      );

      res.status(
        error.status || 500
      ).json({
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    console.error(err);

    res.status(
      err.status || 500
    ).json({
      error:
        err.message ||
        "Internal server error.",
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      `Backend running at http://localhost:${PORT}`
    );

    console.log(
      `Salesforce API version: ${SALESFORCE_API_VERSION}`
    );

    console.log(
      `Page size: ${PAGE_SIZE}`
    );

    console.log(
      `Pagination: 20 records per page`
    );

    console.log(
      `Supported objects: ${ALLOWED_OBJECTS.join(
        ", "
      )}`
    );

    console.log(
      `Salesforce Client ID loaded: ${Boolean(
        SALESFORCE_CLIENT_ID
      )}`
    );

    console.log(
      `Salesforce Client Secret loaded: ${Boolean(
        SALESFORCE_CLIENT_SECRET
      )}`
    );

    console.log(
      `Redirect URI: ${SALESFORCE_REDIRECT_URI}`
    );
  }
);