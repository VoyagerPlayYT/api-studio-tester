// API STUDIO TESTER // Full HTTP Client Engine
(function() {
  const reqMethod = document.getElementById('reqMethod');
  const reqUrl = document.getElementById('reqUrl');
  const btnSend = document.getElementById('btnSend');
  const btnSaveModal = document.getElementById('btnSaveModal');

  const configTabs = document.querySelectorAll('.c-tab');
  const cfgPanes = document.querySelectorAll('.cfg-pane');
  const paramsRows = document.getElementById('paramsRows');
  const headersRows = document.getElementById('headersRows');
  const btnAddParam = document.getElementById('btnAddParam');
  const btnAddHeader = document.getElementById('btnAddHeader');

  const authType = document.getElementById('authType');
  const authBearerField = document.getElementById('authBearerField');
  const authBasicFields = document.getElementById('authBasicFields');
  const authTokenInput = document.getElementById('authTokenInput');
  const authUser = document.getElementById('authUser');
  const authPass = document.getElementById('authPass');

  const reqBodyInput = document.getElementById('reqBodyInput');
  const btnPrettifyJson = document.getElementById('btnPrettifyJson');

  const resStatusBadge = document.getElementById('resStatusBadge');
  const resTime = document.getElementById('resTime');
  const resSize = document.getElementById('resSize');
  const resBodyPre = document.getElementById('resBodyPre');
  const resHeadersPre = document.getElementById('resHeadersPre');
  const resTabs = document.querySelectorAll('.r-tab');

  const sidebarTabs = document.querySelectorAll('.s-tab');
  const tabContentCollections = document.getElementById('tabContentCollections');
  const tabContentHistory = document.getElementById('tabContentHistory');
  const collectionsTree = document.getElementById('collectionsTree');
  const historyList = document.getElementById('historyList');
  const btnClearHistory = document.getElementById('btnClearHistory');

  // Tab switching: Request Config
  configTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      configTabs.forEach(t => t.classList.remove('active'));
      cfgPanes.forEach(p => p.classList.add('hidden'));

      tab.classList.add('active');
      const pane = document.getElementById('pane' + tab.dataset.cfg.charAt(0).toUpperCase() + tab.dataset.cfg.slice(1));
      if (pane) pane.classList.remove('hidden');
    });
  });

  // Tab switching: Sidebar
  sidebarTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sidebarTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'collections') {
        tabContentCollections.classList.remove('hidden');
        tabContentHistory.classList.add('hidden');
        fetchCollections();
      } else {
        tabContentCollections.classList.add('hidden');
        tabContentHistory.classList.remove('hidden');
        fetchHistory();
      }
    });
  });

  // Tab switching: Response
  resTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      resTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.res === 'body') {
        resBodyPre.classList.remove('hidden');
        resHeadersPre.classList.add('hidden');
      } else {
        resBodyPre.classList.add('hidden');
        resHeadersPre.classList.remove('hidden');
      }
    });
  });

  // Auth toggle
  authType.addEventListener('change', () => {
    authBearerField.classList.add('hidden');
    authBasicFields.classList.add('hidden');
    if (authType.value === 'bearer') authBearerField.classList.remove('hidden');
    if (authType.value === 'basic') authBasicFields.classList.remove('hidden');
  });

  // Key-Value Rows Editor (Params & Headers)
  function createKvRow(container, key = '', val = '') {
    const row = document.createElement('div');
    row.className = 'kv-row';
    row.innerHTML = `
      <input type="text" placeholder="Key" value="${escapeHtml(key)}" class="cyber-input font-mono kv-key">
      <input type="text" placeholder="Value" value="${escapeHtml(val)}" class="cyber-input font-mono kv-val">
      <button class="mini-btn text-muted kv-del">✕</button>
    `;
    row.querySelector('.kv-del').addEventListener('click', () => row.remove());
    container.appendChild(row);
  }

  btnAddParam.addEventListener('click', () => createKvRow(paramsRows));
  btnAddHeader.addEventListener('click', () => createKvRow(headersRows));

  function getKvData(container) {
    const data = {};
    container.querySelectorAll('.kv-row').forEach(row => {
      const k = row.querySelector('.kv-key').value.trim();
      const v = row.querySelector('.kv-val').value.trim();
      if (k) data[k] = v;
    });
    return data;
  }

  // Prettify JSON in body
  btnPrettifyJson.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(reqBodyInput.value);
      reqBodyInput.value = JSON.stringify(parsed, null, 2);
    } catch (e) {
      alert("Invalid JSON syntax: " + e.message);
    }
  });

  // Execute Request
  async function sendRequest() {
    const method = reqMethod.value;
    const url = reqUrl.value.trim();
    if (!url) {
      alert("Please enter a valid request URL");
      return;
    }

    btnSend.textContent = "SENDING...";
    btnSend.disabled = true;

    const payload = {
      method: method,
      url: url,
      headers: getKvData(headersRows),
      params: getKvData(paramsRows),
      auth_type: authType.value,
      auth_token: authTokenInput.value,
      auth_user: authUser.value,
      auth_pass: authPass.value,
      body_type: reqBodyInput.value.trim() ? "json" : "none",
      body_content: reqBodyInput.value.trim()
    };

    try {
      const res = await fetch('/api/proxy/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      // Render Telemetry
      resStatusBadge.textContent = `${data.status_code} ${data.status_text || ''}`;
      resStatusBadge.className = 'status-badge';
      if (data.status_code >= 200 && data.status_code < 300) {
        resStatusBadge.classList.add('status-2xx');
      } else if (data.status_code >= 400) {
        resStatusBadge.classList.add('status-4xx');
      }

      resTime.textContent = `${data.time_ms} ms`;
      resSize.textContent = formatBytes(data.size_bytes);

      // Render Body
      resBodyPre.textContent = data.body || '[Empty response body]';

      // Render Headers
      resHeadersPre.innerHTML = '';
      if (data.headers) {
        Object.entries(data.headers).forEach(([k, v]) => {
          const div = document.createElement('div');
          div.className = 'h-row';
          div.innerHTML = `<span class="h-key">${escapeHtml(k)}:</span><span class="h-val">${escapeHtml(v)}</span>`;
          resHeadersPre.appendChild(div);
        });
      }

      fetchHistory();

    } catch (e) {
      resBodyPre.textContent = "Error executing request: " + e.message;
    } finally {
      btnSend.textContent = "SEND [CTRL+ENTER]";
      btnSend.disabled = false;
    }
  }

  btnSend.addEventListener('click', sendRequest);
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') sendRequest();
  });

  // Collections API
  async function fetchCollections() {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      collectionsTree.innerHTML = '';

      data.collections.forEach(col => {
        const group = document.createElement('div');
        group.innerHTML = `<div class="tree-group-title font-mono">📁 ${escapeHtml(col.name)}</div>`;

        col.requests.forEach(req => {
          const item = document.createElement('div');
          item.className = 'saved-req-item';
          item.innerHTML = `
            <span class="method-tag method-${req.method.toLowerCase()}">${req.method}</span>
            <span style="font-weight:600;flex:1;margin-left:8px;">${escapeHtml(req.name)}</span>
          `;
          item.addEventListener('click', () => loadSavedRequest(req));
          group.appendChild(item);
        });
        collectionsTree.appendChild(group);
      });
    } catch (e) {
      console.error(e);
    }
  }

  function loadSavedRequest(req) {
    reqMethod.value = req.method;
    reqUrl.value = req.url;
    reqBodyInput.value = req.body_content || '';

    // Clear and populate headers
    headersRows.innerHTML = '';
    if (req.headers_json) {
      try {
        const h = JSON.parse(req.headers_json);
        Object.entries(h).forEach(([k, v]) => createKvRow(headersRows, k, v));
      } catch (e) {}
    }

    // Clear and populate params
    paramsRows.innerHTML = '';
    if (req.params_json) {
      try {
        const p = JSON.parse(req.params_json);
        Object.entries(p).forEach(([k, v]) => createKvRow(paramsRows, k, v));
      } catch (e) {}
    }
  }

  // Save Request
  btnSaveModal.addEventListener('click', async () => {
    const name = prompt("Enter a title for this saved request:");
    if (!name) return;

    const payload = {
      collection_id: 1,
      name: name.trim(),
      method: reqMethod.value,
      url: reqUrl.value.trim(),
      headers: getKvData(headersRows),
      params: getKvData(paramsRows),
      auth: { type: authType.value },
      body_type: reqBodyInput.value.trim() ? "json" : "none",
      body_content: reqBodyInput.value.trim()
    };

    try {
      const res = await fetch('/api/requests/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchCollections();
        alert("Request archived into SQLite collections.");
      }
    } catch (e) {
      console.error(e);
    }
  });

  // History API
  async function fetchHistory() {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      historyList.innerHTML = '';
      data.history.forEach(h => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="method-tag method-${h.method.toLowerCase()}">${h.method}</span>
            <span class="font-mono text-xs ${h.status_code < 400 ? 'text-emerald' : 'text-red'}">${h.status_code}</span>
          </div>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;font-family:monospace;font-size:10px;">${escapeHtml(h.url)}</span>
          <span class="font-mono text-xs text-muted">${Math.round(h.time_ms)}ms</span>
        `;
        item.addEventListener('click', () => {
          reqMethod.value = h.method;
          reqUrl.value = h.url;
        });
        historyList.appendChild(item);
      });
    } catch (e) {
      console.error(e);
    }
  }

  btnClearHistory.addEventListener('click', async () => {
    await fetch('/api/history', { method: 'DELETE' });
    fetchHistory();
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
  }

  // Prepopulate standard headers
  createKvRow(headersRows, 'Accept', 'application/json');
  fetchCollections();

})();
