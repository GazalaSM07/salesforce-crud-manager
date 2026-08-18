import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";

const API_URL = "http://localhost:5000";

const PAGE_SIZE = 20;

const OBJECTS = [
  {
    name: "Account",
    icon: "🏢",
    color: "blue",
    description: "Companies & organizations",
  },
  {
    name: "Opportunity",
    icon: "💼",
    color: "purple",
    description: "Sales opportunities",
  },
  {
    name: "Lead",
    icon: "🎯",
    color: "orange",
    description: "Potential customers",
  },
  {
    name: "Contact",
    icon: "👤",
    color: "green",
    description: "Customer contacts",
  },
  {
    name: "Case",
    icon: "🎧",
    color: "pink",
    description: "Customer support",
  },
];

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

function formatFieldName(field) {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) =>
      letter.toUpperCase()
    );
}

function emptyForm(objectName) {
  const data = {};

  CREATE_FIELDS[objectName].forEach(
    (field) => {
      data[field] = "";
    }
  );

  if (objectName === "Opportunity") {
    data.StageName = "Prospecting";
  }

  if (objectName === "Lead") {
    data.Status = "Open - Not Contacted";
  }

  if (objectName === "Case") {
    data.Status = "New";
    data.Priority = "Medium";
    data.Origin = "Web";
  }

  return data;
}

function App() {
  const [authenticated, setAuthenticated] =
    useState(false);

  const [checkingAuth, setCheckingAuth] =
    useState(true);

  const [selectedObject, setSelectedObject] =
    useState("Account");

  const [records, setRecords] =
    useState([]);

  const [counts, setCounts] =
    useState({});

  const [totalSize, setTotalSize] =
    useState(0);

  const [currentPage, setCurrentPage] =
    useState(1);

  const [hasMore, setHasMore] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [modalType, setModalType] =
    useState(null);

  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [formData, setFormData] =
    useState({});

  const [saving, setSaving] =
    useState(false);

  const [objectMenuOpen, setObjectMenuOpen] =
    useState(false);

  const recordsContainerRef =
    useRef(null);

  const loadingMoreRef =
    useRef(false);

  const currentObject =
    OBJECTS.find(
      (item) =>
        item.name === selectedObject
    );

  /* =====================================================
     AUTH
  ===================================================== */

  const checkAuthentication =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            `${API_URL}/auth/status`,
            {
              credentials: "include",
            }
          );

        const data =
          await response.json();

        setAuthenticated(
          data.authenticated === true
        );
      } catch {
        setAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    }, []);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  /* =====================================================
     COUNTS
  ===================================================== */

  const loadCounts =
    useCallback(async () => {
      try {
        const response =
          await fetch(
            `${API_URL}/api/counts`,
            {
              credentials: "include",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load counts."
          );
        }

        setCounts(
          data.counts || {}
        );
      } catch (err) {
        console.error(
          "Count error:",
          err
        );
      }
    }, []);

  /* =====================================================
     LOAD FIRST PAGE
  ===================================================== */

  const loadRecords =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        setRecords([]);
        setCurrentPage(1);
        setTotalSize(0);
        setHasMore(false);

        loadingMoreRef.current = false;

        const response =
          await fetch(
            `${API_URL}/api/${selectedObject}/records?page=1`,
            {
              credentials: "include",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load records."
          );
        }

        setRecords(
          data.records || []
        );

        setTotalSize(
          Number(
            data.totalSize || 0
          )
        );

        setCurrentPage(
          Number(data.page || 1)
        );

        setHasMore(
          data.hasMore === true
        );
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, [selectedObject]);

  useEffect(() => {
    if (authenticated) {
      loadRecords();
      loadCounts();
    }
  }, [
    authenticated,
    selectedObject,
    loadRecords,
    loadCounts,
  ]);

  /* =====================================================
     LOAD NEXT 20
  ===================================================== */

  const loadMoreRecords =
    useCallback(async () => {
      if (
        loadingMoreRef.current ||
        !hasMore
      ) {
        return;
      }

      loadingMoreRef.current = true;

      setLoadingMore(true);
      setError("");

      const nextPage =
        currentPage + 1;

      try {
        const response =
          await fetch(
            `${API_URL}/api/${selectedObject}/records/next?page=${nextPage}`,
            {
              credentials: "include",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load more records."
          );
        }

        const newRecords =
          data.records || [];

        setRecords(
          (previous) => [
            ...previous,
            ...newRecords,
          ]
        );

        setCurrentPage(
          Number(
            data.page || nextPage
          )
        );

        setTotalSize(
          Number(
            data.totalSize ||
              totalSize
          )
        );

        setHasMore(
          data.hasMore === true
        );
      } catch (err) {
        setError(err.message);
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }, [
      currentPage,
      hasMore,
      selectedObject,
      totalSize,
    ]);

  /* =====================================================
     SCROLL PAGINATION
  ===================================================== */

  useEffect(() => {
    const container =
      recordsContainerRef.current;

    if (!container) {
      return;
    }

    function handleScroll() {
      if (
        loadingMoreRef.current ||
        !hasMore
      ) {
        return;
      }

      const distanceFromBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

      if (
        distanceFromBottom <= 250
      ) {
        loadMoreRecords();
      }
    }

    container.addEventListener(
      "scroll",
      handleScroll
    );

    return () => {
      container.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, [
    hasMore,
    loadMoreRecords,
  ]);

  /* =====================================================
     WINDOW SCROLL PAGINATION
  ===================================================== */

  useEffect(() => {
    function handleWindowScroll() {
      if (
        loadingMoreRef.current ||
        !hasMore
      ) {
        return;
      }

      const scrollBottom =
        window.innerHeight +
        window.scrollY;

      const documentHeight =
        document.documentElement
          .scrollHeight;

      if (
        documentHeight -
          scrollBottom <=
        350
      ) {
        loadMoreRecords();
      }
    }

    window.addEventListener(
      "scroll",
      handleWindowScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleWindowScroll
      );
    };
  }, [
    hasMore,
    loadMoreRecords,
  ]);

  /* =====================================================
     OBJECT CHANGE
  ===================================================== */

  function changeObject(name) {
    setSelectedObject(name);
    setObjectMenuOpen(false);
    setSearchTerm("");
    setError("");
    setMessage("");

    setModalType(null);
    setSelectedRecord(null);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  /* =====================================================
     LOGIN
  ===================================================== */

  function loginWithSalesforce() {
    window.location.href =
      `${API_URL}/auth/salesforce`;
  }

  /* =====================================================
     LOGOUT
  ===================================================== */

  async function logout() {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          credentials: "include",
        }
      );
    } finally {
      setAuthenticated(false);
    }
  }

  /* =====================================================
     MODALS
  ===================================================== */

  function openCreate() {
    setSelectedRecord(null);

    setFormData(
      emptyForm(
        selectedObject
      )
    );

    setModalType("create");
    setError("");
  }

  function openEdit(record) {
    const data = {};

    CREATE_FIELDS[
      selectedObject
    ].forEach((field) => {
      data[field] =
        record[field] ?? "";
    });

    setSelectedRecord(record);
    setFormData(data);
    setModalType("edit");
    setError("");
  }

  function openView(record) {
    setSelectedRecord(record);
    setModalType("view");
    setError("");
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setModalType(null);
    setSelectedRecord(null);
    setFormData({});
    setError("");
  }

  /* =====================================================
     FORM
  ===================================================== */

  function handleChange(
    field,
    value
  ) {
    setFormData(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  }

  function getInputType(field) {
    if (field === "Email") {
      return "email";
    }

    if (field === "Website") {
      return "url";
    }

    if (
      field === "Amount" ||
      field === "Probability"
    ) {
      return "number";
    }

    if (field === "CloseDate") {
      return "date";
    }

    return "text";
  }

  function isRequired(field) {
    const required = {
      Account: ["Name"],

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

    return required[
      selectedObject
    ]?.includes(field);
  }

  /* =====================================================
     SAVE
  ===================================================== */

  async function saveRecord(event) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const isCreate =
        modalType === "create";

      const url = isCreate
        ? `${API_URL}/api/${selectedObject}`
        : `${API_URL}/api/${selectedObject}/${selectedRecord.Id}`;

      const response =
        await fetch(url, {
          method: isCreate
            ? "POST"
            : "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          credentials: "include",

          body:
            JSON.stringify(
              formData
            ),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save record."
        );
      }

      setModalType(null);
      setSelectedRecord(null);
      setFormData({});

      setMessage(
        isCreate
          ? `${selectedObject} created successfully.`
          : `${selectedObject} updated successfully.`
      );

      await loadRecords();
      await loadCounts();

      setTimeout(() => {
        setMessage("");
      }, 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  /* =====================================================
     DELETE
  ===================================================== */

  async function deleteRecord(record) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete this ${selectedObject}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response =
        await fetch(
          `${API_URL}/api/${selectedObject}/${record.Id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete record."
        );
      }

      setMessage(
        `${selectedObject} deleted successfully.`
      );

      await loadRecords();
      await loadCounts();

      setTimeout(() => {
        setMessage("");
      }, 4000);
    } catch (err) {
      setError(err.message);
    }
  }

  /* =====================================================
     SEARCH
  ===================================================== */

  const filteredRecords =
    records.filter(
      (record) => {
        if (
          !searchTerm.trim()
        ) {
          return true;
        }

        const term =
          searchTerm.toLowerCase();

        return Object.values(
          record
        ).some((value) =>
          String(
            value ?? ""
          )
            .toLowerCase()
            .includes(term)
        );
      }
    );

  /* =====================================================
     PROGRESS
  ===================================================== */

  const loadedCount =
    records.length;

  const progress =
    totalSize > 0
      ? Math.min(
          100,
          Math.round(
            (loadedCount /
              totalSize) *
              100
          )
        )
      : 0;

  /* =====================================================
     AUTH LOADING
  ===================================================== */

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        <div className="big-spinner"></div>

        <h2>
          Connecting to Salesforce
        </h2>

        <p>
          Please wait...
        </p>
      </div>
    );
  }

  /* =====================================================
     LOGIN
  ===================================================== */

  if (!authenticated) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-icon">
            ☁
          </div>

          <div className="login-label">
            SALESFORCE CRUD MANAGER
          </div>

          <h1>
            Manage your
            <span>
              Salesforce data
            </span>
          </h1>

          <p>
            Create, view, edit and
            delete Accounts,
            Opportunities, Leads,
            Contacts and Cases from
            one simple application.
          </p>

          <button
            className="salesforce-login"
            onClick={
              loginWithSalesforce
            }
          >
            Login with Salesforce
            <b>→</b>
          </button>

          <div className="login-features">
            <span>✓ OAuth 2.0</span>
            <span>✓ Secure</span>
            <span>✓ CRUD</span>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================================
     DASHBOARD
  ===================================================== */

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            ☁
          </div>

          <div>
            <h2>
              Salesforce
            </h2>

            <span>
              CRUD Manager
            </span>
          </div>
        </div>

        <div className="header-actions">
          <div className="connection">
            <i></i>
            Connected
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="content">
        {/* =================================================
            WELCOME
        ================================================= */}

        <section className="welcome">
          <div>
            <div className="welcome-label">
              SALESFORCE DASHBOARD
            </div>

            <h1>
              Record Management
            </h1>

            <p>
              Select a Salesforce
              object to view, create,
              update and delete
              records.
            </p>
          </div>

          <div className="welcome-number">
            <strong>
              {counts[
                selectedObject
              ] ?? 0}
            </strong>

            <span>
              TOTAL{" "}
              {selectedObject.toUpperCase()}
              <br />
              RECORDS
            </span>
          </div>
        </section>

        {/* =================================================
            OBJECT CARDS
        ================================================= */}

        <section className="object-grid">
          {OBJECTS.map(
            (object) => (
              <button
                key={
                  object.name
                }
                className={`object-card ${object.color} ${
                  selectedObject ===
                  object.name
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  changeObject(
                    object.name
                  )
                }
              >
                <div className="object-card-top">
                  <div className="object-icon">
                    {
                      object.icon
                    }
                  </div>

                  {selectedObject ===
                    object.name && (
                    <div className="selected-check">
                      ✓
                    </div>
                  )}
                </div>

                <strong>
                  {object.name}
                </strong>

                <span>
                  {
                    object.description
                  }
                </span>

                <b>
                  {counts[
                    object.name
                  ] ?? 0}
                </b>

                <small>
                  TOTAL RECORDS
                </small>
              </button>
            )
          )}
        </section>

        {/* =================================================
            RECORD MANAGEMENT
        ================================================= */}

        <section
          className="records-card"
          id="records"
        >
          <div className="records-top">
            <div>
              <div className="records-label">
                RECORD MANAGEMENT
              </div>

              <h2>
                {selectedObject}{" "}
                Records
              </h2>

              <p>
                Manage your{" "}
                {selectedObject.toLowerCase()}{" "}
                records.
              </p>
            </div>

            <button
              className="new-button"
              onClick={
                openCreate
              }
            >
              <b>+</b>
              New{" "}
              {selectedObject}
            </button>
          </div>

          {/* =================================================
              CONTROLS
          ================================================= */}

          <div className="control-row">
            <div className="object-dropdown">
              <button
                className="dropdown-button"
                onClick={() =>
                  setObjectMenuOpen(
                    !objectMenuOpen
                  )
                }
              >
                <span
                  className={`mini-object-icon ${currentObject.color}`}
                >
                  {
                    currentObject.icon
                  }
                </span>

                <span>
                  <small>
                    SELECT OBJECT
                  </small>

                  <strong>
                    {
                      selectedObject
                    }
                  </strong>
                </span>

                <b>
                  {objectMenuOpen
                    ? "▲"
                    : "▼"}
                </b>
              </button>

              {objectMenuOpen && (
                <div className="dropdown-menu">
                  {OBJECTS.map(
                    (object) => (
                      <button
                        key={
                          object.name
                        }
                        onClick={() =>
                          changeObject(
                            object.name
                          )
                        }
                      >
                        <span
                          className={`mini-object-icon ${object.color}`}
                        >
                          {
                            object.icon
                          }
                        </span>

                        <span>
                          <strong>
                            {
                              object.name
                            }
                          </strong>

                          <small>
                            {
                              object.description
                            }
                          </small>
                        </span>

                        {selectedObject ===
                          object.name && (
                          <b>
                            ✓
                          </b>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>

            <div className="search">
              <span>
                ⌕
              </span>

              <input
                value={
                  searchTerm
                }
                onChange={(event) =>
                  setSearchTerm(
                    event.target
                      .value
                  )
                }
                placeholder={`Search ${selectedObject} records...`}
              />

              {searchTerm && (
                <button
                  onClick={() =>
                    setSearchTerm("")
                  }
                >
                  ×
                </button>
              )}
            </div>

            <button
              className="refresh"
              onClick={() => {
                loadRecords();
                loadCounts();
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {/* =================================================
              MESSAGES
          ================================================= */}

          {message && (
            <div className="success">
              <span>✓</span>
              {message}
            </div>
          )}

          {error && (
            <div className="error">
              <span>!</span>

              <div>
                <strong>
                  Something went wrong
                </strong>

                <p>
                  {error}
                </p>
              </div>

              <button
                onClick={() => {
                  setError("");
                  loadRecords();
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* =================================================
              PAGINATION
          ================================================= */}

          <div className="pagination-status">
            <div className="pagination-count">
              <strong>
                {loadedCount}
              </strong>

              <span>
                of
              </span>

              <strong>
                {totalSize}
              </strong>

              <span>
                records loaded
              </span>
            </div>

            <div className="progress-wrapper">
              <div className="progress-track">
                <div
                  className="progress-bar"
                  style={{
                    width: `${progress}%`,
                  }}
                ></div>
              </div>

              <span>
                {progress}%
              </span>
            </div>

            <div className="page-badge">
              PAGE{" "}
              {currentPage}
            </div>

            <div className="page-size-badge">
              PAGE SIZE{" "}
              {PAGE_SIZE}
            </div>
          </div>

          {/* =================================================
              TABLE
          ================================================= */}

          {loading ? (
            <div className="loading-box">
              <div className="spinner"></div>

              <strong>
                Loading{" "}
                {selectedObject}{" "}
                records...
              </strong>

              <span>
                Getting the first{" "}
                {PAGE_SIZE}{" "}
                records from
                Salesforce
              </span>
            </div>
          ) : filteredRecords.length >
            0 ? (
            <>
              <div
                className="table-scroll"
                ref={
                  recordsContainerRef
                }
              >
                <table>
                  <thead>
                    <tr>
                      {FIELD_MAP[
                        selectedObject
                      ].map(
                        (field) => (
                          <th
                            key={
                              field
                            }
                          >
                            {formatFieldName(
                              field
                            )}
                          </th>
                        )
                      )}

                      <th>
                        ACTIONS
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRecords.map(
                      (record) => (
                        <tr
                          key={
                            record.Id
                          }
                        >
                          {FIELD_MAP[
                            selectedObject
                          ].map(
                            (field) => (
                              <td
                                key={
                                  field
                                }
                              >
                                {record[
                                  field
                                ] ??
                                  "—"}
                              </td>
                            )
                          )}

                          <td>
                            <div className="actions">
                              <button
                                className="view"
                                onClick={() =>
                                  openView(
                                    record
                                  )
                                }
                              >
                                View
                              </button>

                              <button
                                className="edit"
                                onClick={() =>
                                  openEdit(
                                    record
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                className="delete"
                                onClick={() =>
                                  deleteRecord(
                                    record
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* =================================================
                  LOAD MORE
              ================================================= */}

              <div className="load-more">
                {loadingMore ? (
                  <div className="loading-more">
                    <div className="spinner small"></div>

                    <div>
                      <strong>
                        Loading more
                        records...
                      </strong>

                      <span>
                        Fetching the next{" "}
                        {PAGE_SIZE}{" "}
                        records from
                        Salesforce
                      </span>
                    </div>
                  </div>
                ) : hasMore ? (
                  <div className="more-available">
                    <span>
                      ↓
                    </span>

                    <div>
                      <strong>
                        More records
                        available
                      </strong>

                      <small>
                        Scroll to the
                        bottom to
                        automatically
                        load the next{" "}
                        {PAGE_SIZE}{" "}
                        records
                      </small>
                    </div>

                    <button
                      onClick={
                        loadMoreRecords
                      }
                    >
                      Load next{" "}
                      {PAGE_SIZE}
                    </button>
                  </div>
                ) : (
                  <div className="all-loaded">
                    <span>
                      ✓
                    </span>

                    <div>
                      <strong>
                        All records
                        loaded
                      </strong>

                      <small>
                        {loadedCount}{" "}
                        of{" "}
                        {totalSize}{" "}
                        {
                          selectedObject.toLowerCase()
                        }{" "}
                        records are
                        displayed
                      </small>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty">
              <div>
                {
                  currentObject.icon
                }
              </div>

              <h3>
                No records found
              </h3>

              <p>
                No{" "}
                {selectedObject.toLowerCase()}{" "}
                records match
                your search.
              </p>

              <button
                className="new-button"
                onClick={
                  openCreate
                }
              >
                + Create{" "}
                {selectedObject}
              </button>
            </div>
          )}
        </section>
      </main>

      {/* =====================================================
          MODAL
      ===================================================== */}

      {modalType && (
        <div
          className="modal-overlay"
          onClick={
            closeModal
          }
        >
          <div
            className="modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-header">
              <div>
                <span>
                  {modalType ===
                  "view"
                    ? "RECORD DETAILS"
                    : modalType ===
                      "edit"
                    ? "EDIT RECORD"
                    : "CREATE RECORD"}
                </span>

                <h2>
                  {modalType ===
                  "create"
                    ? `New ${selectedObject}`
                    : selectedObject}
                </h2>
              </div>

              <button
                onClick={
                  closeModal
                }
              >
                ×
              </button>
            </div>

            {/* =================================================
                VIEW RECORD
            ================================================= */}

            {modalType ===
              "view" &&
              selectedRecord && (
                <div className="view-container">

                  {/* RECORD FIELDS FIRST */}

                  <div className="view-grid">
                    {FIELD_MAP[
                      selectedObject
                    ].map(
                      (field) => (
                        <div
                          className="view-field"
                          key={
                            field
                          }
                        >
                          <span>
                            {formatFieldName(
                              field
                            )}
                          </span>

                          <strong>
                            {
                              selectedRecord[
                                field
                              ]
                                ? selectedRecord[
                                    field
                                  ]
                                : "—"
                            }
                          </strong>
                        </div>
                      )
                    )}
                  </div>

                  {/* BUTTONS AT BOTTOM */}

                  <div className="view-actions">
                    <button
                      type="button"
                      className="cancel"
                      onClick={
                        closeModal
                      }
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      className="save"
                      onClick={() =>
                        openEdit(
                          selectedRecord
                        )
                      }
                    >
                      Edit Record
                    </button>
                  </div>
                </div>
              )}

            {/* =================================================
                CREATE / EDIT FORM
            ================================================= */}

            {modalType !==
              "view" && (
              <form
                className="form"
                onSubmit={
                  saveRecord
                }
              >
                <div className="form-grid">
                  {CREATE_FIELDS[
                    selectedObject
                  ].map(
                    (field) => {
                      const options =
                        PICKLISTS[
                          selectedObject
                        ]?.[field];

                      return (
                        <div
                          className="form-field"
                          key={
                            field
                          }
                        >
                          <label>
                            {formatFieldName(
                              field
                            )}

                            {isRequired(
                              field
                            ) && (
                              <em>
                                *
                              </em>
                            )}
                          </label>

                          {options ? (
                            <select
                              value={
                                formData[
                                  field
                                ] ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                handleChange(
                                  field,
                                  event
                                    .target
                                    .value
                                )
                              }
                            >
                              <option value="">
                                Select{" "}
                                {formatFieldName(
                                  field
                                )}
                              </option>

                              {options.map(
                                (
                                  option
                                ) => (
                                  <option
                                    key={
                                      option
                                    }
                                    value={
                                      option
                                    }
                                  >
                                    {
                                      option
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          ) : (
                            <input
                              type={getInputType(
                                field
                              )}
                              value={
                                formData[
                                  field
                                ] ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                handleChange(
                                  field,
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder={`Enter ${formatFieldName(
                                field
                              )}`}
                              min={
                                field ===
                                "Probability"
                                  ? 0
                                  : undefined
                              }
                              max={
                                field ===
                                "Probability"
                                  ? 100
                                  : undefined
                              }
                            />
                          )}
                        </div>
                      );
                    }
                  )}
                </div>

                {error && (
                  <div className="form-error">
                    {error}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel"
                    onClick={
                      closeModal
                    }
                    disabled={
                      saving
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="save"
                    disabled={
                      saving
                    }
                  >
                    {saving
                      ? "Saving..."
                      : modalType ===
                        "create"
                      ? "Create Record"
                      : "Save Changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;