import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://salesforce-crud-backend-rffk.onrender.com";

const OBJECTS = [
  "Account",
  "Opportunity",
  "Lead",
  "Contact",
  "Case",
];

const OBJECT_META = {
  Account: {
    label: "Accounts",
    icon: "☁",
    color: "blue",
    description: "Manage customer accounts",
  },

  Opportunity: {
    label: "Opportunities",
    icon: "◆",
    color: "purple",
    description: "Track your sales pipeline",
  },

  Lead: {
    label: "Leads",
    icon: "◉",
    color: "orange",
    description: "Manage potential customers",
  },

  Contact: {
    label: "Contacts",
    icon: "◎",
    color: "green",
    description: "Manage customer contacts",
  },

  Case: {
    label: "Cases",
    icon: "●",
    color: "red",
    description: "Manage customer support cases",
  },
};

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

  /*
   * Phone intentionally stays text.
   * This allows Salesforce phone numbers
   * containing +, -, spaces, parentheses, etc.
   */

  if (field === "Phone") {
    return "tel";
  }

  return "text";
}

function getInitials(
  record,
  objectName
) {
  if (objectName === "Account") {
    return (
      record?.Name?.substring(0, 2).toUpperCase() ||
      "AC"
    );
  }

  if (objectName === "Opportunity") {
    return (
      record?.Name?.substring(0, 2).toUpperCase() ||
      "OP"
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

  if (objectName === "Case") {
    return "CS";
  }

  return "SF";
}

function getBadgeClass(
  field,
  value
) {
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

    if (
      normalized.includes("medium")
    ) {
      return "badge-warning";
    }

    if (
      normalized.includes("low")
    ) {
      return "badge-success";
    }
  }

  return "";
}

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

  if (Array.isArray(data.details)) {
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

  if (data.details?.message) {
    return data.details.message;
  }

  if (data.details?.[0]?.message) {
    return data.details[0].message;
  }

  return (
    data.error ||
    "Salesforce request failed."
  );
}

function App() {
  const [
    authenticated,
    setAuthenticated,
  ] = useState(false);

  const [
    checkingAuth,
    setCheckingAuth,
  ] = useState(true);

  const [
    objectName,
    setObjectName,
  ] = useState("Account");

  const [
    records,
    setRecords,
  ] = useState([]);

  const [
    totalSize,
    setTotalSize,
  ] = useState(0);

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    hasMore,
    setHasMore,
  ] = useState(false);

  const [
    objectCounts,
    setObjectCounts,
  ] = useState({
    Account: null,
    Opportunity: null,
    Lead: null,
    Contact: null,
    Case: null,
  });

  const [
    loadingCounts,
    setLoadingCounts,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    modal,
    setModal,
  ] = useState(null);

  const [
    selectedRecord,
    setSelectedRecord,
  ] = useState(null);

  const [
    formData,
    setFormData,
  ] = useState({});

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const loaderRef =
    useRef(null);

  /*
   * Prevent multiple simultaneous
   * infinite-scroll requests.
   */

  const loadingMoreRef =
    useRef(false);

  const currentMeta =
    OBJECT_META[objectName];

  const fields =
    FIELD_MAP[objectName];

  /* =======================================================
     SUCCESS MESSAGE
  ======================================================= */

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timer =
      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);

    return () =>
      clearTimeout(timer);
  }, [successMessage]);

  /* =======================================================
     CHECK AUTHENTICATION
  ======================================================= */

  const checkAuth =
    useCallback(async () => {
      try {
        setCheckingAuth(true);

        /*
         * Give the browser a moment to restore
         * the session cookie after OAuth redirect.
         */

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              500
            )
        );

        const response =
          await fetch(
            `${API_URL}/auth/status`,
            {
              method: "GET",

              credentials: "include",

              cache: "no-store",
            }
          );

        if (!response.ok) {
          throw new Error(
            `Auth status request failed: ${response.status}`
          );
        }

        const data =
          await response.json();

        console.log(
          "Salesforce authentication status:",
          data
        );

        setAuthenticated(
          Boolean(
            data.authenticated
          )
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

  /* =======================================================
     LOAD OBJECT COUNTS
  ======================================================= */

  const loadObjectCounts =
    useCallback(async () => {
      try {
        setLoadingCounts(true);

        const results =
          await Promise.all(
            OBJECTS.map(
              async (object) => {
                try {
                  const response =
                    await fetch(
                      `${API_URL}/api/records/${object}?page=1`,
                      {
                        method: "GET",

                        credentials:
                          "include",

                        cache:
                          "no-store",
                      }
                    );

                  const data =
                    await response.json();

                  if (
                    !response.ok
                  ) {
                    return [
                      object,
                      null,
                    ];
                  }

                  return [
                    object,
                    Number(
                      data.totalSize ||
                        0
                    ),
                  ];
                } catch {
                  return [
                    object,
                    null,
                  ];
                }
              }
            )
          );

        const counts = {};

        results.forEach(
          ([object, count]) => {
            counts[object] =
              count;
          }
        );

        setObjectCounts(
          counts
        );
      } finally {
        setLoadingCounts(
          false
        );
      }
    }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    loadObjectCounts();
  }, [
    authenticated,
    loadObjectCounts,
  ]);

  /* =======================================================
     LOAD RECORDS
     20 RECORDS PER REQUEST
  ======================================================= */

  const loadRecords =
    useCallback(
      async (
        requestedPage = 1,
        append = false
      ) => {
        try {
          if (append) {
            setLoadingMore(true);

            loadingMoreRef.current =
              true;
          } else {
            setLoading(true);
          }

          setError("");

          const response =
            await fetch(
              `${API_URL}/api/records/${objectName}?page=${requestedPage}`,
              {
                method: "GET",

                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            if (
              response.status ===
              401
            ) {
              setAuthenticated(
                false
              );
            }

            throw new Error(
              data.error ||
                "Failed to load records."
            );
          }

          const incomingRecords =
            data.records || [];

          /*
           * Append the next 20 records.
           */

          if (append) {
            setRecords(
              (previous) => [
                ...previous,
                ...incomingRecords,
              ]
            );
          } else {
            setRecords(
              incomingRecords
            );
          }

          setTotalSize(
            Number(
              data.totalSize || 0
            )
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

          setObjectCounts(
            (previous) => ({
              ...previous,

              [objectName]:
                Number(
                  data.totalSize ||
                    0
                ),
            })
          );

          console.log(
            `Loaded ${incomingRecords.length} records`,
            {
              object:
                objectName,

              page:
                data.page,

              pageSize:
                data.pageSize,

              totalSize:
                data.totalSize,

              hasMore:
                data.hasMore,
            }
          );
        } catch (err) {
          console.error(
            "Load records error:",
            err
          );

          setError(
            err.message
          );
        } finally {
          if (append) {
            setLoadingMore(
              false
            );

            loadingMoreRef.current =
              false;
          } else {
            setLoading(false);
          }
        }
      },
      [objectName]
    );

  /* =======================================================
     INITIAL RECORD LOAD
  ======================================================= */

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    setRecords([]);
    setPage(0);
    setHasMore(false);
    setSearchTerm("");

    loadingMoreRef.current =
      false;

    loadRecords(1, false);
  }, [
    authenticated,
    objectName,
    loadRecords,
  ]);

  /* =======================================================
     INFINITE SCROLL
  ======================================================= */

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
          const entry =
            entries[0];

          if (
            entry.isIntersecting &&
            !loading &&
            !loadingMore &&
            !loadingMoreRef.current
          ) {
            console.log(
              "Scroll reached bottom. Loading page:",
              page + 1
            );

            loadRecords(
              page + 1,
              true
            );
          }
        },
        {
          root: null,

          /*
           * Start loading slightly before
           * the user reaches the bottom.
           */

          rootMargin:
            "0px 0px 300px 0px",

          threshold: 0,
        }
      );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [
    hasMore,
    loading,
    loadingMore,
    page,
    loadRecords,
  ]);

  /* =======================================================
     LOGIN
  ======================================================= */

  function login() {
    const frontendUrl =
      window.location.origin;

    window.location.href =
      `${API_URL}/auth/login?frontend=${encodeURIComponent(
        frontendUrl
      )}`;
  }

  /* =======================================================
     LOGOUT
  ======================================================= */

  async function logout() {
    try {
      await fetch(
        `${API_URL}/auth/logout`,
        {
          method: "GET",

          credentials:
            "include",

          cache: "no-store",
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
    setPage(0);
    setHasMore(false);
  }

  /* =======================================================
     OBJECT CHANGE
  ======================================================= */

  function changeObject(
    event
  ) {
    setObjectName(
      event.target.value
    );

    setError("");
    setSearchTerm("");
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function refreshRecords() {
    await loadRecords(
      1,
      false
    );

    await loadObjectCounts();

    setSuccessMessage(
      `${currentMeta.label} refreshed successfully.`
    );
  }

  /* =======================================================
     CREATE
  ======================================================= */

  function openCreate() {
    const fieldsToCreate =
      CREATE_FIELDS[
        objectName
      ] || [];

    const initialData = {};

    fieldsToCreate.forEach(
      (field) => {
        initialData[field] =
          "";
      }
    );

    setFormData(
      initialData
    );

    setSelectedRecord(
      null
    );

    setModal("create");

    setError("");
  }

  /* =======================================================
     VIEW
  ======================================================= */

  function openView(
    record
  ) {
    setSelectedRecord(
      record
    );

    setModal("view");

    setError("");
  }

  /* =======================================================
     EDIT
  ======================================================= */

  function openEdit(
    record
  ) {
    const fieldsToEdit =
      CREATE_FIELDS[
        objectName
      ] || [];

    const initialData = {};

    fieldsToEdit.forEach(
      (field) => {
        initialData[field] =
          record[field] ??
          "";
      }
    );

    setSelectedRecord(
      record
    );

    setFormData(
      initialData
    );

    setModal("edit");

    setError("");
  }

  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {
    if (
      saving ||
      deleting
    ) {
      return;
    }

    setModal(null);
    setSelectedRecord(
      null
    );
    setFormData({});
  }

  /* =======================================================
     INPUT CHANGE
  ======================================================= */

  function handleInputChange(
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

  /* =======================================================
     CREATE RECORD
  ======================================================= */

  async function createRecord(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const response =
        await fetch(
          `${API_URL}/api/records/${objectName}`,
          {
            method: "POST",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              cleanPayload(
                formData
              )
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getSalesforceError(
            data
          )
        );
      }

      closeModal();

      setSuccessMessage(
        `${objectName} created successfully.`
      );

      /*
       * Reload first page.
       */

      await loadRecords(
        1,
        false
      );

      await loadObjectCounts();
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     UPDATE RECORD
  ======================================================= */

  async function updateRecord(
    event
  ) {
    event.preventDefault();

    if (
      !selectedRecord?.Id
    ) {
      setError(
        "Record ID is missing."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");

      const response =
        await fetch(
          `${API_URL}/api/records/${objectName}/${selectedRecord.Id}`,
          {
            method: "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              cleanPayload(
                formData
              )
            ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getSalesforceError(
            data
          )
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

      await loadObjectCounts();
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     DELETE RECORD
  ======================================================= */

  async function deleteRecord(
    record
  ) {
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

            credentials:
              "include",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          getSalesforceError(
            data
          )
        );
      }

      setRecords(
        (previous) =>
          previous.filter(
            (item) =>
              item.Id !==
              record.Id
          )
      );

      setTotalSize(
        (previous) =>
          Math.max(
            0,
            previous - 1
          )
      );

      setObjectCounts(
        (previous) => ({
          ...previous,

          [objectName]:
            previous[
              objectName
            ] !== null
              ? Math.max(
                  0,
                  previous[
                    objectName
                  ] - 1
                )
              : previous[
                  objectName
                ],
        })
      );

      setSuccessMessage(
        `${objectName} deleted successfully.`
      );
    } catch (err) {
      setError(
        err.message
      );
    } finally {
      setDeleting(false);
    }
  }

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredRecords =
    records.filter(
      (record) => {
        if (
          !searchTerm.trim()
        ) {
          return true;
        }

        const search =
          searchTerm
            .toLowerCase()
            .trim();

        return Object.values(
          record
        ).some(
          (value) =>
            String(
              value ?? ""
            )
              .toLowerCase()
              .includes(
                search
              )
        );
      }
    );

  /* =======================================================
     CHECKING AUTH SCREEN
  ======================================================= */

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-cloud">
            ☁
          </div>

          <div className="spinner"></div>

          <h2>
            Connecting to Salesforce
          </h2>

          <p>
            Checking your secure Salesforce
            session...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     LOGIN SCREEN
  ======================================================= */

  if (!authenticated) {
    return (
      <div className="login-page">
        <div className="login-glow glow-one"></div>

        <div className="login-glow glow-two"></div>

        <header className="login-header">
          <div className="brand">
            <div className="brand-icon">
              ☁
            </div>

            <div>
              <strong>
                Salesforce CRUD Manager
              </strong>

              <span>
                Smart Salesforce workspace
              </span>
            </div>
          </div>

          <div className="secure-pill">
            <span></span>
            OAuth 2.0 Secure
          </div>
        </header>

        <main className="login-content">
          <section className="login-intro">
            <div className="intro-tag">
              SALESFORCE MANAGEMENT PLATFORM
            </div>

            <h1>
              Manage Salesforce
              <span>
                {" "}
                records smarter.
              </span>
            </h1>

            <p>
              Create, view, update and
              delete Salesforce records
              through one simple and
              professional workspace.
            </p>

            <div className="login-features">
              {OBJECTS.map(
                (object) => {
                  const meta =
                    OBJECT_META[
                      object
                    ];

                  return (
                    <div
                      className="login-feature"
                      key={object}
                    >
                      <div
                        className={`feature-icon ${meta.color}`}
                      >
                        {meta.icon}
                      </div>

                      <div>
                        <strong>
                          {
                            meta.label
                          }
                        </strong>

                        <span>
                          {
                            meta.description
                          }
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          <section className="login-card">
            <div className="login-card-icon">
              ☁
            </div>

            <div className="login-eyebrow">
              WELCOME
            </div>

            <h2>
              Connect Salesforce
            </h2>

            <p>
              Sign in with your
              Salesforce Developer Org
              to access your records.
            </p>

            <button
              className="login-button"
              onClick={login}
            >
              <span>☁</span>

              Login with Salesforce

              <b>→</b>
            </button>

            <div className="login-security">
              <span>✓</span>
              OAuth 2.0 authentication
            </div>

            <div className="login-security">
              <span>✓</span>
              No Salesforce password stored
            </div>

            <div className="login-security">
              <span>✓</span>
              Secure session-based access
            </div>
          </section>
        </main>

        <footer className="login-footer">
          © 2026 Salesforce CRUD Manager
        </footer>
      </div>
    );
  }

  /* =======================================================
     DASHBOARD
  ======================================================= */

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            ☁
          </div>

          <div>
            <strong>
              Salesforce CRUD Manager
            </strong>

            <span>
              Manage Salesforce records
            </span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="connected">
            <span></span>
            Salesforce Connected
          </div>

          <div className="user-avatar">
            SF
          </div>

          <button
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="welcome-section">
          <div>
            <div className="section-label">
              SALESFORCE WORKSPACE
            </div>

            <h1>
              Welcome back 👋
            </h1>

            <p>
              Manage your Salesforce data
              from one simple workspace.
            </p>
          </div>

          <div className="workspace-badge">
            <span>●</span>
            Developer Org
          </div>
        </section>

        <section className="object-selector-card">
          <div className="selector-info">
            <div
              className={`selector-icon ${currentMeta.color}`}
            >
              {currentMeta.icon}
            </div>

            <div>
              <label>
                SALESFORCE OBJECT
              </label>

              <h2>
                Select an object to manage
              </h2>

              <p>
                Choose one of the five
                standard Salesforce objects.
              </p>
            </div>
          </div>

          <div className="select-wrapper">
            <select
              value={objectName}
              onChange={
                changeObject
              }
            >
              {OBJECTS.map(
                (object) => (
                  <option
                    value={object}
                    key={object}
                  >
                    {
                      OBJECT_META[
                        object
                      ].label
                    }
                  </option>
                )
              )}
            </select>

            <span>⌄</span>
          </div>
        </section>

        <section className="stats-grid">
          {OBJECTS.map(
            (object) => {
              const meta =
                OBJECT_META[
                  object
                ];

              return (
                <button
                  key={object}
                  className={`stat-card ${
                    object ===
                    objectName
                      ? "stat-active"
                      : ""
                  }`}
                  onClick={() =>
                    setObjectName(
                      object
                    )
                  }
                >
                  <div
                    className={`stat-icon ${meta.color}`}
                  >
                    {meta.icon}
                  </div>

                  <div className="stat-details">
                    <span>
                      {meta.label}
                    </span>

                    <strong>
                      {loadingCounts
                        ? "..."
                        : objectCounts[
                            object
                          ] ??
                          "—"}
                    </strong>

                    <small>
                      Salesforce records
                    </small>
                  </div>
                </button>
              );
            }
          )}
        </section>

        {error && (
          <div className="alert error-alert">
            <div className="alert-symbol">
              !
            </div>

            <div>
              <strong>
                Something went wrong
              </strong>

              <p>
                {error}
              </p>
            </div>

            <button
              onClick={() =>
                setError("")
              }
            >
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="alert success-alert">
            <div className="alert-symbol">
              ✓
            </div>

            <div>
              <strong>
                Success
              </strong>

              <p>
                {successMessage}
              </p>
            </div>

            <button
              onClick={() =>
                setSuccessMessage(
                  ""
                )
              }
            >
              ×
            </button>
          </div>
        )}

        <section className="records-section">
          <div className="records-header">
            <div className="records-title">
              <div
                className={`records-icon ${currentMeta.color}`}
              >
                {currentMeta.icon}
              </div>

              <div>
                <h2>
                  {currentMeta.label}
                </h2>

                <p>
                  {
                    currentMeta.description
                  }
                </p>
              </div>
            </div>

            <div className="records-total">
              <strong>
                {totalSize.toLocaleString()}
              </strong>

              <span>
                Total records
              </span>
            </div>
          </div>

          <div className="toolbar">
            <div className="search-box">
              <span>⌕</span>

              <input
                type="text"
                value={
                  searchTerm
                }
                onChange={(
                  event
                ) =>
                  setSearchTerm(
                    event.target
                      .value
                  )
                }
                placeholder={`Search ${currentMeta.label.toLowerCase()}...`}
              />

              {searchTerm && (
                <button
                  onClick={() =>
                    setSearchTerm(
                      ""
                    )
                  }
                >
                  ×
                </button>
              )}
            </div>

            <div className="toolbar-buttons">
              <button
                className="refresh-button"
                onClick={
                  refreshRecords
                }
              >
                ↻ Refresh
              </button>

              <button
                className="create-button"
                onClick={
                  openCreate
                }
              >
                + Create{" "}
                {objectName}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="records-loading">
              <div className="spinner"></div>

              <h3>
                Loading Salesforce records...
              </h3>

              <p>
                Loading the first 20 records.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
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

                      <th className="actions-heading">
                        ACTIONS
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredRecords.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={
                            fields.length +
                            1
                          }
                        >
                          <div className="empty-state">
                            <div>
                              {searchTerm
                                ? "⌕"
                                : currentMeta.icon}
                            </div>

                            <h3>
                              {searchTerm
                                ? "No matching records"
                                : `No ${currentMeta.label.toLowerCase()} found`}
                            </h3>

                            <p>
                              {searchTerm
                                ? "Try a different search."
                                : "Create your first record to get started."}
                            </p>

                            {!searchTerm && (
                              <button
                                className="create-button"
                                onClick={
                                  openCreate
                                }
                              >
                                + Create{" "}
                                {
                                  objectName
                                }
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map(
                        (
                          record
                        ) => (
                          <tr
                            key={
                              record.Id
                            }
                          >
                            {fields.map(
                              (
                                field
                              ) => {
                                const value =
                                  record[
                                    field
                                  ];

                                const badge =
                                  getBadgeClass(
                                    field,
                                    value
                                  );

                                if (
                                  field ===
                                    "Name" ||
                                  field ===
                                    "Subject"
                                ) {
                                  return (
                                    <td
                                      key={
                                        field
                                      }
                                    >
                                      <div className="record-name">
                                        <div
                                          className={`record-avatar ${currentMeta.color}`}
                                        >
                                          {getInitials(
                                            record,
                                            objectName
                                          )}
                                        </div>

                                        <div>
                                          <strong>
                                            {formatValue(
                                              value
                                            )}
                                          </strong>

                                          <span>
                                            {
                                              objectName
                                            }
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={
                                      field
                                    }
                                  >
                                    {badge ? (
                                      <span
                                        className={`status-badge ${badge}`}
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

                            <td>
                              <div className="row-actions">
                                <button
                                  className="view-action"
                                  onClick={() =>
                                    openView(
                                      record
                                    )
                                  }
                                >
                                  👁 View
                                </button>

                                <button
                                  className="edit-action"
                                  onClick={() =>
                                    openEdit(
                                      record
                                    )
                                  }
                                >
                                  ✏ Edit
                                </button>

                                <button
                                  className="delete-action"
                                  disabled={
                                    deleting
                                  }
                                  onClick={() =>
                                    deleteRecord(
                                      record
                                    )
                                  }
                                >
                                  🗑 Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* =================================================
                  INFINITE SCROLL LOADER
              ================================================= */}

              <div
                className="scroll-loader"
                ref={loaderRef}
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
                    <div className="scroll-hint">
                      ↓ Scroll down to
                      load the next 20
                      records
                    </div>
                  )}

                {!loadingMore &&
                  !hasMore &&
                  records.length >
                    0 && (
                    <div className="all-loaded">
                      ✓ All Salesforce
                      records loaded
                    </div>
                  )}
              </div>
            </>
          )}
        </section>
      </main>

      {/* =====================================================
          VIEW MODAL
      ===================================================== */}

      {modal === "view" && (
        <div
          className="modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <span>
                  RECORD DETAILS
                </span>

                <h2>
                  View{" "}
                  {objectName}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeModal
                }
              >
                ×
              </button>
            </div>

            <div className="profile">
              <div
                className={`large-avatar ${currentMeta.color}`}
              >
                {getInitials(
                  selectedRecord,
                  objectName
                )}
              </div>

              <div>
                <h3>
                  {formatValue(
                    selectedRecord?.Name ||
                      selectedRecord?.Subject ||
                      selectedRecord?.Company ||
                      `${selectedRecord?.FirstName || ""} ${selectedRecord?.LastName || ""}`
                  )}
                </h3>

                <p>
                  {objectName}
                </p>
              </div>
            </div>

            <div className="detail-grid">
              {fields.map(
                (field) => (
                  <div
                    className="detail-item"
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

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={
                  closeModal
                }
              >
                Close
              </button>

              <button
                className="create-button"
                onClick={() =>
                  openEdit(
                    selectedRecord
                  )
                }
              >
                ✏ Edit Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CREATE / EDIT MODAL
      ===================================================== */}

      {(modal === "create" ||
        modal === "edit") && (
        <div
          className="modal-overlay"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <span>
                  {modal ===
                  "create"
                    ? "NEW RECORD"
                    : "UPDATE RECORD"}
                </span>

                <h2>
                  {modal ===
                  "create"
                    ? `Create ${objectName}`
                    : `Edit ${objectName}`}
                </h2>
              </div>

              <button
                className="modal-close"
                onClick={
                  closeModal
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={
                modal ===
                "create"
                  ? createRecord
                  : updateRecord
              }
            >
              <div className="form-grid">
                {(
                  CREATE_FIELDS[
                    objectName
                  ] || []
                ).map(
                  (field) => {
                    const inputType =
                      getInputType(
                        field
                      );

                    return (
                      <div
                        className={`form-group ${
                          inputType ===
                          "textarea"
                            ? "full"
                            : ""
                        }`}
                        key={field}
                      >
                        <label>
                          {getLabel(
                            field
                          )}
                        </label>

                        {inputType ===
                        "textarea" ? (
                          <textarea
                            rows="4"
                            value={
                              formData[
                                field
                              ] ??
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              handleInputChange(
                                field,
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder={`Enter ${getLabel(
                              field
                            ).toLowerCase()}`}
                          />
                        ) : (
                          <input
                            type={
                              inputType
                            }
                            value={
                              formData[
                                field
                              ] ??
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              handleInputChange(
                                field,
                                event
                                  .target
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
                  }
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
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
                  {saving
                    ? "Saving..."
                    : modal ===
                      "create"
                    ? `Create ${objectName}`
                    : "Save Changes"}
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