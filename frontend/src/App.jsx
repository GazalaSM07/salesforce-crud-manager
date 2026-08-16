import { useEffect, useState } from "react";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://salesforce-crud-backend-rffk.onrender.com";

const OBJECTS = [
  "Account",
  "Opportunity",
  "Lead",
  "Contact",
  "Case",
];

const FIELD_CONFIG = {
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

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [selectedObject, setSelectedObject] =
    useState("Account");

  const [records, setRecords] = useState([]);
  const [totalSize, setTotalSize] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  const [formData, setFormData] = useState({});

  // ============================================================
  // AUTH STATUS
  // ============================================================

  const checkAuth = async () => {
    try {
      setCheckingAuth(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/auth/status`,
        {
          method: "GET",

          // IMPORTANT:
          // This sends the Render session cookie.
          credentials: "include",

          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Auth status failed: ${response.status}`
        );
      }

      const data = await response.json();

      console.log("AUTH STATUS:", data);

      setAuthenticated(
        data.authenticated === true
      );
    } catch (err) {
      console.error(
        "Auth status error:",
        err
      );

      setAuthenticated(false);

      setError(
        "Unable to check Salesforce login status."
      );
    } finally {
      setCheckingAuth(false);
    }
  };

  // ============================================================
  // INITIAL AUTH CHECK
  // ============================================================

  useEffect(() => {
    checkAuth();
  }, []);

  // ============================================================
  // LOAD RECORDS
  // ============================================================

  const loadRecords = async (
    objectName = selectedObject,
    requestedPage = page
  ) => {
    if (!authenticated) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/api/records/${objectName}?page=${requestedPage}`,
        {
          method: "GET",

          // IMPORTANT:
          // Send Salesforce session cookie.
          credentials: "include",

          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      console.log(
        "RECORD RESPONSE:",
        data
      );

      if (response.status === 401) {
        setAuthenticated(false);

        setError(
          "Your Salesforce session has expired. Please login again."
        );

        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to load records."
        );
      }

      setRecords(
        Array.isArray(data.records)
          ? data.records
          : []
      );

      setTotalSize(
        Number(data.totalSize || 0)
      );

      setPage(
        Number(data.page || requestedPage)
      );

      setPageSize(
        Number(data.pageSize || 20)
      );

      setHasMore(
        data.hasMore === true
      );
    } catch (err) {
      console.error(
        "Load records error:",
        err
      );

      setError(
        err.message ||
          "Could not load Salesforce records."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LOAD WHEN OBJECT CHANGES
  // ============================================================

  useEffect(() => {
    if (authenticated) {
      setPage(1);
      loadRecords(
        selectedObject,
        1
      );
    }
  }, [
    authenticated,
    selectedObject,
  ]);

  // ============================================================
  // SALESFORCE LOGIN
  // ============================================================

  const loginWithSalesforce = () => {
    setError("");
    setMessage("");

    /*
      IMPORTANT:

      We redirect the browser directly to the backend OAuth route.

      Do NOT use fetch() here.

      The backend will redirect to Salesforce.
    */

    window.location.href =
      `${API_BASE}/auth/login`;
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const logout = async () => {
    try {
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/auth/logout`,
        {
          method: "GET",

          // IMPORTANT:
          // Send the session cookie so backend
          // can destroy the correct session.
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Logout failed."
        );
      }

      setAuthenticated(false);
      setRecords([]);
      setTotalSize(0);
      setPage(1);

      setMessage(
        "Logged out successfully."
      );
    } catch (err) {
      console.error(
        "Logout error:",
        err
      );

      setError(
        err.message ||
          "Logout failed."
      );
    }
  };

  // ============================================================
  // FORM
  // ============================================================

  const openCreateForm = () => {
    const fields =
      FIELD_CONFIG[selectedObject] || [];

    const initialData = {};

    fields.forEach((field) => {
      initialData[field] = "";
    });

    setEditingRecord(null);
    setFormData(initialData);
    setShowForm(true);
    setError("");
    setMessage("");
  };

  const openEditForm = (record) => {
    const fields =
      FIELD_CONFIG[selectedObject] || [];

    const initialData = {};

    fields.forEach((field) => {
      initialData[field] =
        record[field] ?? "";
    });

    setEditingRecord(record);
    setFormData(initialData);
    setShowForm(true);
    setError("");
    setMessage("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRecord(null);
    setFormData({});
  };

  const handleInputChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ============================================================
  // CREATE / UPDATE
  // ============================================================

  const saveRecord = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const payload = {};

      Object.entries(formData).forEach(
        ([key, value]) => {
          if (
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
          ) {
            payload[key] = value;
          }
        }
      );

      let url;
      let method;

      if (editingRecord) {
        url =
          `${API_BASE}/api/records/` +
          `${selectedObject}/` +
          `${editingRecord.Id}`;

        method = "PATCH";
      } else {
        url =
          `${API_BASE}/api/records/` +
          selectedObject;

        method = "POST";
      }

      const response = await fetch(
        url,
        {
          method,

          // IMPORTANT
          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),
        }
      );

      const data =
        await response.json();

      if (response.status === 401) {
        setAuthenticated(false);

        throw new Error(
          "Salesforce session expired."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to save record."
        );
      }

      setMessage(
        data?.message ||
          "Record saved successfully."
      );

      closeForm();

      await loadRecords(
        selectedObject,
        page
      );
    } catch (err) {
      console.error(
        "Save record error:",
        err
      );

      setError(
        err.message ||
          "Could not save record."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // DELETE
  // ============================================================

  const deleteRecord = async (
    record
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this record?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          `${API_BASE}/api/records/` +
            `${selectedObject}/` +
            `${record.Id}`,
          {
            method: "DELETE",

            // IMPORTANT
            credentials: "include",

            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (response.status === 401) {
        setAuthenticated(false);

        throw new Error(
          "Salesforce session expired."
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to delete record."
        );
      }

      setMessage(
        data?.message ||
          "Record deleted successfully."
      );

      await loadRecords(
        selectedObject,
        page
      );
    } catch (err) {
      console.error(
        "Delete record error:",
        err
      );

      setError(
        err.message ||
          "Could not delete record."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // PAGINATION
  // ============================================================

  const goToNextPage = () => {
    if (!hasMore) {
      return;
    }

    const nextPage =
      page + 1;

    setPage(nextPage);

    loadRecords(
      selectedObject,
      nextPage
    );
  };

  const goToPreviousPage = () => {
    if (page <= 1) {
      return;
    }

    const previousPage =
      page - 1;

    setPage(previousPage);

    loadRecords(
      selectedObject,
      previousPage
    );
  };

  // ============================================================
  // LOADING AUTH
  // ============================================================

  if (checkingAuth) {
    return (
      <div className="app">
        <div className="loading-screen">
          <h2>
            Salesforce CRUD Manager
          </h2>

          <p>
            Checking Salesforce login...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // LOGIN PAGE
  // ============================================================

  if (!authenticated) {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-card">
            <h1>
              Salesforce CRUD Manager
            </h1>

            <p className="login-subtitle">
              Connect your Salesforce
              account to manage records.
            </p>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

            {message && (
              <div className="success">
                {message}
              </div>
            )}

            <button
              className="salesforce-login-button"
              onClick={
                loginWithSalesforce
              }
            >
              Login with Salesforce
            </button>

            <p className="login-help">
              You will be redirected to
              Salesforce to authorize
              this application.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN APPLICATION
  // ============================================================

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>
            Salesforce CRUD Manager
          </h1>

          <p>
            Manage Salesforce records
          </p>
        </div>

        <button
          className="logout-button"
          onClick={logout}
        >
          Logout
        </button>
      </header>

      <main className="main">
        {/* OBJECT SELECTOR */}

        <div className="toolbar">
          <div className="object-selector">
            <label>
              Salesforce Object
            </label>

            <select
              value={selectedObject}
              onChange={(event) => {
                setSelectedObject(
                  event.target.value
                );

                setPage(1);
                setRecords([]);
                setError("");
                setMessage("");
              }}
            >
              {OBJECTS.map(
                (objectName) => (
                  <option
                    key={objectName}
                    value={objectName}
                  >
                    {objectName}
                  </option>
                )
              )}
            </select>
          </div>

          <button
            className="create-button"
            onClick={
              openCreateForm
            }
          >
            + Create{" "}
            {selectedObject}
          </button>
        </div>

        {/* MESSAGES */}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {message && (
          <div className="success">
            {message}
          </div>
        )}

        {/* RECORDS */}

        <div className="records-card">
          <div className="records-header">
            <div>
              <h2>
                {selectedObject}
              </h2>

              <span>
                Total records:{" "}
                {totalSize}
              </span>
            </div>

            <button
              className="refresh-button"
              onClick={() =>
                loadRecords(
                  selectedObject,
                  page
                )
              }
              disabled={loading}
            >
              {loading
                ? "Loading..."
                : "Refresh"}
            </button>
          </div>

          {loading &&
          records.length === 0 ? (
            <div className="empty-state">
              Loading Salesforce
              records...
            </div>
          ) : records.length ===
            0 ? (
            <div className="empty-state">
              No records found.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    {FIELD_CONFIG[
                      selectedObject
                    ].map(
                      (field) => (
                        <th
                          key={field}
                        >
                          {field}
                        </th>
                      )
                    )}

                    <th>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {records.map(
                    (record) => (
                      <tr
                        key={
                          record.Id
                        }
                      >
                        {FIELD_CONFIG[
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
                              className="edit-button"
                              onClick={() =>
                                openEditForm(
                                  record
                                )
                              }
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
          )}

          {/* PAGINATION */}

          <div className="pagination">
            <button
              onClick={
                goToPreviousPage
              }
              disabled={
                page <= 1 ||
                loading
              }
            >
              ← Previous
            </button>

            <span>
              Page {page}
            </span>

            <button
              onClick={
                goToNextPage
              }
              disabled={
                !hasMore ||
                loading
              }
            >
              Next →
            </button>
          </div>
        </div>
      </main>

      {/* CREATE / EDIT MODAL */}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>
                {editingRecord
                  ? `Edit ${selectedObject}`
                  : `Create ${selectedObject}`}
              </h2>

              <button
                className="close-button"
                onClick={
                  closeForm
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                saveRecord
              }
            >
              <div className="form-grid">
                {FIELD_CONFIG[
                  selectedObject
                ].map(
                  (field) => (
                    <div
                      className="form-field"
                      key={field}
                    >
                      <label
                        htmlFor={
                          field
                        }
                      >
                        {field}
                      </label>

                      {field ===
                      "Description" ? (
                        <textarea
                          id={field}
                          name={field}
                          value={
                            formData[
                              field
                            ] || ""
                          }
                          onChange={
                            handleInputChange
                          }
                          rows="5"
                        />
                      ) : (
                        <input
                          id={field}
                          name={field}
                          type={
                            field ===
                            "Amount"
                              ? "number"
                              : field ===
                                "CloseDate"
                              ? "date"
                              : "text"
                          }
                          value={
                            formData[
                              field
                            ] || ""
                          }
                          onChange={
                            handleInputChange
                          }
                        />
                      )}
                    </div>
                  )
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={
                    closeForm
                  }
                  disabled={
                    loading
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-button"
                  disabled={
                    loading
                  }
                >
                  {loading
                    ? "Saving..."
                    : editingRecord
                    ? "Update"
                    : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;