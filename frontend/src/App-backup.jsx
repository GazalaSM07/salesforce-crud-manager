import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

const objects = [
  "Account",
  "Opportunity",
  "Lead",
  "Contact",
  "Case",
];

const fields = {
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
  // ==================================================
  // STATE
  // ==================================================

  const [selectedObject, setSelectedObject] =
    useState("Account");

  const [records, setRecords] =
    useState([]);

  const [authenticated, setAuthenticated] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // Create popup
  const [showCreateForm, setShowCreateForm] =
    useState(false);

  // Edit popup
  const [showEditForm, setShowEditForm] =
    useState(false);

  // View popup
  const [showViewForm, setShowViewForm] =
    useState(false);

  // Currently editing record
  const [editingRecordId, setEditingRecordId] =
    useState(null);

  // Currently viewing record
  const [viewingRecord, setViewingRecord] =
    useState(null);

  // Form data
  const [formData, setFormData] =
    useState({});


  // ==================================================
  // CHECK LOGIN WHEN PAGE OPENS
  // ==================================================

  useEffect(() => {
    checkAuthentication();
  }, []);


  // ==================================================
  // CHECK AUTHENTICATION
  // ==================================================

  async function checkAuthentication() {
    try {
      const response = await fetch(
        `${API_URL}/auth/status`,
        {
          credentials: "include",
        }
      );

      const data = await response.json();

      console.log(
        "Authentication status:",
        data
      );

      setAuthenticated(
        data.authenticated === true
      );

      if (data.authenticated === true) {
        await loadRecords("Account");
      }

    } catch (error) {
      console.error(
        "Authentication check failed:",
        error
      );
    }
  }


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

      setAuthenticated(false);
      setRecords([]);

    } catch (error) {
      console.error(
        "Logout failed:",
        error
      );
    }
  }


  // ==================================================
  // LOAD RECORDS
  // ==================================================

  async function loadRecords(objectName) {
    setLoading(true);
    setError("");

    try {
      console.log(
        "Loading records:",
        objectName
      );

      const response = await fetch(
        `${API_URL}/api/records/${objectName}`,
        {
          credentials: "include",
        }
      );

      const responseText =
        await response.text();

      let data = {};

      try {
        data =
          responseText
            ? JSON.parse(responseText)
            : {};
      } catch {
        throw new Error(
          `Server returned an invalid response. HTTP status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to load records."
        );
      }

      console.log(
        "Records received:",
        data
      );

      setRecords(
        data.records || []
      );

    } catch (error) {
      console.error(
        "Load records error:",
        error
      );

      setError(
        error.message
      );

      setRecords([]);

    } finally {
      setLoading(false);
    }
  }


  // ==================================================
  // CHANGE SALESFORCE OBJECT
  // ==================================================

  function handleObjectChange(event) {
    const objectName =
      event.target.value;

    setSelectedObject(
      objectName
    );

    closeAllForms();

    loadRecords(
      objectName
    );
  }


  // ==================================================
  // CLOSE ALL POPUPS
  // ==================================================

  function closeAllForms() {
    setShowCreateForm(false);
    setShowEditForm(false);
    setShowViewForm(false);

    setEditingRecordId(null);
    setViewingRecord(null);

    setFormData({});
  }


  // ==================================================
  // FORM INPUT
  // ==================================================

  function handleInputChange(event) {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previousData) => ({
        ...previousData,
        [name]: value,
      })
    );
  }


  // ==================================================
  // CREATE
  // ==================================================

  function openCreateForm() {
    setFormData({});
    setError("");
    setShowCreateForm(true);
  }


  function closeCreateForm() {
    setShowCreateForm(false);
    setFormData({});
  }


  async function createRecord(event) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      console.log(
        "Creating:",
        selectedObject,
        formData
      );

      const response = await fetch(
        `${API_URL}/api/records/${selectedObject}`,
        {
          method: "POST",

          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            formData
          ),
        }
      );

      const responseText =
        await response.text();

      let data = {};

      try {
        data =
          responseText
            ? JSON.parse(responseText)
            : {};
      } catch {
        throw new Error(
          `Server returned an invalid response. HTTP status: ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to create record."
        );
      }

      alert(
        `${selectedObject} created successfully!`
      );

      closeCreateForm();

      await loadRecords(
        selectedObject
      );

    } catch (error) {
      console.error(
        "Create error:",
        error
      );

      setError(
        error.message
      );

    } finally {
      setLoading(false);
    }
  }


  // ==================================================
  // VIEW RECORD
  // ==================================================

  function openViewForm(record) {
    console.log(
      "VIEW RECORD:",
      record
    );

    setViewingRecord(
      record
    );

    setShowViewForm(true);

    setError("");
  }


  function closeViewForm() {
    setShowViewForm(false);
    setViewingRecord(null);
  }


  // ==================================================
  // EDIT RECORD
  // ==================================================

  function openEditForm(record) {
    console.log(
      "EDIT RECORD:",
      record
    );

    setEditingRecordId(
      record.Id
    );

    const editableData = {};

    fields[
      selectedObject
    ].forEach((field) => {
      editableData[field] =
        record[field] ?? "";
    });

    setFormData(
      editableData
    );

    setShowEditForm(true);

    setError("");
  }


  function closeEditForm() {
    setShowEditForm(false);
    setEditingRecordId(null);
    setFormData({});
  }


  // ==================================================
  // UPDATE RECORD
  // ==================================================

  async function updateRecord(event) {
    event.preventDefault();

    console.log(
      "UPDATE BUTTON CLICKED"
    );

    console.log(
      "Object:",
      selectedObject
    );

    console.log(
      "Record ID:",
      editingRecordId
    );

    console.log(
      "Data:",
      formData
    );

    setLoading(true);
    setError("");

    try {
      const url =
        `${API_URL}/api/records/` +
        `${selectedObject}/` +
        `${editingRecordId}`;

      const response =
        await fetch(
          url,
          {
            method: "PATCH",

            credentials: "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              formData
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
          throw new Error(
            `Server returned a non-JSON response. HTTP status: ${response.status}`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Update failed. HTTP status: ${response.status}`
        );
      }

      alert(
        `${selectedObject} updated successfully!`
      );

      closeEditForm();

      await loadRecords(
        selectedObject
      );

    } catch (error) {
      console.error(
        "Update error:",
        error
      );

      setError(
        error.message
      );

    } finally {
      setLoading(false);
    }
  }


  // ==================================================
  // DELETE RECORD
  // ==================================================

  async function deleteRecord(recordId) {
    const confirmed =
      window.confirm(
        `Are you sure you want to delete this ${selectedObject}?`
      );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log(
        "Deleting:",
        selectedObject,
        recordId
      );

      const response =
        await fetch(
          `${API_URL}/api/records/${selectedObject}/${recordId}`,
          {
            method: "DELETE",

            credentials: "include",
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
          throw new Error(
            `Server returned a non-JSON response. HTTP status: ${response.status}`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Delete failed. HTTP status: ${response.status}`
        );
      }

      alert(
        `${selectedObject} deleted successfully!`
      );

      await loadRecords(
        selectedObject
      );

    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      setError(
        error.message
      );

    } finally {
      setLoading(false);
    }
  }


  // ==================================================
  // GET FIELD VALUE
  // ==================================================

  function getFieldValue(
    record,
    field
  ) {
    const value =
      record[field];

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "—";
    }

    return value;
  }


  // ==================================================
  // RENDER
  // ==================================================

  return (
    <div className="app">

      {/* ==================================================
          HEADER
      ================================================== */}

      <header className="header">

        <div>
          <h1>
            Salesforce CRUD Manager
          </h1>

          <p>
            Account, Opportunity, Lead,
            Contact and Case Manager
          </p>
        </div>

        <div>
          {!authenticated ? (
            <button
              className="login-button"
              onClick={login}
            >
              Login with Salesforce
            </button>
          ) : (
            <button
              className="logout-button"
              onClick={logout}
            >
              Logout
            </button>
          )}
        </div>

      </header>


      {/* ==================================================
          MAIN
      ================================================== */}

      <main className="main">

        {!authenticated ? (

          <div className="login-message">

            <h2>
              Connect to Salesforce
            </h2>

            <p>
              Login with Salesforce to
              manage your records.
            </p>

            <button
              className="login-button large"
              onClick={login}
            >
              Login with Salesforce
            </button>

          </div>

        ) : (

          <>

            {/* ==================================================
                TOOLBAR
            ================================================== */}

            <div className="toolbar">

              <div className="object-selector">

                <label htmlFor="object-select">
                  Salesforce Object
                </label>

                <select
                  id="object-select"
                  value={
                    selectedObject
                  }
                  onChange={
                    handleObjectChange
                  }
                >

                  {objects.map(
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


            {/* ==================================================
                ERROR
            ================================================== */}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}


            {/* ==================================================
                CREATE MODAL
            ================================================== */}

            {showCreateForm && (

              <div className="form-overlay">

                <div className="form-modal">

                  <h2>
                    Create{" "}
                    {selectedObject}
                  </h2>

                  <form
                    onSubmit={
                      createRecord
                    }
                  >

                    {fields[
                      selectedObject
                    ].map(
                      (field) => (
                        <div
                          className="form-group"
                          key={field}
                        >

                          <label
                            htmlFor={
                              `create-${field}`
                            }
                          >
                            {field}
                          </label>

                          <input
                            id={
                              `create-${field}`
                            }
                            name={field}
                            value={
                              formData[
                                field
                              ] || ""
                            }
                            onChange={
                              handleInputChange
                            }
                          />

                        </div>
                      )
                    )}

                    <div className="form-buttons">

                      <button
                        type="button"
                        className="cancel-button"
                        onClick={
                          closeCreateForm
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="create-button"
                        disabled={
                          loading
                        }
                      >
                        {loading
                          ? "Creating..."
                          : `Create ${selectedObject}`}
                      </button>

                    </div>

                  </form>

                </div>

              </div>
            )}


            {/* ==================================================
                VIEW MODAL
            ================================================== */}

            {showViewForm &&
              viewingRecord && (

                <div className="form-overlay">

                  <div className="form-modal">

                    <h2>
                      View{" "}
                      {selectedObject}
                    </h2>

                    <div className="view-record">

                      <div className="view-record-id">
                        <strong>
                          Record ID:
                        </strong>

                        <span>
                          {viewingRecord.Id}
                        </span>
                      </div>


                      {fields[
                        selectedObject
                      ].map(
                        (field) => (

                          <div
                            className="form-group"
                            key={field}
                          >

                            <label>
                              {field}
                            </label>

                            <input
                              value={
                                getFieldValue(
                                  viewingRecord,
                                  field
                                )
                              }
                              readOnly
                            />

                          </div>

                        )
                      )}

                    </div>


                    <div className="form-buttons">

                      <button
                        type="button"
                        className="cancel-button"
                        onClick={
                          closeViewForm
                        }
                      >
                        Close
                      </button>

                    </div>

                  </div>

                </div>
              )}


            {/* ==================================================
                EDIT MODAL
            ================================================== */}

            {showEditForm && (

              <div className="form-overlay">

                <div className="form-modal">

                  <h2>
                    Edit{" "}
                    {selectedObject}
                  </h2>

                  <form
                    onSubmit={
                      updateRecord
                    }
                  >

                    {fields[
                      selectedObject
                    ].map(
                      (field) => (

                        <div
                          className="form-group"
                          key={field}
                        >

                          <label
                            htmlFor={
                              `edit-${field}`
                            }
                          >
                            {field}
                          </label>

                          <input
                            id={
                              `edit-${field}`
                            }
                            name={field}
                            value={
                              formData[
                                field
                              ] || ""
                            }
                            onChange={
                              handleInputChange
                            }
                          />

                        </div>

                      )
                    )}

                    <div className="form-buttons">

                      <button
                        type="button"
                        className="cancel-button"
                        onClick={
                          closeEditForm
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="create-button"
                        disabled={
                          loading
                        }
                      >
                        {loading
                          ? "Updating..."
                          : `Update ${selectedObject}`}
                      </button>

                    </div>

                  </form>

                </div>

              </div>
            )}


            {/* ==================================================
                RECORDS
            ================================================== */}

            <section className="records-section">

              <div className="section-header">

                <div>
                  <h2>
                    {selectedObject} Records
                  </h2>

                  <p>
                    Salesforce records
                  </p>
                </div>

                <div className="record-count">
                  {records.length} records
                </div>

              </div>


              {loading ? (

                <div className="loading">
                  Loading records...
                </div>

              ) : (

                <div className="table-container">

                  <table>

                    <thead>

                      <tr>

                        <th>
                          Actions
                        </th>

                        {fields[
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

                      </tr>

                    </thead>


                    <tbody>

                      {records.length === 0 ? (

                        <tr>

                          <td
                            colSpan={
                              fields[
                                selectedObject
                              ].length + 1
                            }
                            className="no-records"
                          >
                            No records found.
                          </td>

                        </tr>

                      ) : (

                        records.map(
                          (record) => (

                            <tr
                              key={
                                record.Id
                              }
                            >

                              {/* ACTION BUTTONS */}

                              <td>

                                <div className="actions">

                                  <button
                                    type="button"
                                    className="view-button"
                                    onClick={() =>
                                      openViewForm(
                                        record
                                      )
                                    }
                                  >
                                    View
                                  </button>


                                  <button
                                    type="button"
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
                                    type="button"
                                    className="delete-button"
                                    onClick={() =>
                                      deleteRecord(
                                        record.Id
                                      )
                                    }
                                  >
                                    Delete
                                  </button>

                                </div>

                              </td>


                              {/* RECORD FIELDS */}

                              {fields[
                                selectedObject
                              ].map(
                                (field) => (

                                  <td
                                    key={
                                      field
                                    }
                                  >
                                    {getFieldValue(
                                      record,
                                      field
                                    )}
                                  </td>

                                )
                              )}

                            </tr>

                          )
                        )

                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </section>

          </>

        )}

      </main>

    </div>
  );
}

export default App;