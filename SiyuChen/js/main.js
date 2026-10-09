// Mobile navigation toggle
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", function () {
    toggle.classList.toggle("active");
    links.classList.toggle("open");
  });

  // Close menu when a link is clicked (mobile)
  links.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      toggle.classList.remove("active");
      links.classList.remove("open");
    });
  });
})();

// Highlight active nav link based on current page
(function () {
  var path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach(function (link) {
    var href = link.getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
})();

// Contact form: friendly demo handler
(function () {
  var form = document.querySelector(".contact-form");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var note = document.getElementById("form-note");
    if (note) {
      note.textContent = "Thanks for reaching out! I'll get back to you soon. \u2728";
      note.style.display = "block";
    }
    form.reset();
  });
})();

// To-do list app (Supabase REST-backed)
(function () {
  var form = document.getElementById("todo-form");
  var input = document.getElementById("todo-input");
  var dateInput = document.getElementById("todo-date");
  var list = document.getElementById("todo-list");
  var empty = document.getElementById("todo-empty");
  var count = document.getElementById("todo-count");
  if (!form || !list) return;

  // Supabase project — talk to PostgREST directly via fetch (no external SDK).
  var API = "https://ouxywprtiyxbjbvzaoif.supabase.co/rest/v1";
  var KEY = "sb_publishable_6LQAmaIri09ctr9qRYRnkA__LEZU2B5";

  function api(method, path, body, extraHeaders) {
    var headers = {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json"
    };
    if (extraHeaders) Object.assign(headers, extraHeaders);
    return fetch(API + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.text().then(function (text) {
        var data = text ? JSON.parse(text) : [];
        if (!r.ok) throw (data && data.message) || "HTTP " + r.status;
        return data;
      });
    });
  }

  // Default the date picker to today
  dateInput.value = new Date().toISOString().split("T")[0];

  // Picker state is client-only — the todos table has no priority/emoji columns,
  // so these are not persisted (they apply to the current session for newly added tasks).
  var selectedPriority = "medium";
  var selectedEmoji = "";

  // Priority picker (single select)
  var priorityPicker = document.getElementById("priority-picker");
  if (priorityPicker) {
    priorityPicker.querySelectorAll(".seg-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        selectedPriority = btn.getAttribute("data-priority");
        priorityPicker.querySelectorAll(".seg-btn").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
      });
    });
  }

  // Emoji picker (select one; click again to clear)
  var emojiPicker = document.getElementById("emoji-picker");
  function clearEmojiSelection() {
    selectedEmoji = "";
    if (emojiPicker) {
      emojiPicker.querySelectorAll(".emoji-btn").forEach(function (b) {
        b.classList.remove("active");
      });
    }
  }
  if (emojiPicker) {
    emojiPicker.querySelectorAll(".emoji-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var emoji = btn.getAttribute("data-emoji");
        if (selectedEmoji === emoji) {
          clearEmojiSelection();
        } else {
          selectedEmoji = emoji;
          emojiPicker.querySelectorAll(".emoji-btn").forEach(function (b) {
            b.classList.remove("active");
          });
          btn.classList.add("active");
        }
      });
    });
  }

  function toggleEmpty() {
    empty.style.display = list.children.length ? "none" : "block";
  }

  function updateCount() {
    var total = list.children.length;
    var done = list.querySelectorAll(".todo-item.done").length;
    if (count) {
      count.textContent = done + " of " + total + " task" + (total === 1 ? "" : "s") + " completed";
      count.style.display = total ? "block" : "none";
    }
  }

  function formatDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // Inline editing: click text to edit, Enter saves, Escape cancels.
  // Saves also persist the new text to Supabase.
  function makeEditable(span, todoId) {
    span.addEventListener("click", function () {
      var original = span.textContent;
      var editInput = document.createElement("input");
      editInput.type = "text";
      editInput.className = "todo-edit";
      editInput.value = original;
      span.replaceWith(editInput);
      editInput.focus();
      editInput.select();

      var finished = false;
      function finish(save) {
        if (finished) return;
        finished = true;
        var val = editInput.value.trim();
        var nextText = save && val ? val : original;
        var next = document.createElement("span");
        next.className = "todo-text";
        next.textContent = nextText;
        editInput.replaceWith(next);
        makeEditable(next, todoId);
        if (save && val && val !== original && todoId != null) {
          api("PATCH", "/todos?id=eq." + todoId, { task: nextText })
            .catch(function (err) { console.error("Failed to save edit:", err); });
        }
      }

      editInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      });
      editInput.addEventListener("blur", function () {
        finish(true);
      });
    });
  }

  // Render a todo row from the database. priority/emoji are optional and only
  // used for newly added tasks (the table has no such columns to persist them).
  function renderTodo(todo, priority, emoji) {
    var li = document.createElement("li");
    li.className = "todo-item" + (todo.is_complete ? " done" : "");
    li.dataset.id = todo.id;

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-check";
    checkbox.checked = !!todo.is_complete;
    checkbox.addEventListener("change", function () {
      var checked = checkbox.checked;
      li.classList.toggle("done", checked);
      updateCount();
      api("PATCH", "/todos?id=eq." + todo.id, { is_complete: checked })
        .catch(function (err) {
          checkbox.checked = !checked;
          li.classList.toggle("done", !checked);
          updateCount();
          console.error("Failed to update task:", err);
        });
    });

    var content = document.createElement("div");
    content.className = "todo-content";

    var textEl = document.createElement("span");
    textEl.className = "todo-text";
    textEl.textContent = todo.task;
    makeEditable(textEl, todo.id);

    var meta = document.createElement("div");
    meta.className = "todo-meta";

    if (todo.date) {
      var dateEl = document.createElement("span");
      dateEl.className = "todo-date";
      dateEl.textContent = formatDate(todo.date);
      meta.appendChild(dateEl);
    }
    if (priority) {
      var priorityEl = document.createElement("span");
      priorityEl.className = "todo-priority priority-" + priority;
      priorityEl.textContent = priority.charAt(0).toUpperCase() + priority.slice(1);
      meta.appendChild(priorityEl);
    }

    content.appendChild(textEl);
    content.appendChild(meta);

    var emojiEl = null;
    if (emoji) {
      emojiEl = document.createElement("span");
      emojiEl.className = "todo-emoji";
      emojiEl.textContent = emoji;
    }

    var del = document.createElement("button");
    del.type = "button";
    del.className = "todo-delete";
    del.setAttribute("aria-label", "Delete task");
    del.textContent = "\u2715";
    del.addEventListener("click", function () {
      api("DELETE", "/todos?id=eq." + todo.id)
        .then(function () {
          li.remove();
          toggleEmpty();
          updateCount();
        })
        .catch(function (err) { console.error("Failed to delete task:", err); });
    });

    li.appendChild(checkbox);
    if (emojiEl) li.appendChild(emojiEl);
    li.appendChild(content);
    li.appendChild(del);
    list.appendChild(li);
  }

  // On page load, read all todos back ordered by creation time
  function loadTodos() {
    api("GET", "/todos?order=created_at.asc")
      .then(function (rows) {
        (rows || []).forEach(function (todo) { renderTodo(todo); });
        toggleEmpty();
        updateCount();
      })
      .catch(function (err) {
        console.error("Failed to load tasks:", err);
        toggleEmpty();
        updateCount();
      });
  }

  // Add: save a new todo to the todos table
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    var date = dateInput.value;
    if (!text || !date) return;

    api("POST", "/todos", { task: text, date: date, is_complete: false }, { Prefer: "return=representation" })
      .then(function (rows) {
        var todo = rows && rows[0];
        if (todo) renderTodo(todo, selectedPriority, selectedEmoji);
        input.value = "";
        clearEmojiSelection();
        toggleEmpty();
        updateCount();
        input.focus();
      })
      .catch(function (err) { console.error("Failed to add task:", err); });
  });

  loadTodos();
})();
