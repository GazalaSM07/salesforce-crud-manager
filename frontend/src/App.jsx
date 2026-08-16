import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "";

const OBJECTS = [
  "Account",
  "Opportunity",
  "Lead",
  "Contact",
  "Case",
];

const FIELD_MAP = {
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

const CREATE_FIELDS = {
  Account: [
    "Name",
    "Phone",
    "Website",
    "Industry",
    "Type",
  ],

  Opportunity: [
    "Name",
    "Amount",
    "StageName",
    "CloseDate",
    "Type",
  ],

  Lead: [
    "FirstName",
    "LastName",
    "Company",
    "Email",
    "Phone",
  ],

  Contact: [
    "FirstName",
    "LastName",
    "Email",
    "Phone",
    "Department",
  ],

  Case: [
    "Subject",
    "Status",
    "Priority",
    "Origin",
    "Description",
  ],
};

const LABELS = {
  Id: "ID",
  Name: "Name",
  Phone: "Phone",
  Website: "Website",
  Industry: "Industry",
  Type: "Type",
  Amount: "Amount",
  StageName: "Stage",
  CloseDate: "Close Date",
  FirstName: "First Name",
  LastName: "Last Name",
  Company: "Company",
  Email: "Email",
  Department: "Department",
  Subject: "Subject",
  Status: "Status",
  Priority: "Priority",
  Origin: "Origin",
  Description: "Description",
};

function getLabel(field) {
  return LABELS[field] || field;
}

function formatValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function getInputType(field) {
  if (field === "Amount") {
    return "number";
  }

  if (field === "CloseDate") {
    return "date";
  }

  if (field === "Email") {
    return "email";
  }

  if (field === "Website") {
    return "url";
  }

  if (field === "Description") {
    return "textarea";
  }

  return "text";
}

function getInitials(record, objectName) {
  if (objectName === "Account") {
    return (
      record?.Name?.substring(0, 2).toUpperCase() ||
      "AC"
    );
  }

  if (
    objectName === "Lead" ||
    objectName === "Contact"
  ) {
    const first =
      record?.FirstName?.[0] || "";

    const last =
      record?.LastName?.[0] || "";

    return (
      `${first}${last}`.toUpperCase() ||
      "US"
    );
  }

  if (objectName === "Opportunity") {
    return "OP";
  }

  if (objectName === "Case") {
    return "CS";
  }

  return "SF";
}

function getBadgeClass(field, value) {
  if (!value) {
    return "";
  }

  const normalized =
    String(value).toLowerCase();

  if (
    field === "StageName" ||
    field === "Status"
  ) {
    if (
      normalized.includes("closed") ||
      normalized.includes("won") ||
      normalized.includes("completed") ||
      normalized.includes("resolved")
    ) {
      return "badge-success";
    }

    if (
      normalized.includes("lost") ||
      normalized.includes("cancel") ||
      normalized.includes("rejected")
    ) {
      return "badge-danger";
    }

    if (
      normalized.includes("progress") ||
      normalized.includes("open") ||
      normalized.includes("working")
    ) {
      return "badge-warning";
    }

    return "badge-info";
  }

  if (field === "Priority") {
    if (
      normalized.includes("high") ||
      normalized.includes("critical")
    ) {
      return "badge-danger";
    }

    if (normalized.includes("medium")) {
      return "badge-warning";
    }

    if (normalized.includes("low")) {
      return "badge-success";
    }
  }

  return "";
}

function App() {
  const [authenticated, setAuthenticated] =
    useState(false);

  const [checkingAuth, setCheckingAuth] =
    useState(true);

  const [objectName, setObjectName] =
    useState("Account");

  const [records, setRecords] =
    useState([]);

  const [totalSize, setTotalSize] =
    useState(0);

  const [page, setPage] =
    useState(0);

  const [hasMore, setHasMore] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [modal, setModal] =
    useState(null);

  const [selectedRecord, setSelectedRecord] =
    useState(null);

  const [formData, setFormData] =
    useState({});

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [searchTerm, setSearchTerm] =
    useState("");

  const loaderRef = useRef(null);

  // ==================================================
  // AUTO HIDE SUCCESS MESSAGE
  // ==================================================

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => clearTimeout(timer);
  }, [successMessage]);

  // ==================================================
  // CHECK AUTHENTICATION
  // ==================================================

  const checkAuth = useCallback(async () => {
    try {
      setCheckingAuth(true);

      const response = await fetch(
        `${API_URL}/auth/status`,
        {
          credentials: "include",
        }
      );

      const data =
        await response.json();

      setAuthenticated(
        Boolean(data.authenticated)
      );
    } catch (err) {
      console.error(
        "Authentication check failed:",
        err
      );

      setAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // ==================================================
  // LOAD RECORDS
  // ==================================================

  const loadRecords = useCallback(
    async (
      requestedPage = 1,
      append = false
    ) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await fetch(
          `${API_URL}/api/records/${objectName}?page=${requestedPage}`,
          {
            credentials: "include",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Failed to load records."
          );
        }

        const incomingRecords =
          data.records || [];

        if (append) {
          setRecords((previous) => [
            ...previous,
            ...incomingRecords,
          ]);
        } else {
          setRecords(incomingRecords);
        }

        setTotalSize(
          Number(data.totalSize || 0)
        );

        setPage(
          Number(
            data.page ||
              requestedPage
          )
        );

        setHasMore(
          Boolean(data.hasMore)
        );
      } catch (err) {
        console.error(
          "Load records error:",
          err
        );

        if (
          err.message
            .toLowerCase()
            .includes(
              "not authenticated"
            )
        ) {
          setAuthenticated(false);
        }

        setError(err.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [objectName]
  );

  // ==================================================
  // LOAD FIRST PAGE
  // ==================================================

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    setRecords([]);
    setPage(0);
    setHasMore(false);
    setSearchTerm("");

    loadRecords(1, false);
  }, [
    authenticated,
    objectName,
    loadRecords,
  ]);

  // ==================================================
  // INFINITE SCROLL
  // ==================================================

  useEffect(() => {
    const element =
      loaderRef.current;

    if (!element) {
      return;
    }

    if (!hasMore) {
      return;
    }

    const observer =
      new IntersectionObserver(
        (entries) => {
          const firstEntry =
            entries[0];

          if (
            firstEntry.isIntersecting &&
            !loadingMore &&
            !loading
          ) {
            loadRecords(
              page + 1,
              true
            );
          }
        },
        {
          root: null,
          rootMargin: "250px",
          threshold: 0,
        }
      );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [
    hasMore,
    loadingMore,
    loading,
    page,
    loadRecords,
  ]);

  // ==================================================
  // LOGIN
  // ==================================================

  function login() {
    window.location.href =
      `${API_URL}/auth/login`;
  }

  // ==================================================
  // LOGOUT
  // ==================================================

  async function logout() {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          credentials: "include",
        }
      );
    } catch (err) {
      console.error(
        "Logout error:",
        err
      );
    }

    setAuthenticated(false);
    setRecords([]);
  }

  // ==================================================
  // CREATE
  // ==================================================

  function openCreate() {
    const fields =
      CREATE_FIELDS[objectName] || [];

    const initialData = {};

    fields.forEach((field) => {
      initialData[field] = "";
    });

    setFormData(initialData);
    setSelectedRecord(null);
    setModal("create");
    setError("");
  }

  // ==================================================
  // VIEW
  // ==================================================

  function openView(record) {
    setSelectedRecord(record);
    setModal("view");
    setError("");
  }

  // ==================================================
  // EDIT
  // ==================================================

  function openEdit(record) {
    const fields =
      CREATE_FIELDS[objectName] || [];

    const initialData = {};

    fields.forEach((field) => {
      initialData[field] =
        record[field] ?? "";
    });

    setSelectedRecord(record);
    setFormData(initialData);
    setModal("edit");
    setError("");
  }

  // ==================================================
  // CLOSE MODAL
  // ==================================================

  function closeModal() {
    if (
      saving ||
      deleting
    ) {
      return;
    }

    setModal(null);
    setSelectedRecord(null);
    setFormData({});
  }

  // ==================================================
  // INPUT CHANGE
  // ==================================================

  function handleInputChange(
    field,
    value
  ) {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  // ==================================================
  // CREATE RECORD
  // ==================================================

  async function createRecord(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload =
        cleanPayload(formData);

      const response =
        await fetch(
          `${API_URL}/api/records/${objectName}`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getSalesforceError(data)
        );
      }

      closeModal();

      setSuccessMessage(
        `${objectName} created successfully.`
      );

      await loadRecords(
        1,
        false
      );
    } catch (err) {
      console.error(
        "Create error:",
        err
      );

      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // UPDATE RECORD
  // ==================================================

  async function updateRecord(event) {
    event.preventDefault();

    if (!selectedRecord?.Id) {
      setError(
        "Record ID is missing."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload =
        cleanPayload(formData);

      const response =
        await fetch(
          `${API_URL}/api/records/${objectName}/${selectedRecord.Id}`,
          {
            method: "PATCH",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getSalesforceError(data)
        );
      }

      closeModal();

      setSuccessMessage(
        `${objectName} updated successfully.`
      );

      await loadRecords(
        1,
        false
      );
    } catch (err) {
      console.error(
        "Update error:",
        err
      );

      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ==================================================
  // DELETE
  // ==================================================

  async function deleteRecord(record) {
    if (!record?.Id) {
      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to delete this ${objectName} record?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeleting(true);
      setError("");

      const response =
        await fetch(
          `${API_URL}/api/records/${objectName}/${record.Id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getSalesforceError(data)
        );
      }

      setRecords((previous) =>
        previous.filter(
          (item) =>
            item.Id !== record.Id
        )
      );

      setTotalSize((previous) =>
        Math.max(
          0,
          previous - 1
        )
      );

      setSuccessMessage(
        `${objectName} deleted successfully.`
      );
    } catch (err) {
      console.error(
        "Delete error:",
        err
      );

      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  // ==================================================
  // SEARCH
  // ==================================================

  const filteredRecords =
    records.filter((record) => {
      if (!searchTerm.trim()) {
        return true;
      }

      const search =
        searchTerm
          .toLowerCase()
          .trim();

      return Object.values(record).some(
        (value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(search)
      );
    });

  // ==================================================
  // LOADING AUTH
  // ==================================================

  if (checkingAuth) {
    return (
      <div className="app">
        <div className="center-loading">
          <div className="spinner"></div>

          <p>
            Connecting to Salesforce...
          </p>
        </div>
      </div>
    );
  }

  // ==================================================
  // LOGIN
  // ==================================================

  if (!authenticated) {
    return (
      <div className="app login-page">
        <header className="header">
          <div className="brand-area">
            <div className="brand-icon">
              ☁
            </div>

            <div>
              <h1>
                Salesforce CRUD Manager
              </h1>

              <p>
                Smart Salesforce record
                management
              </p>
            </div>
          </div>
        </header>

        <main className="main login-main">
          <section className="login-message">
            <div className="login-cloud">
              ☁
            </div>

            <span className="eyebrow">
              SALESFORCE CONNECT
            </span>

            <h2>
              Welcome back
            </h2>

            <p>
              Connect your Salesforce
              Developer Org and manage
              Accounts, Opportunities,
              Leads, Contacts and Cases
              from one simple dashboard.
            </p>

            <button
              className="login-button large"
              onClick={login}
            >
              <span>
                Login with Salesforce
              </span>

              <span className="button-arrow">
                →
              </span>
            </button>

            <div className="login-info">
              <span>🔒</span>
              Secure OAuth 2.0
              authentication
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ==================================================
  // MAIN APPLICATION
  // ==================================================

  const fields =
    FIELD_MAP[objectName];

  const displayedRecords =
    filteredRecords;

  const remainingRecords =
    Math.max(
      0,
      totalSize - records.length
    );

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="brand-area">
          <div className="brand-icon">
            ☁
          </div>

          <div>
            <h1>
              Salesforce CRUD Manager
            </h1>

            <p>
              Your Salesforce data
              workspace
            </p>
          </div>
        </div>

        <div className="header-actions">
          <div className="connection-status">
            <span className="status-dot"></span>
            Salesforce Connected
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="main">
        {/* PAGE INTRO */}
        <section className="page-intro">
          <div>
            <span className="eyebrow">
              SALESFORCE WORKSPACE
            </span>

            <h2>
              Manage your data
            </h2>

            <p>
              Create, view, edit and
              delete Salesforce records
              from one place.
            </p>
          </div>
        </section>

        {/* DASHBOARD CARDS */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              ◉
            </div>

            <div>
              <span>
                Current Object
              </span>

              <strong>
                {objectName}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              ✓
            </div>

            <div>
              <span>
                Total Records
              </span>

              <strong>
                {totalSize.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              ≡
            </div>

            <div>
              <span>
                Loaded
              </span>

              <strong>
                {records.length}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              ↘
            </div>

            <div>
              <span>
                Remaining
              </span>

              <strong>
                {remainingRecords.toLocaleString()}
              </strong>
            </div>
          </div>
        </section>

        {/* TOOLBAR */}
        <section className="toolbar">
          <div className="toolbar-left">
            <div className="object-selector">
              <label htmlFor="objectSelect">
                Salesforce Object
              </label>

              <select
                id="objectSelect"
                value={objectName}
                onChange={(event) =>
                  setObjectName(
                    event.target.value
                  )
                }
              >
                {OBJECTS.map(
                  (object) => (
                    <option
                      key={object}
                      value={object}
                    >
                      {object}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="search-box">
              <span className="search-icon">
                ⌕
              </span>

              <input
                type="text"
                placeholder={`Search ${objectName} records...`}
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
              />

              {searchTerm && (
                <button
                  className="search-clear"
                  onClick={() =>
                    setSearchTerm("")
                  }
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <button
            className="create-button"
            onClick={openCreate}
          >
            <span>+</span>
            Create {objectName}
          </button>
        </section>

        {/* ERROR */}
        {error && (
          <div className="error-message">
            <span className="alert-icon">
              !
            </span>

            <div>
              <strong>
                Something went wrong
              </strong>

              <p>{error}</p>
            </div>

            <button
              className="error-close"
              onClick={() =>
                setError("")
              }
            >
              ×
            </button>
          </div>
        )}

        {/* SUCCESS */}
        {successMessage && (
          <div className="success-message">
            <span className="success-check">
              ✓
            </span>

            <span>
              {successMessage}
            </span>

            <button
              onClick={() =>
                setSuccessMessage("")
              }
            >
              ×
            </button>
          </div>
        )}

        {/* RECORD SECTION */}
        <section className="records-section">
          <div className="section-header">
            <div>
              <div className="section-title-row">
                <div className="section-object-icon">
                  {getInitials(
                    {},
                    objectName
                  )}
                </div>

                <div>
                  <h2>
                    {objectName} Records
                  </h2>

                  <p>
                    {searchTerm
                      ? `${displayedRecords.length} matching records`
                      : `Showing ${records.length} loaded records`}
                  </p>
                </div>
              </div>
            </div>

            <div className="record-count">
              {displayedRecords.length}
              <span>
                displayed
              </span>
            </div>
          </div>

          {loading ? (
            <div className="loading">
              <div className="spinner"></div>

              <p>
                Loading Salesforce
                records...
              </p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th className="actions-header">
                        Actions
                      </th>

                      {fields.map(
                        (field) => (
                          <th
                            key={field}
                          >
                            {getLabel(
                              field
                            )}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {displayedRecords.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={
                            fields.length +
                            1
                          }
                        >
                          <div className="empty-state">
                            <div className="empty-icon">
                              {searchTerm
                                ? "⌕"
                                : "☁"}
                            </div>

                            <h3>
                              {searchTerm
                                ? "No matching records"
                                : "No records found"}
                            </h3>

                            <p>
                              {searchTerm
                                ? "Try changing your search."
                                : `There are no ${objectName} records available.`}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedRecords.map(
                        (record) => (
                          <tr
                            key={
                              record.Id
                            }
                          >
                            <td className="actions-cell">
                              <div className="actions">
                                <button
                                  className="view-button"
                                  onClick={() =>
                                    openView(
                                      record
                                    )
                                  }
                                  title="View record"
                                >
                                  View
                                </button>

                                <button
                                  className="edit-button"
                                  onClick={() =>
                                    openEdit(
                                      record
                                    )
                                  }
                                  title="Edit record"
                                >
                                  Edit
                                </button>

                                <button
                                  className="delete-button"
                                  onClick={() =>
                                    deleteRecord(
                                      record
                                    )
                                  }
                                  disabled={
                                    deleting
                                  }
                                  title="Delete record"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>

                            {fields.map(
                              (field) => {
                                const value =
                                  record[
                                    field
                                  ];

                                const badgeClass =
                                  getBadgeClass(
                                    field,
                                    value
                                  );

                                return (
                                  <td
                                    key={
                                      field
                                    }
                                  >
                                    {field ===
                                      "Name" ||
                                    field ===
                                      "Subject" ? (
                                      <div className="record-name">
                                        <div className="record-avatar">
                                          {getInitials(
                                            record,
                                            objectName
                                          )}
                                        </div>

                                        <span>
                                          {formatValue(
                                            value
                                          )}
                                        </span>
                                      </div>
                                    ) : badgeClass ? (
                                      <span
                                        className={`status-badge ${badgeClass}`}
                                      >
                                        {formatValue(
                                          value
                                        )}
                                      </span>
                                    ) : (
                                      formatValue(
                                        value
                                      )
                                    )}
                                  </td>
                                );
                              }
                            )}
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div
                ref={loaderRef}
                className="scroll-loader"
              >
                {loadingMore && (
                  <div className="loading-more">
                    <div className="small-spinner"></div>
                    Loading next 20
                    records...
                  </div>
                )}

                {!loadingMore &&
                  hasMore && (
                    <div className="load-hint">
                      ↓ Scroll down to
                      load the next 20
                      records
                    </div>
                  )}

                {!loadingMore &&
                  !hasMore &&
                  records.length > 0 && (
                    <div className="no-more-records">
                      ✓ All Salesforce
                      records loaded
                    </div>
                  )}
              </div>
            </>
          )}
        </section>
      </main>

      {/* VIEW MODAL */}
      {modal === "view" && (
        <div
          className="form-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="form-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  RECORD DETAILS
                </span>

                <h2>
                  View {objectName}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <div className="view-profile">
              <div className="large-avatar">
                {getInitials(
                  selectedRecord,
                  objectName
                )}
              </div>

              <div>
                <strong>
                  {formatValue(
                    selectedRecord?.Name ||
                      selectedRecord?.Subject ||
                      selectedRecord?.Company ||
                      `${selectedRecord?.FirstName || ""} ${selectedRecord?.LastName || ""}`
                  )}
                </strong>

                <span>
                  {objectName}
                </span>
              </div>
            </div>

            <div className="view-record">
              {fields.map(
                (field) => (
                  <div
                    className="view-row"
                    key={field}
                  >
                    <span>
                      {getLabel(
                        field
                      )}
                    </span>

                    <strong>
                      {formatValue(
                        selectedRecord?.[
                          field
                        ]
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>

            <div className="form-buttons">
              <button
                className="cancel-button"
                onClick={closeModal}
              >
                Close
              </button>

              <button
                className="edit-button modal-edit"
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
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {(modal === "create" ||
        modal === "edit") && (
        <div
          className="form-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="form-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {modal === "create"
                    ? "NEW RECORD"
                    : "UPDATE RECORD"}
                </span>

                <h2>
                  {modal === "create"
                    ? `Create ${objectName}`
                    : `Edit ${objectName}`}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                modal === "create"
                  ? createRecord
                  : updateRecord
              }
            >
              <div className="form-grid">
                {(
                  CREATE_FIELDS[
                    objectName
                  ] || []
                ).map((field) => {
                  const inputType =
                    getInputType(
                      field
                    );

                  return (
                    <div
                      className={`form-group ${
                        inputType ===
                        "textarea"
                          ? "full-width"
                          : ""
                      }`}
                      key={field}
                    >
                      <label
                        htmlFor={`field-${field}`}
                      >
                        {getLabel(
                          field
                        )}
                      </label>

                      {inputType ===
                      "textarea" ? (
                        <textarea
                          id={`field-${field}`}
                          value={
                            formData[
                              field
                            ] ?? ""
                          }
                          onChange={(
                            event
                          ) =>
                            handleInputChange(
                              field,
                              event.target
                                .value
                            )
                          }
                          rows="4"
                          placeholder={`Enter ${getLabel(
                            field
                          ).toLowerCase()}`}
                        />
                      ) : (
                        <input
                          id={`field-${field}`}
                          type={
                            inputType
                          }
                          value={
                            formData[
                              field
                            ] ?? ""
                          }
                          onChange={(
                            event
                          ) =>
                            handleInputChange(
                              field,
                              event.target
                                .value
                            )
                          }
                          placeholder={`Enter ${getLabel(
                            field
                          ).toLowerCase()}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="form-buttons">
                <button
                  type="button"
                  className="cancel-button"
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
                  className="create-button"
                  disabled={
                    saving
                  }
                >
                  {saving ? (
                    <>
                      <div className="button-spinner"></div>
                      Saving...
                    </>
                  ) : modal ===
                    "create" ? (
                    <>
                      Create{" "}
                      {objectName}
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================================================
// HELPERS
// ==================================================

function cleanPayload(data) {
  const result = {};

  Object.entries(data).forEach(
    ([key, value]) => {
      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        result[key] = value;
      }
    }
  );

  return result;
}

function getSalesforceError(data) {
  if (!data) {
    return "Salesforce request failed.";
  }

  if (
    Array.isArray(data.details)
  ) {
    return data.details
      .map((item) => {
        if (
          typeof item === "string"
        ) {
          return item;
        }

        return (
          item.message ||
          item.errorCode ||
          JSON.stringify(item)
        );
      })
      .join(" | ");
  }

  if (
    data.details?.message
  ) {
    return data.details.message;
  }

  if (
    data.details?.[0]?.message
  ) {
    return data.details[0].message;
  }

  return (
    data.error ||
    "Salesforce request failed."
  );
}

export default App;