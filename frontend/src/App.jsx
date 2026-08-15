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

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [error, setError] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [totalSize, setTotalSize] =
    useState(0);

  const [hasMore, setHasMore] =
    useState(false);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [showEditForm, setShowEditForm] =
    useState(false);

  const [showViewForm, setShowViewForm] =
    useState(false);

  const [editingRecordId, setEditingRecordId] =
    useState(null);

  const [viewingRecord, setViewingRecord] =
    useState(null);

  const [formData, setFormData] =
    useState({});


  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    checkAuthentication();
  }, []);


  // ==================================================
  // SCROLL PAGINATION
  // ==================================================

  useEffect(() => {
    function handleScroll() {
      const scrollTop =
        window.scrollY;

      const windowHeight =
        window.innerHeight;

      const documentHeight =
        document.documentElement.scrollHeight;

      const distanceFromBottom =
        documentHeight -
        (scrollTop + windowHeight);

      if (
        distanceFromBottom < 300 &&
        hasMore &&
        !loadingMore &&
        !loading
      ) {
        loadMoreRecords();
      }
    }

    window.addEventListener(
      "scroll",
      handleScroll
    );

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, [
    hasMore,
    loadingMore,
    loading,
    page,
    selectedObject,
  ]);


  // ==================================================
  // AUTHENTICATION
  // ==================================================

  async function checkAuthentication() {
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

      const isAuthenticated =
        data.authenticated === true;

      setAuthenticated(
        isAuthenticated
      );

      if (isAuthenticated) {
        await loadRecords(
          "Account"
        );
      }
    } catch (error) {
      console.error(
        "Authentication error:",
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
      setPage(1);
      setTotalSize(0);
      setHasMore(false);
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  }


  // ==================================================
  // LOAD FIRST 20 RECORDS
  // ==================================================

  async function loadRecords(
    objectName
  ) {
    setLoading(true);
    setError("");

    setRecords([]);
    setPage(1);
    setTotalSize(0);
    setHasMore(false);

    try {
      console.log(
        "=============================================="
      );

      console.log(
        "GET FIRST 20 RECORDS"
      );

      console.log(
        "Object:",
        objectName
      );

      const response =
        await fetch(
          `${API_URL}/api/records/${objectName}?page=1`,
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
            ? JSON.parse(
                responseText
              )
            : {};
      } catch {
        throw new Error(
          "Server returned invalid JSON."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to load records."
        );
      }

      const newRecords =
        data.records || [];

      console.log(
        "Records returned:",
        newRecords.length
      );

      console.log(
        "Total Salesforce records:",
        data.totalSize
      );

      console.log(
        "Has more:",
        data.hasMore
      );

      setRecords(
        newRecords
      );

      setPage(
        data.page || 1
      );

      setTotalSize(
        data.totalSize || 0
      );

      setHasMore(
        data.hasMore === true
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
      setPage(1);
      setTotalSize(0);
      setHasMore(false);

    } finally {
      setLoading(false);
    }
  }


  // ==================================================
  // LOAD NEXT 20 RECORDS
  // ==================================================

  async function loadMoreRecords() {
    if (
      loadingMore ||
      loading ||
      !hasMore
    ) {
      return;
    }

    const nextPage =
      page + 1;

    setLoadingMore(true);
    setError("");

    try {
      console.log(
        "=============================================="
      );

      console.log(
        "LOADING NEXT PAGE"
      );

      console.log(
        "Object:",
        selectedObject
      );

      console.log(
        "Current page:",
        page
      );

      console.log(
        "Next page:",
        nextPage
      );

      const response =
        await fetch(
          `${API_URL}/api/records/${selectedObject}?page=${nextPage}`,
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
            ? JSON.parse(
                responseText
              )
            : {};
      } catch {
        throw new Error(
          "Server returned invalid JSON."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Failed to load more records."
        );
      }

      const newRecords =
        data.records || [];

      console.log(
        "Next page records:",
        newRecords.length
      );

      console.log(
        "Total:",
        data.totalSize
      );

      console.log(
        "Has more:",
        data.hasMore
      );


      // ==================================================
      // DUPLICATE PROTECTION
      // ==================================================

      setRecords(
        (previousRecords) => {
          const existingIds =
            new Set(
              previousRecords.map(
                (record) =>
                  record.Id
              )
            );

          const uniqueNewRecords =
            newRecords.filter(
              (record) =>
                !existingIds.has(
                  record.Id
                )
            );

          return [
            ...previousRecords,
            ...uniqueNewRecords,
          ];
        }
      );


      setPage(
        data.page || nextPage
      );

      setTotalSize(
        data.totalSize || 0
      );

      setHasMore(
        data.hasMore === true
      );

    } catch (error) {
      console.error(
        "Load more error:",
        error
      );

      setError(
        error.message
      );

    } finally {
      setLoadingMore(false);
    }
  }


  // ==================================================
  // OBJECT CHANGE
  // ==================================================

  function handleObjectChange(
    event
  ) {
    const objectName =
      event.target.value;

    setSelectedObject(
      objectName
    );

    closeAllForms();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    loadRecords(
      objectName
    );
  }


  // ==================================================
  // CLOSE FORMS
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
  // INPUT CHANGE
  // ==================================================

  function handleInputChange(
    event
  ) {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previous) => ({
        ...previous,
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


  async function createRecord(
    event
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          `${API_URL}/api/records/${selectedObject}`,
          {
            method: "POST",

            credentials: "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
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
            ? JSON.parse(
                responseText
              )
            : {};
      } catch {
        throw new Error(
          "Server returned invalid JSON."
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
  // VIEW
  // ==================================================

  function openViewForm(
    record
  ) {
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
  // EDIT
  // ==================================================

  function openEditForm(
    record
  ) {
    setEditingRecordId(
      record.Id
    );

    const editableData = {};

    fields[
      selectedObject
    ].forEach(
      (field) => {
        editableData[field] =
          record[field] ?? "";
      }
    );

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
  // UPDATE
  // ==================================================

  async function updateRecord(
    event
  ) {
    event.preventDefault();

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

            body:
              JSON.stringify(
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
            "Server returned invalid JSON."
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Update failed."
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
  // DELETE
  // ==================================================

  async function deleteRecord(
    recordId
  ) {
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
            "Server returned invalid JSON."
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Delete failed."
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
  // FIELD VALUE
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
  // UI
  // ==================================================

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <div>
          <h1>
            Salesforce CRUD Manager
          </h1>

          <p>
            Salesforce Account,
            Opportunity, Lead,
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


      {/* MAIN */}

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

            {/* TOOLBAR */}

            <div className="toolbar">

              <div className="object-selector">

                <label>
                  Salesforce Object
                </label>

                <select
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


            {/* ERROR */}

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}


            {/* RECORD INFORMATION */}

            <div className="record-info">

              <strong>
                {selectedObject}
              </strong>

              <span>
                Showing{" "}
                {records.length}
                {" "}of{" "}
                {totalSize}
                {" "}records
              </span>

            </div>


            {/* CREATE MODAL */}

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

                          <label>
                            {field}
                          </label>

                          <input
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


            {/* VIEW MODAL */}

            {showViewForm &&
              viewingRecord && (

                <div className="form-overlay">

                  <div className="form-modal">

                    <h2>
                      View{" "}
                      {selectedObject}
                    </h2>

                    <div className="view-record">

                      {/* RECORD ID */}

                      <div className="form-group">

                        <label>
                          Salesforce Record ID
                        </label>

                        <input
                          value={
                            viewingRecord.Id
                          }
                          readOnly
                        />

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


            {/* EDIT MODAL */}

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

                          <label>
                            {field}
                          </label>

                          <input
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


            {/* RECORDS */}

            <section className="records-section">

              <div className="section-header">

                <div>

                  <h2>
                    {selectedObject}
                    {" "}Records
                  </h2>

                  <p>
                    Scroll down to automatically
                    load the next 20 records.
                  </p>

                </div>

                <div className="record-count">

                  {records.length}
                  {" / "}
                  {totalSize}

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

                        {/* NEW ID COLUMN */}

                        <th>
                          Salesforce Record ID
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
                              ].length + 2
                            }
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

                              {/* ACTIONS */}

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


                              {/* SALESFORCE RECORD ID */}

                              <td className="record-id">

                                {record.Id}

                              </td>


                              {/* FIELDS */}

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


                  {/* LOADING MORE */}

                  {loadingMore && (

                    <div className="loading-more">

                      Loading more records...

                    </div>

                  )}


                  {/* ALL RECORDS LOADED */}

                  {!loadingMore &&
                    !hasMore &&
                    records.length > 0 && (

                      <div className="no-more-records">

                        All {records.length} records loaded.

                      </div>

                    )}

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